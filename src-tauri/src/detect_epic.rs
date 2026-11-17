//! Epic Games Launcher manifests plus the open clients that wrap Epic, GOG and Amazon
//! (Legendary, Heroic). Only files those clients leave on disk are read.

use crate::detect::{app_data, home, program_data, size_gb, DetectedGame, ProviderDetection};
use serde_json::Value;
use std::fs;
use std::path::Path;

// ---------------------------------------------------------------- Epic

fn read_json(path: &Path) -> Option<Value> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn json_str(v: &Value, key: &str) -> Option<String> {
    v.get(key)?.as_str().map(|s| s.to_string()).filter(|s| !s.is_empty())
}

fn json_u64(v: &Value, key: &str) -> Option<u64> {
    v.get(key)?.as_u64().or_else(|| v.get(key)?.as_f64().map(|f| f as u64))
}

pub fn scan_epic() -> ProviderDetection {
    let dir = program_data().join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests");
    if !dir.is_dir() {
        return ProviderDetection::unavailable(
            "epic",
            "*.item (Epic Games Launcher)",
            "Manifests do Epic Games Launcher não encontrados em ProgramData/Epic.",
        );
    }
    let mut games = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if !name.ends_with(".item") {
                continue;
            }
            let Some(manifest) = read_json(&entry.path()) else { continue };
            let (Some(app_name), Some(title)) = (json_str(&manifest, "AppName"), json_str(&manifest, "DisplayName")) else { continue };
            let incomplete = manifest.get("bIsIncompleteInstall").and_then(|v| v.as_bool()).unwrap_or(false);
            games.push(DetectedGame {
                store_id: app_name,
                title,
                size_gb: json_u64(&manifest, "InstallSize").map(size_gb),
                installed: !incomplete,
                install_path: json_str(&manifest, "InstallLocation"),
                playtime_h: None,
            });
        }
    }
    ProviderDetection::from_games("epic", "*.item (Epic Games Launcher)", games, None)
}

/// Legendary keeps its own installed.json with the games it deployed.
pub fn scan_legendary() -> ProviderDetection {
    let path = home().join(".config").join("legendary").join("installed.json");
    let Some(json) = read_json(&path) else {
        return ProviderDetection::unavailable("epic", "Legendary", "Legendary não está instalado (sem installed.json).");
    };
    let mut games = Vec::new();
    if let Some(list) = json.get("games").and_then(|v| v.as_array()) {
        for g in list {
            let (Some(app_name), Some(title)) = (json_str(g, "app_name"), json_str(g, "title")) else { continue };
            let install_path = json_str(g, "install_path");
            games.push(DetectedGame {
                store_id: app_name,
                title,
                size_gb: json_u64(g, "install_size").map(size_gb),
                installed: install_path.is_some(),
                install_path,
                playtime_h: None,
            });
        }
    }
    ProviderDetection::from_games("epic", "Legendary", games, None)
}

/// Heroic aggregates Epic/GOG/Amazon; each cache file is a JSON array of the accounts' games.
/// Only entries with an install path are installed on this machine.
pub fn scan_heroic(provider_id: &str, file: &str) -> ProviderDetection {
    let path = app_data().join("heroic").join("store_cache").join(file);
    let Some(json) = read_json(&path) else {
        return ProviderDetection::unavailable(provider_id, "Heroic store_cache", "Heroic não encontrado (sem store_cache).");
    };
    let mut games = Vec::new();
    if let Some(list) = json.as_array() {
        for g in list {
            let Some(title) = json_str(g, "title") else { continue };
            let Some(install_path) = json_str(g, "install_path") else { continue };
            let store_id = json_str(g, "app_name").or_else(|| json_str(g, "id")).unwrap_or_else(|| title.clone());
            games.push(DetectedGame {
                store_id,
                title,
                size_gb: json_u64(g, "install_size").map(size_gb),
                installed: true,
                install_path: Some(install_path),
                playtime_h: None,
            });
        }
    }
    ProviderDetection::from_games(provider_id, "Heroic store_cache", games, None)
}
