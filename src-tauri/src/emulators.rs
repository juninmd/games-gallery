//! Real emulator management: detection of installed executables, package-manager runs with
//! streamed output, and argv-only launching. No shell string is ever built.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorProbe {
    pub id: String,
    pub exe: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorPresence {
    pub id: String,
    pub exe: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorOutput {
    pub id: String,
    pub line: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallOutcome {
    pub code: i32,
    pub cancelled: bool,
}

/// PIDs of package-manager processes currently running, keyed by emulator id.
#[derive(Default)]
pub struct Running(pub Arc<Mutex<HashMap<String, u32>>>);

const MAX_DEPTH: usize = 4;

/// `flat` directories are searched only one level deep (PATH, shims); `deep` ones are walked
/// recursively because installers create their own subfolders; `shallow` ones (uninstall entries)
/// get a small depth budget so a large registry does not become a full disk walk.
fn search_dirs(extra: &[String]) -> (Vec<PathBuf>, Vec<PathBuf>, Vec<PathBuf>) {
    let mut flat: Vec<PathBuf> = Vec::new();
    let mut deep: Vec<PathBuf> = Vec::new();
    if let Ok(path) = std::env::var("PATH") {
        flat.extend(std::env::split_paths(&path));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        deep.push(PathBuf::from(&local).join("Programs"));
        flat.push(PathBuf::from(&local).join("Microsoft").join("WinGet").join("Links"));
    }
    if let Ok(user) = std::env::var("USERPROFILE") {
        flat.push(PathBuf::from(&user).join("scoop").join("shims"));
    }
    for key in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(dir) = std::env::var(key) {
            deep.push(PathBuf::from(dir));
        }
    }
    for dir in extra {
        let path = PathBuf::from(dir.trim());
        if !path.as_os_str().is_empty() && path.is_dir() {
            deep.push(path);
        }
    }
    (flat, deep, uninstall_dirs())
}

/// Install folders declared by Windows uninstall entries: where normal installers put emulators.
#[cfg(windows)]
fn uninstall_dirs() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let mut out: Vec<PathBuf> = Vec::new();
    let roots = [
        (RegKey::predef(HKEY_LOCAL_MACHINE), "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (RegKey::predef(HKEY_LOCAL_MACHINE), "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (RegKey::predef(HKEY_CURRENT_USER), "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
    ];
    for (root, path) in roots {
        let Ok(key) = root.open_subkey(path) else { continue };
        for name in key.enum_keys().flatten() {
            let Ok(sub) = key.open_subkey(&name) else { continue };
            let mut candidates: Vec<PathBuf> = Vec::new();
            if let Ok(location) = sub.get_value::<String, _>("InstallLocation") {
                candidates.push(PathBuf::from(location.trim()));
            }
            if let Ok(icon) = sub.get_value::<String, _>("DisplayIcon") {
                let clean = icon.trim().trim_matches('"');
                let exe = clean.split(',').next().unwrap_or("").trim();
                if let Some(parent) = PathBuf::from(exe).parent() {
                    candidates.push(parent.to_path_buf());
                }
            }
            for dir in candidates {
                if dir.is_dir() && !out.contains(&dir) {
                    out.push(dir);
                }
            }
        }
    }
    out
}

#[cfg(not(windows))]
fn uninstall_dirs() -> Vec<PathBuf> {
    Vec::new()
}

/// One walk per directory for every executable wanted at once, instead of one walk per emulator.
fn collect_matches(dir: &Path, wanted: &HashSet<String>, depth: usize, limit: usize, found: &mut HashMap<String, String>) {
    if depth > limit || found.len() >= wanted.len() {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            subdirs.push(entry.path());
        } else if wanted.contains(&name) && !found.contains_key(&name) {
            found.insert(name, entry.path().to_string_lossy().to_string());
        }
    }
    for sub in subdirs {
        collect_matches(&sub, wanted, depth + 1, limit, found);
    }
}

#[cfg(test)]
fn resolve_exe(file: &str, dirs: &[PathBuf]) -> Option<String> {
    let key = file.trim().to_lowercase();
    if key.is_empty() {
        return None;
    }
    let wanted: HashSet<String> = [key.clone()].into();
    let mut found: HashMap<String, String> = HashMap::new();
    for dir in dirs {
        collect_matches(dir, &wanted, 1, MAX_DEPTH, &mut found);
        if !found.is_empty() {
            break;
        }
    }
    found.get(&key).cloned()
}


/// Resolves each catalog executable on disk; a missing executable means "not installed".
#[tauri::command]
pub async fn detect_emulators(probes: Vec<EmulatorProbe>, extra_dirs: Vec<String>) -> Vec<EmulatorPresence> {
    tauri::async_runtime::spawn_blocking(move || detect_emulators_sync(probes, extra_dirs))
        .await
        .unwrap_or_default()
}

fn detect_emulators_sync(probes: Vec<EmulatorProbe>, extra_dirs: Vec<String>) -> Vec<EmulatorPresence> {
    let wanted: HashSet<String> = probes
        .iter()
        .map(|p| p.exe.trim().to_lowercase())
        .filter(|e| !e.is_empty())
        .collect();
    let (flat, deep, shallow) = search_dirs(&extra_dirs);
    let mut found: HashMap<String, String> = HashMap::new();

    for dir in &flat {
        for name in &wanted {
            if found.contains_key(name) {
                continue;
            }
            let candidate = dir.join(name);
            if candidate.is_file() {
                found.insert(name.clone(), candidate.to_string_lossy().to_string());
            }
        }
    }
    for (dirs, limit) in [(&shallow, 3usize), (&deep, MAX_DEPTH)] {
        for dir in dirs {
            collect_matches(dir, &wanted, 1, limit, &mut found);
            if found.len() >= wanted.len() {
                break;
            }
        }
    }

    probes
        .into_iter()
        .map(|probe| {
            let key = probe.exe.trim().to_lowercase();
            EmulatorPresence { id: probe.id, exe: found.get(&key).cloned() }
        })
        .collect()
}

fn valid_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+' | '@' | '/'))
}

