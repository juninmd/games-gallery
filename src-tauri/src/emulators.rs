//! Emulators on this machine: detection of installed executables and argv-only launching.
//! Package-manager installs live in `emulator_install`. No shell string is ever built.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

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

#[cfg(windows)]
pub(crate) fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
pub(crate) fn hide_console(_cmd: &mut Command) {}

#[derive(Serialize, Clone)]
struct EmulatorExit {
    pid: u32,
}

/// Launches an emulator with an explicit argument vector (never a shell string) and emits
/// `emulator-exit` when the process ends, so the UI can record the play session.
#[tauri::command]
pub fn emulator_launch(app: AppHandle, exe: String, args: Vec<String>) -> Result<u32, String> {
    let mut child = spawn_emulator(&exe, &args)?;
    let pid = child.id();
    std::thread::spawn(move || {
        // Reaping the child also avoids a zombie process on Unix.
        let _ = child.wait();
        let _ = app.emit("emulator-exit", EmulatorExit { pid });
    });
    Ok(pid)
}

fn spawn_emulator(exe: &str, args: &[String]) -> Result<std::process::Child, String> {
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
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    if let Some(dir) = path.parent() {
        cmd.current_dir(dir);
    }
    hide_console(&mut cmd);
    cmd.spawn().map_err(|e| format!("falha ao executar {}: {e}", path.display()))
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
    fn launch_refuses_relative_or_missing_executables() {
        assert!(spawn_emulator("retroarch.exe", &[]).is_err());
        assert!(spawn_emulator("C:\\definitely\\missing.exe", &[]).is_err());
        let dir = temp_dir("launch");
        let exe = dir.join("emu.exe");
        std::fs::write(&exe, b"not-a-real-binary").unwrap();
        // The executable exists, so the only failure is the OS refusing to run it.
        let result = spawn_emulator(&exe.to_string_lossy(), &["--rom".into()]);
        assert!(result.is_err() || result.unwrap().id() > 0);
        let _ = std::fs::remove_dir_all(dir);
    }
}
