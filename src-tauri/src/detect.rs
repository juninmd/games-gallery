//! Local library detection: everything here reads files that the real launchers leave on disk.
//! Nothing is invented; a source that is absent is reported as unavailable with a reason.

use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(windows)]
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
#[cfg(windows)]
use winreg::RegKey;

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DetectedGame {
    pub store_id: String,
    pub title: String,
    pub size_gb: Option<f64>,
    pub installed: bool,
    pub install_path: Option<String>,
    pub playtime_h: Option<f64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDetection {
    pub provider_id: String,
    pub source: String,
    pub available: bool,
    pub note: Option<String>,
    pub games: Vec<DetectedGame>,
}

impl ProviderDetection {
    pub(crate) fn unavailable(provider_id: &str, source: &str, note: &str) -> Self {
        Self {
            provider_id: provider_id.into(),
            source: source.into(),
            available: false,
            note: Some(note.into()),
            games: Vec::new(),
        }
    }

    pub(crate) fn from_games(provider_id: &str, source: &str, games: Vec<DetectedGame>, note: Option<String>) -> Self {
        Self {
            provider_id: provider_id.into(),
            source: source.into(),
            available: note.is_none(),
            note,
            games,
        }
    }
}

pub(crate) fn size_gb(bytes: u64) -> f64 {
    ((bytes as f64 / 1024f64.powi(3)) * 10.0).round() / 10.0
}

pub(crate) fn home() -> PathBuf {
    PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default())
}

pub(crate) fn program_data() -> PathBuf {
    PathBuf::from(std::env::var("ProgramData").unwrap_or_default())
}

pub(crate) fn app_data() -> PathBuf {
    PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
}

pub(crate) fn local_app_data() -> PathBuf {
    PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_default())
}

fn same_path(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase().replace('/', "\\") == b.to_string_lossy().to_lowercase().replace('/', "\\")
}

/// Quoted KeyValues field: `"name"    "value"`.
fn kv_field(text: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    for line in text.lines() {
        let line = line.trim();
        let Some(rest) = line.strip_prefix(&needle) else { continue };
        let rest = rest.trim_start();
        let Some(rest) = rest.strip_prefix('"') else { continue };
        if let Some(end) = rest.find('"') {
            return Some(rest[..end].to_string());
        }
    }
    None
}

// ---------------------------------------------------------------- Steam

fn steam_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Some(path) = reg_string(Hive::CurrentUser, "Software\\Valve\\Steam", "SteamPath") {
        roots.push(PathBuf::from(path.replace('/', "\\")));
    }
    for sub in ["SOFTWARE\\WOW6432Node\\Valve\\Steam", "SOFTWARE\\Valve\\Steam"] {
        if let Some(path) = reg_string(Hive::LocalMachine, sub, "InstallPath") {
            roots.push(PathBuf::from(path));
        }
    }
    roots.push(PathBuf::from("C:\\Program Files (x86)\\Steam"));
    roots.retain(|p| p.join("steamapps").is_dir());
    roots
}

/// Every `"path" "..."` entry of libraryfolders.vdf, unescaped.
fn vdf_library_paths(text: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        let Some(rest) = line.strip_prefix("\"path\"") else { continue };
        let rest = rest.trim_start();
        let Some(rest) = rest.strip_prefix('"') else { continue };
        let Some(end) = rest.find('"') else { continue };
        let raw = rest[..end].replace("\\\\", "\\");
        if !raw.is_empty() {
            out.push(PathBuf::from(raw));
        }
    }
    out
}

fn is_steam_tool(name: &str) -> bool {
    let n = name.trim().to_lowercase();
    n.starts_with("steamworks common redistributables")
        || n.starts_with("proton")
        || n.starts_with("steam linux runtime")
        || n == "steamvr"
}

pub fn scan_steam() -> ProviderDetection {
    let roots = steam_roots();
    if roots.is_empty() {
        return ProviderDetection::unavailable(
            "steam",
            "appmanifest_*.acf",
            "Steam não encontrado neste computador (nem no registro, nem em Program Files).",
        );
    }

    let mut libraries: Vec<PathBuf> = Vec::new();
    for root in &roots {
        if !libraries.iter().any(|l| same_path(l, root)) {
            libraries.push(root.clone());
        }
        let vdf = root.join("steamapps").join("libraryfolders.vdf");
        if let Ok(text) = fs::read_to_string(&vdf) {
            for path in vdf_library_paths(&text) {
                if path.join("steamapps").is_dir() && !libraries.iter().any(|l| same_path(l, &path)) {
                    libraries.push(path);
                }
            }
        }
    }

    let mut games = Vec::new();
    let mut seen = HashSet::new();
    for library in &libraries {
        let steamapps = library.join("steamapps");
        let Ok(entries) = fs::read_dir(&steamapps) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let lower = name.to_lowercase();
            if !lower.starts_with("appmanifest_") || !lower.ends_with(".acf") {
                continue;
            }
            let Ok(text) = fs::read_to_string(entry.path()) else { continue };
            let Some(app_id) = kv_field(&text, "appid") else { continue };
            let Some(title) = kv_field(&text, "name") else { continue };
            if is_steam_tool(&title) || !seen.insert(app_id.clone()) {
                continue;
            }
            let size = kv_field(&text, "SizeOnDisk").and_then(|v| v.parse::<u64>().ok()).map(size_gb);
            games.push(DetectedGame {
                store_id: app_id,
                title,
                size_gb: size,
                installed: true,
                install_path: None,
                playtime_h: None,
            });
        }
    }

    ProviderDetection::from_games("steam", "appmanifest_*.acf", games, None)
}