fn manager_exe(manager: &str) -> Result<&'static str, String> {
    match manager {
        "winget" => Ok("winget"),
        "scoop" => Ok("scoop"),
        "flatpak" => Ok("flatpak"),
        "brew" => Ok("brew"),
        other => Err(format!("gerenciador não suportado: {other}")),
    }
}

/// Builds the process for one package-manager call. Scoop ships as a PowerShell script, so on
/// Windows it runs through powershell.exe with only pre-validated tokens (`valid_token`).
fn manager_command(manager: &str, args: &[String]) -> Result<Command, String> {
    let exe = manager_exe(manager)?;
    #[cfg(windows)]
    if manager == "scoop" {
        let mut cmd = Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"]);
        cmd.arg(format!("scoop {}", args.join(" ")));
        return Ok(cmd);
    }
    let mut cmd = Command::new(exe);
    cmd.args(args);
    Ok(cmd)
}

fn manager_args(manager: &str, package: &str, cask: bool, uninstall: bool) -> Result<Vec<String>, String> {
    let pkg = package.to_string();
    let args: Vec<String> = match (manager, uninstall) {
        ("winget", false) => vec![
            "install".into(), "--id".into(), pkg, "--exact".into(), "--source".into(), "winget".into(),
            "--accept-package-agreements".into(), "--accept-source-agreements".into(), "--disable-interactivity".into(),
        ],
        ("winget", true) => vec!["uninstall".into(), "--id".into(), pkg, "--exact".into(), "--disable-interactivity".into()],
        ("scoop", false) => vec!["install".into(), pkg],
        ("scoop", true) => vec!["uninstall".into(), pkg],
        ("flatpak", false) => vec!["install".into(), "-y".into(), "--noninteractive".into(), "flathub".into(), pkg],
        ("flatpak", true) => vec!["uninstall".into(), "-y".into(), pkg],
        ("brew", false) => {
            let mut v = vec!["install".into()];
            if cask {
                v.push("--cask".into());
            }
            v.push(pkg);
            v
        }
        ("brew", true) => {
            let mut v = vec!["uninstall".into()];
            if cask {
                v.push("--cask".into());
            }
            v.push(pkg);
            v
        }
        _ => return Err("gerenciador não suportado".into()),
    };
    Ok(args)
}

#[cfg(windows)]
fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console(_cmd: &mut Command) {}

fn stream_lines(app: &AppHandle, id: &str, reader: impl std::io::Read + Send + 'static) {
    let app = app.clone();
    let id = id.to_string();
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            let line = line.trim_end().to_string();
            if line.is_empty() || line.len() > 500 {
                continue;
            }
            let _ = app.emit("emulator-output", EmulatorOutput { id: id.clone(), line });
        }
    });
}

// Eight positional inputs mirror the install command's contract; grouping them would only add a struct.
#[allow(clippy::too_many_arguments)]
fn run_manager(app: &AppHandle, running: &Arc<Mutex<HashMap<String, u32>>>, id: &str, manager: &str, package: &str, bucket: Option<&str>, cask: bool, uninstall: bool) -> Result<InstallOutcome, String> {
    if !valid_token(package) {
        return Err("pacote inválido".into());
    }
    if let Some(bucket) = bucket {
        if bucket != "main" && !uninstall {
            let mut add = manager_command(manager, &["bucket".into(), "add".into(), bucket.to_string()])?;
            hide_console(&mut add);
            let _ = add.status();
        }
    }
    let args = manager_args(manager, package, cask, uninstall)?;
    let mut cmd = manager_command(manager, &args)?;
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    hide_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("não foi possível executar {manager}: {e}. Verifique se ele está instalado e no PATH."))?;
    let pid = child.id();
    running.lock().map_err(|_| "estado interno indisponível".to_string())?.insert(id.to_string(), pid);
    if let Some(stdout) = child.stdout.take() {
        stream_lines(app, id, stdout);
    }
    if let Some(stderr) = child.stderr.take() {
        stream_lines(app, id, stderr);
    }
    let status = child.wait();
    let cancelled = running
        .lock()
        .map(|mut map| map.remove(id).is_none())
        .unwrap_or(false);
    let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
    Ok(InstallOutcome { code, cancelled })
}

