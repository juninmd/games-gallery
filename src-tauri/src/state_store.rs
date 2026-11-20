//! App state on disk: one JSON file per persisted store in the app data folder, replacing the
//! WebView's localStorage (a few MB cap, cleared with the browser profile). See docs/adr/0001.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MAX_BYTES: usize = 64 * 1024 * 1024;

/// Only the app's own store names reach the disk; the file name is derived, never taken as a path.
fn file_for(dir: &Path, key: &str) -> Result<PathBuf, String> {
    let name = key.strip_prefix("games-gallery:").ok_or("Chave de estado inválida")?;
    let ok = !name.is_empty() && name.len() <= 64 && name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == ':' || c == '-');
    if !ok {
        return Err("Chave de estado inválida".into());
    }
    Ok(dir.join(format!("{}.json", name.replace(':', "_"))))
}

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("state"))
}

/// A file that is not valid JSON (e.g. truncated by a crash outside the rename) is moved aside
/// instead of returned, so the next write cannot silently replace it with an empty state.
fn read(dir: &Path, key: &str) -> Result<Option<String>, String> {
    let path = file_for(dir, key)?;
    match std::fs::read_to_string(&path) {
        Ok(text) if serde_json::from_str::<serde_json::Value>(&text).is_ok() => Ok(Some(text)),
        Ok(_) => {
            std::fs::rename(&path, path.with_extension("corrupt.json")).map_err(|e| e.to_string())?;
            Ok(None)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Write then rename, so a crash mid-write leaves the previous state intact.
fn write(dir: &Path, key: &str, value: &str) -> Result<(), String> {
    if value.len() > MAX_BYTES {
        return Err("Estado excede o limite de tamanho".into());
    }
    let path = file_for(dir, key)?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    crate::atomic_write::write_atomic(&path, value.as_bytes()).map_err(|e| e.to_string())
}

fn remove(dir: &Path, key: &str) -> Result<(), String> {
    match std::fs::remove_file(file_for(dir, key)?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn state_read(app: AppHandle, key: String) -> Result<Option<String>, String> {
    read(&dir(&app)?, &key)
}

#[tauri::command]
pub fn state_write(app: AppHandle, key: String, value: String) -> Result<(), String> {
    write(&dir(&app)?, &key, &value)
}

#[tauri::command]
pub fn state_remove(app: AppHandle, key: String) -> Result<(), String> {
    remove(&dir(&app)?, &key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_app_keys_map_to_files_inside_the_folder() {
        let dir = Path::new("/data/state");
        assert_eq!(file_for(dir, "games-gallery:sessions:v1").unwrap(), dir.join("sessions_v1.json"));
        assert_eq!(file_for(dir, "games-gallery:v1").unwrap(), dir.join("v1.json"));
        for bad in ["other:v1", "games-gallery:", "games-gallery:../x", "games-gallery:a/b", "games-gallery:A", "games-gallery:a\\b"] {
            assert!(file_for(dir, bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn round_trips_overwrites_and_removes() {
        let dir = std::env::temp_dir().join(format!("gg-state-{}", std::process::id()));
        let key = "games-gallery:test:v1";
        assert_eq!(read(&dir, key).unwrap(), None);
        write(&dir, key, "{\"a\":1}").unwrap();
        write(&dir, key, "{\"a\":2}").unwrap();
        assert_eq!(read(&dir, key).unwrap().as_deref(), Some("{\"a\":2}"));
        assert!(std::fs::read_dir(&dir).unwrap().all(|e| e.unwrap().path().extension().is_some_and(|x| x != "part")));
        remove(&dir, key).unwrap();
        remove(&dir, key).unwrap();
        assert_eq!(read(&dir, key).unwrap(), None);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn corrupt_files_are_moved_aside_not_returned() {
        let dir = std::env::temp_dir().join(format!("gg-state-bad-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("lib_v1.json"), "{\"state\":{\"games\":[").unwrap();
        assert_eq!(read(&dir, "games-gallery:lib:v1").unwrap(), None);
        assert!(dir.join("lib_v1.corrupt.json").exists());
        let _ = std::fs::remove_dir_all(dir);
    }
}