// ---------------------------------------------------------------- registry-based launchers

#[derive(Clone, Copy)]
pub(crate) enum Hive {
    CurrentUser,
    LocalMachine,
}

#[cfg(windows)]
pub(crate) fn reg_string(hive: Hive, path: &str, value: &str) -> Option<String> {
    let root = match hive {
        Hive::CurrentUser => RegKey::predef(HKEY_CURRENT_USER),
        Hive::LocalMachine => RegKey::predef(HKEY_LOCAL_MACHINE),
    };
    let key = root.open_subkey(path).ok()?;
    key.get_value::<String, _>(value).ok().filter(|s| !s.trim().is_empty())
}

#[cfg(not(windows))]
pub(crate) fn reg_string(_hive: Hive, _path: &str, _value: &str) -> Option<String> {
    None
}

#[cfg(windows)]
pub(crate) fn reg_subkeys(hive: Hive, path: &str) -> Vec<String> {
    let root = match hive {
        Hive::CurrentUser => RegKey::predef(HKEY_CURRENT_USER),
        Hive::LocalMachine => RegKey::predef(HKEY_LOCAL_MACHINE),
    };
    let Ok(key) = root.open_subkey(path) else { return Vec::new() };
    key.enum_keys().flatten().collect()
}

#[cfg(not(windows))]
pub(crate) fn reg_subkeys(_hive: Hive, _path: &str) -> Vec<String> {
    Vec::new()
}

// ---------------------------------------------------------------- entry point

/// Scans every launcher that stores its library locally. Sources that need a login are not invented:
/// they come back unavailable with the reason the UI shows.
#[tauri::command]
pub async fn detect_libraries() -> Vec<ProviderDetection> {
    tauri::async_runtime::spawn_blocking(detect_libraries_sync).await.unwrap_or_default()
}

/// Synchronous body, used by the command (in a blocking thread) and by `examples/detect.rs`.
pub fn detect_libraries_sync() -> Vec<ProviderDetection> {
    let all = vec![
        scan_steam(),
        crate::detect_epic::scan_epic(),
        crate::detect_epic::scan_legendary(),
        crate::detect_epic::scan_heroic("gog", "gog_library.json"),
        crate::detect_epic::scan_heroic("amazon", "nile_library.json"),
        crate::detect_sqlite::scan_gog(),
        crate::detect_sqlite::scan_itch(),
        crate::detect_sqlite::scan_amazon(),
        crate::detect_ubisoft::scan_ubisoft(),
        crate::detect_registry::scan_rockstar(),
        crate::detect_battlenet::scan_battlenet(),
        crate::detect_ea::scan_ea(),
        crate::detect_xbox::scan_xbox(),
        ProviderDetection::unavailable("playnite", "games.db", "Playnite não está instalado; o banco é LiteDB, não SQLite."),
        ProviderDetection::unavailable("heroic", "config do Heroic", "Heroic/Lutris não encontrado (Linux/Windows)."),
        ProviderDetection::unavailable("humble", "Humble API", "A Humble só expõe a biblioteca com login na sua conta."),
        ProviderDetection::unavailable("psn", "PSN", "Exige login PSN; não existe API pública."),
        ProviderDetection::unavailable("xbl", "Xbox Live", "Exige login Microsoft (XSTS)."),
        ProviderDetection::unavailable("nintendo", "eShop", "Sem API pública; cadastro manual."),
        ProviderDetection::unavailable("psplus", "PS Blog", "Lido na tela Jogos grátis, não é uma biblioteca."),
    ];
    all
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_every_path_of_a_library_folders_file() {
        let vdf = r#"
"libraryfolders"
{
	"0"
	{
		"path"		"C:\\Program Files (x86)\\Steam"
	}
	"1"
	{
		"path"		"D:\\SteamLibrary"
	}
}"#;
        let paths = vdf_library_paths(vdf);
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0], PathBuf::from("C:\\Program Files (x86)\\Steam"));
        assert_eq!(paths[1], PathBuf::from("D:\\SteamLibrary"));
    }

    #[test]
    fn parses_flat_keyvalues_and_ignores_similar_keys() {
        let acf = "\"AppState\"\n{\n\t\"appid\"\t\t\"1091500\"\n\t\"name\"\t\t\"Cyberpunk 2077\"\n\t\"SizeOnDisk\"\t\t\"72086954886\"\n\t\"name2\"\t\t\"nope\"\n}";
        assert_eq!(kv_field(acf, "appid"), Some("1091500".into()));
        assert_eq!(kv_field(acf, "name"), Some("Cyberpunk 2077".into()));
        assert_eq!(kv_field(acf, "missing"), None);
    }

    #[test]
    fn skips_steam_runtimes_and_measures_gigabytes() {
        for tool in ["Steamworks Common Redistributables", "Proton 9.0", "Steam Linux Runtime - Soldier", "SteamVR"] {
            assert!(is_steam_tool(tool), "{tool}");
        }
        assert!(!is_steam_tool("Cyberpunk 2077"));
        assert_eq!(size_gb(1024 * 1024 * 1024), 1.0);
        assert_eq!(size_gb(72086954886), 67.1);
    }
}
