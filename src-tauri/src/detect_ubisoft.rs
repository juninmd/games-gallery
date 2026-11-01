//! Ubisoft Connect: installed games come from the registry. The owned library lives in
//! `cache/ownership/*.vdat` and `cache/configuration/*.vdat`, which are encrypted with the user's
//! DPAPI-bound `ConnectSecureStorage.dat`. They (and the legacy ownership cache, which holds CD keys)
//! are deliberately never opened here.

use crate::detect::{local_app_data, reg_string, reg_subkeys, DetectedGame, Hive, ProviderDetection};
use crate::detect_registry::{existing_dir, folder_name, norm_path, uninstall_entries, UninstallEntry};
use std::collections::HashSet;

const INSTALLS: [(Hive, &str); 3] = [
    (Hive::LocalMachine, "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs"),
    (Hive::LocalMachine, "SOFTWARE\\Ubisoft\\Launcher\\Installs"),
    (Hive::CurrentUser, "SOFTWARE\\Ubisoft\\Launcher\\Installs"),
];

const SOURCE: &str = "registro do Windows";
const LIMIT_NOTE: &str = "Jogos comprados e não instalados não são listados: o cache de posse do Ubisoft Connect é criptografado (DPAPI).";

/// One `Installs\<id>` registry entry: the Ubisoft game id and its `InstallDir`.
pub(crate) type RegisteredInstall = (String, String);

/// `Uplay Install <id>` uninstall entries carry the real display name of each game.
fn titles_by_id(entries: &[UninstallEntry]) -> std::collections::HashMap<String, String> {
    entries
        .iter()
        .filter_map(|e| {
            let id = e.key.strip_prefix("Uplay Install ")?.trim();
            (!id.is_empty()).then(|| (id.to_string(), e.name.clone()))
        })
        .collect()
}

/// Pure join of registry installs and uninstall titles; folders that do not exist are dropped.
pub(crate) fn build_games(installs: &[RegisteredInstall], entries: &[UninstallEntry]) -> Vec<DetectedGame> {
    let titles = titles_by_id(entries);
    let mut seen = HashSet::new();
    let mut games = Vec::new();
    for (id, dir) in installs {
        let Some(path) = existing_dir(dir) else { continue };
        if !seen.insert(id.clone()) {
            continue;
        }
        let title = titles.get(id).cloned().or_else(|| folder_name(dir)).unwrap_or_else(|| id.clone());
        games.push(DetectedGame {
            store_id: id.clone(),
            title,
            installed: true,
            install_path: Some(path.to_string_lossy().into_owned()),
            ..Default::default()
        });
    }
    // An uninstall entry whose folder is not in `Installs` is still a real install.
    let known: HashSet<String> = games.iter().filter_map(|g| g.install_path.as_deref().map(norm_path)).collect();
    for e in entries.iter().filter(|e| e.key.starts_with("Uplay Install ")) {
        let Some(path) = existing_dir(&e.location) else { continue };
        let id = e.key.trim_start_matches("Uplay Install ").trim().to_string();
        if known.contains(&norm_path(&e.location)) || !seen.insert(id.clone()) {
            continue;
        }
        games.push(DetectedGame {
            store_id: id,
            title: e.name.clone(),
            installed: true,
            install_path: Some(path.to_string_lossy().into_owned()),
            ..Default::default()
        });
    }
    games
}

fn launcher_present() -> bool {
    local_app_data().join("Ubisoft Game Launcher").is_dir()
        || INSTALLS.iter().any(|(h, p)| !reg_subkeys(*h, p).is_empty())
        || reg_string(Hive::LocalMachine, "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher", "InstallDir").is_some()
}

pub fn scan_ubisoft() -> ProviderDetection {
    if !launcher_present() {
        return ProviderDetection::unavailable("ubisoft", SOURCE, "Ubisoft Connect não está instalado.");
    }
    let mut installs: Vec<RegisteredInstall> = Vec::new();
    for (hive, path) in INSTALLS {
        for id in reg_subkeys(hive, path) {
            if let Some(dir) = reg_string(hive, &format!("{path}\\{id}"), "InstallDir") {
                installs.push((id, dir));
            }
        }
    }
    let games = build_games(&installs, &uninstall_entries());
    if games.is_empty() {
        return ProviderDetection::unavailable("ubisoft", SOURCE, &format!("Ubisoft Connect instalado, sem jogos instalados registrados. {LIMIT_NOTE}"));
    }
    let mut detection = ProviderDetection::from_games("ubisoft", SOURCE, games, None);
    detection.note = Some(LIMIT_NOTE.into());
    detection
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, name: &str, location: &str) -> UninstallEntry {
        UninstallEntry { key: key.into(), name: name.into(), location: location.into(), ..Default::default() }
    }

    fn tmp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("games-gallery-ubi-{name}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn uses_uninstall_title_and_falls_back_to_folder_name() {
        let a = tmp("titled");
        let b = tmp("Folder Only");
        let installs = vec![("100".to_string(), a.to_string_lossy().into_owned()), ("200".to_string(), b.to_string_lossy().into_owned())];
        let entries = vec![entry("Uplay Install 100", "Fake Game One", "")];
        let games = build_games(&installs, &entries);
        assert_eq!(games.len(), 2);
        assert_eq!(games[0].title, "Fake Game One");
        assert_eq!(games[1].title, "games-gallery-ubi-Folder Only");
    }

    #[test]
    fn drops_missing_dirs_and_duplicate_ids() {
        let a = tmp("dup");
        let p = a.to_string_lossy().into_owned();
        let installs = vec![("1".to_string(), p.clone()), ("1".to_string(), p), ("2".to_string(), "Z:\\nope\\gg".to_string())];
        assert_eq!(build_games(&installs, &[]).len(), 1);
    }

    #[test]
    fn uninstall_only_entries_are_added_once() {
        let a = tmp("uninst");
        let loc = a.to_string_lossy().into_owned();
        let entries = vec![entry("Uplay Install 7", "Fake Game Seven", &loc), entry("Other App", "Not Ubisoft", &loc)];
        let games = build_games(&[], &entries);
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].store_id, "7");
        // Same folder already listed through Installs: no duplicate.
        let again = build_games(&[("7".to_string(), loc)], &entries);
        assert_eq!(again.len(), 1);
    }
}
