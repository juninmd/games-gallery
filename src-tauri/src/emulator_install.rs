//! Real package-manager runs (winget, scoop, flatpak, brew) for emulators, with streamed output
//! and cancellation. Arguments are an explicit vector; no shell string is ever built.

use crate::emulators::hide_console;
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
