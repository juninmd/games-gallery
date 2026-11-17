//! Windows "Add/Remove Programs" entries, shared by the launcher scanners that need real titles.

use crate::detect::{reg_string, reg_subkeys, DetectedGame, Hive, ProviderDetection};
use std::path::{Path, PathBuf};

const UNINSTALL_PATHS: [&str; 2] = [
    "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct UninstallEntry {
    pub key: String,
    pub name: String,
    pub publisher: String,
    pub location: String,
}

/// Every uninstall entry that has a display name (both registry views, machine hive).
pub(crate) fn uninstall_entries() -> Vec<UninstallEntry> {
    let mut out = Vec::new();
    for base in UNINSTALL_PATHS {
        for key in reg_subkeys(Hive::LocalMachine, base) {
            let path = format!("{base}\\{key}");
            let Some(name) = reg_string(Hive::LocalMachine, &path, "DisplayName") else { continue };
            out.push(UninstallEntry {
                publisher: reg_string(Hive::LocalMachine, &path, "Publisher").unwrap_or_default(),
                location: reg_string(Hive::LocalMachine, &path, "InstallLocation").unwrap_or_default(),
                key,
                name,
            });
        }
    }
    out
}

/// Comparable form of a path: lowercase, backslashes, no trailing separator.
pub(crate) fn norm_path(p: &str) -> String {
    p.trim().trim_matches('"').replace('/', "\\").trim_end_matches('\\').to_lowercase()
}

/// A registry value is only trusted when the folder it names is really there.
pub(crate) fn existing_dir(p: &str) -> Option<PathBuf> {
    let trimmed = p.trim().trim_matches('"');
    if trimmed.is_empty() {
        return None;
    }
    let path = Path::new(trimmed);
    path.is_dir().then(|| path.to_path_buf())
}

/// Last-resort title: the folder name of an install directory.
pub(crate) fn folder_name(dir: &str) -> Option<String> {
    let name = dir.trim().trim_end_matches(['\\', '/']).rsplit(['\\', '/']).next()?.trim();
    (!name.is_empty()).then(|| name.to_string())
}

/// Rockstar Games Launcher: one registry subkey per installed title.
pub fn scan_rockstar() -> ProviderDetection {
    let path = "SOFTWARE\\WOW6432Node\\Rockstar Games";
    let subkeys = reg_subkeys(Hive::LocalMachine, path);
    if subkeys.is_empty() {
        return ProviderDetection::unavailable("rockstar", "registro do Windows", "Rockstar Games Launcher não está instalado.");
    }
    let mut games = Vec::new();
    for name in subkeys {
        let Some(dir) = reg_string(Hive::LocalMachine, &format!("{path}\\{name}"), "InstallFolder") else { continue };
        games.push(DetectedGame {
            store_id: name.clone(),
            title: name,
            size_gb: None,
            installed: true,
            install_path: Some(dir),
            playtime_h: None,
        });
    }
    if games.is_empty() {
        return ProviderDetection::unavailable("rockstar", "registro do Windows", "Não há jogos da Rockstar com pasta de instalação registrada.");
    }
    ProviderDetection::from_games("rockstar", "registro do Windows", games, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_paths_for_comparison() {
        assert_eq!(norm_path("\"C:/Games/Foo/\""), "c:\\games\\foo");
        assert_eq!(norm_path("C:\\Games\\Foo"), norm_path("c:\\games\\foo\\"));
    }

    #[test]
    fn folder_name_handles_both_separators_and_empties() {
        assert_eq!(folder_name("C:\\Games\\Foo Bar\\"), Some("Foo Bar".into()));
        assert_eq!(folder_name("/opt/games/baz"), Some("baz".into()));
        assert_eq!(folder_name("  "), None);
    }

    #[test]
    fn existing_dir_rejects_blank_and_missing() {
        assert!(existing_dir("").is_none());
        assert!(existing_dir("Z:\\definitely\\not\\here\\gg-test").is_none());
        assert!(existing_dir(&std::env::temp_dir().to_string_lossy()).is_some());
    }
}