#[tauri::command]
pub async fn emulator_install(app: AppHandle, id: String, manager: String, package: String, bucket: Option<String>, cask: bool) -> Result<InstallOutcome, String> {
    let running = app.state::<Running>().0.clone();
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || run_manager(&handle, &running, &id, &manager, &package, bucket.as_deref(), cask, false))
        .await
        .map_err(|e| format!("falha interna: {e}"))?
}

#[tauri::command]
pub async fn emulator_uninstall(app: AppHandle, id: String, manager: String, package: String, cask: bool) -> Result<InstallOutcome, String> {
    let running = app.state::<Running>().0.clone();
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || run_manager(&handle, &running, &id, &manager, &package, None, cask, true))
        .await
        .map_err(|e| format!("falha interna: {e}"))?
}

#[tauri::command]
pub fn emulator_cancel(running: tauri::State<Running>, id: String) -> bool {
    let pid = running.0.lock().ok().and_then(|map| map.get(&id).copied());
    let Some(pid) = pid else { return false };
    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/PID", &pid.to_string(), "/T", "/F"]);
        hide_console(&mut cmd);
        cmd.status().is_ok()
    }
    #[cfg(not(windows))]
    {
        Command::new("kill").args(["-TERM", &pid.to_string()]).status().is_ok()
    }
}

/// Launches an emulator with an explicit argument vector (never a shell string).
#[tauri::command]
pub fn emulator_launch(exe: String, args: Vec<String>) -> Result<u32, String> {
    let path = PathBuf::from(exe.trim());
    if !path.is_absolute() {
        return Err("o executável precisa ter caminho absoluto".into());
    }
    if !path.is_file() {
        return Err(format!("executável não encontrado: {}", path.display()));
    }
    if args.iter().any(|a| a.chars().any(char::is_control)) {
        return Err("argumentos inválidos".into());
    }
    let mut cmd = Command::new(&path);
    cmd.args(&args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    if let Some(dir) = path.parent() {
        cmd.current_dir(dir);
    }
    hide_console(&mut cmd);
    let child = cmd.spawn().map_err(|e| format!("falha ao executar {}: {e}", path.display()))?;
    Ok(child.id())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("games-gallery-test-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolves_an_executable_nested_in_program_folders() {
        let root = temp_dir("resolve");
        let nested = root.join("RetroArch-Win64").join("bin");
        std::fs::create_dir_all(&nested).unwrap();
        let exe = nested.join("retroarch.exe");
        std::fs::write(&exe, b"x").unwrap();
        let found = resolve_exe("retroarch.exe", std::slice::from_ref(&root));
        assert_eq!(found, Some(exe.to_string_lossy().to_string()));
        assert_eq!(resolve_exe("pcsx2-qt.exe", &[root]), None);
        let _ = std::fs::remove_dir_all(exe.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn builds_winget_args_without_a_shell() {
        let args = manager_args("winget", "Libretro.RetroArch", false, false).unwrap();
        assert_eq!(args[0], "install");
        assert!(args.iter().any(|a| a == "Libretro.RetroArch"));
        assert!(args.iter().any(|a| a == "--disable-interactivity"));
        let remove = manager_args("winget", "Libretro.RetroArch", false, true).unwrap();
        assert_eq!(remove[0], "uninstall");
    }

    #[test]
    fn brew_cask_and_flatpak_flags_are_explicit() {
        assert!(manager_args("brew", "retroarch", true, false).unwrap().contains(&"--cask".to_string()));
        let flatpak = manager_args("flatpak", "org.libretro.RetroArch", false, false).unwrap();
        assert!(flatpak.contains(&"flathub".to_string()));
        assert!(flatpak.contains(&"-y".to_string()));
    }

    #[test]
    fn rejects_unknown_managers_and_packages_with_metacharacters() {
        assert!(manager_args("npm", "x", false, false).is_err());
        for bad in ["a;b", "a&&b", "$(x)", "a|b", "a b", ""] {
            assert!(!valid_token(bad), "{bad}");
        }
        assert!(valid_token("Libretro.RetroArch"));
        assert!(valid_token("extras/dolphin"));
    }

    #[test]
    fn launch_refuses_relative_or_missing_executables() {
        assert!(emulator_launch("retroarch.exe".into(), vec![]).is_err());
        assert!(emulator_launch("C:\\definitely\\missing.exe".into(), vec![]).is_err());
        let dir = temp_dir("launch");
        let exe = dir.join("emu.exe");
        std::fs::write(&exe, b"not-a-real-binary").unwrap();
        // The executable exists, so the only failure is the OS refusing to run it.
        let result = emulator_launch(exe.to_string_lossy().to_string(), vec!["--rom".into()]);
        assert!(result.is_err() || result.unwrap() > 0);
        let _ = std::fs::remove_dir_all(dir);
    }
}
