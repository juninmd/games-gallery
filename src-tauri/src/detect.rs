//! Local library detection: everything here reads files that the real launchers leave on disk.
//! Nothing is invented; a source that is absent is reported as unavailable with a reason.

use serde::Serialize;
use serde_json::Value;
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

fn size_gb(bytes: u64) -> f64 {
    ((bytes as f64 / 1024f64.powi(3)) * 10.0).round() / 10.0
}

fn home() -> PathBuf {
    PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default())
}

pub(crate) fn program_data() -> PathBuf {
    PathBuf::from(std::env::var("ProgramData").unwrap_or_default())
}

fn app_data() -> PathBuf {
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

// ---------------------------------------------------------------- GOG Galaxy (SQLite)

pub(crate) fn open_sqlite_readonly(path: &Path) -> Option<rusqlite::Connection> {
    use rusqlite::OpenFlags;
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    rusqlite::Connection::open_with_flags(path, flags).ok()
}

pub fn scan_gog() -> ProviderDetection {
    let db = program_data().join("GOG.com").join("Galaxy").join("storage").join("galaxy-2.0.db");
    if !db.is_file() {
        return ProviderDetection::unavailable("gog", "galaxy-2.0.db", "Banco do GOG Galaxy não encontrado em ProgramData/GOG.com.");
    }
    let Some(conn) = open_sqlite_readonly(&db) else {
        return ProviderDetection::unavailable("gog", "galaxy-2.0.db", "O banco do GOG Galaxy está aberto por outro processo ou exigiu permissão de administrador.");
    };

    let mut installed: HashSet<i64> = HashSet::new();
    let mut install_paths: std::collections::HashMap<i64, String> = std::collections::HashMap::new();
    if let Ok(mut stmt) = conn.prepare("select productId, installationPath from InstalledBaseProducts") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let path: Option<String> = row.get(1)?;
            Ok((id, path))
        }) {
            for row in rows.flatten() {
                installed.insert(row.0);
                if let Some(p) = row.1 {
                    install_paths.insert(row.0, p);
                }
            }
        }
    }

    let query = "select lr.releaseKey,
        (select gp.value from GamePieces gp where gp.releaseKey = lr.releaseKey and gp.gamePieceTypeId = 783 limit 1) as title,
        (select p.gogId from ProductsToReleaseKeys p where p.releaseKey = lr.releaseKey and p.gogId is not null limit 1) as gog_id,
        (select ds.diskSize from DiskSizes ds where ds.gameReleaseKey = lr.releaseKey limit 1) as size
      from LibraryReleases lr
      where lr.releaseKey like 'gog\\_%' escape '\\'";

    let mut games = Vec::new();
    let Ok(mut stmt) = conn.prepare(query) else {
        return ProviderDetection::unavailable("gog", "galaxy-2.0.db", "Não foi possível ler a tabela de biblioteca do GOG Galaxy.");
    };
    let Ok(rows) = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        let title: Option<String> = row.get(1)?;
        let gog_id: Option<i64> = row.get(2)?;
        let size: Option<i64> = row.get(3)?;
        Ok((key, title, gog_id, size))
    }) else {
        return ProviderDetection::unavailable("gog", "galaxy-2.0.db", "Não foi possível consultar a biblioteca do GOG Galaxy.");
    };

    for (key, title, gog_id, size) in rows.flatten() {
        let Some(raw_title) = title else { continue };
        let parsed: Value = serde_json::from_str(&raw_title).unwrap_or(Value::Null);
        let Some(title) = parsed.get("title").and_then(|v| v.as_str()).map(|s| s.to_string()) else { continue };
        let store_id = gog_id.map(|id| id.to_string()).unwrap_or_else(|| key.trim_start_matches("gog_").to_string());
        let is_installed = gog_id.map(|id| installed.contains(&id)).unwrap_or(false);
        games.push(DetectedGame {
            store_id,
            title,
            size_gb: size.map(|s| size_gb(s.max(0) as u64)),
            installed: is_installed,
            install_path: gog_id.and_then(|id| install_paths.get(&id).cloned()),
            playtime_h: None,
        });
    }

    ProviderDetection::from_games("gog", "galaxy-2.0.db", games, None)
}

// ---------------------------------------------------------------- itch.io (butler.db)

pub fn scan_itch() -> ProviderDetection {
    let db = app_data().join("itch").join("db").join("butler.db");
    if !db.is_file() {
        return ProviderDetection::unavailable("itch", "butler.db", "itch.io não está instalado (sem butler.db).");
    }
    let Some(conn) = open_sqlite_readonly(&db) else {
        return ProviderDetection::unavailable("itch", "butler.db", "Não foi possível abrir o banco local do itch.io.");
    };
    let query = "select g.id, g.title, c.path from caves c join games g on g.id = c.game_id";
    let mut games = Vec::new();
    if let Ok(mut stmt) = conn.prepare(query) {
        if let Ok(rows) = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let title: String = row.get(1)?;
            let path: Option<String> = row.get(2)?;
            Ok((id, title, path))
        }) {
            // itch://games/<id> needs the numeric game id, not the title.
            for (id, title, path) in rows.flatten() {
                games.push(DetectedGame {
                    store_id: id.to_string(),
                    title,
                    size_gb: None,
                    installed: path.is_some(),
                    install_path: path,
                    playtime_h: None,
                });
            }
        }
    }
    ProviderDetection::from_games("itch", "butler.db", games, None)
}

// ---------------------------------------------------------------- Amazon Games (SQLite)

/// The Amazon launcher uses a small SQLite DB whose table name changes between builds, so the
/// table is located by its columns instead of a hardcoded name.
pub fn scan_amazon() -> ProviderDetection {
    let db = local_app_data()
        .join("Amazon Games")
        .join("Data")
        .join("Games")
        .join("Sql")
        .join("GameInstallInfo.sqlite");
    if !db.is_file() {
        return ProviderDetection::unavailable("amazon", "GameInstallInfo.sqlite", "Amazon Games não está instalado.");
    }
    let Some(conn) = open_sqlite_readonly(&db) else {
        return ProviderDetection::unavailable("amazon", "GameInstallInfo.sqlite", "Não foi possível abrir o banco do Amazon Games.");
    };

    let tables: Vec<String> = conn
        .prepare("select name from sqlite_master where type = 'table'")
        .and_then(|mut s| {
            let rows = s.query_map([], |row| row.get::<_, String>(0))?;
            Ok(rows.flatten().collect())
        })
        .unwrap_or_default();

    let mut games = Vec::new();
    for table in tables {
        let Ok(mut info) = conn.prepare(&format!("pragma table_info('{table}')")) else { continue };
        let columns: Vec<String> = info
            .query_map([], |row| row.get::<_, String>(1))
            .map(|rows| rows.flatten().collect())
            .unwrap_or_default();
        let find = |names: &[&str]| {
            columns
                .iter()
                .find(|c| names.iter().any(|n| c.eq_ignore_ascii_case(n)))
                .cloned()
        };
        let (Some(title_col), Some(path_col)) = (
            find(&["ProductTitle", "Title", "GameTitle", "Name"]),
            find(&["InstallDirectory", "InstallPath", "InstallLocation", "Path"]),
        ) else {
            continue;
        };
        let sql = format!("select \"{title_col}\", \"{path_col}\" from \"{table}\"");
        let Ok(mut stmt) = conn.prepare(&sql) else { continue };
        let Ok(rows) = stmt.query_map([], |row| {
            let title: Option<String> = row.get(0)?;
            let path: Option<String> = row.get(1)?;
            Ok((title, path))
        }) else {
            continue;
        };
        for (title, path) in rows.flatten() {
            let Some(title) = title.filter(|t| !t.trim().is_empty()) else { continue };
            games.push(DetectedGame {
                store_id: title.clone(),
                title,
                size_gb: None,
                installed: path.is_some(),
                install_path: path,
                playtime_h: None,
            });
        }
        if !games.is_empty() {
            break;
        }
    }

    ProviderDetection::from_games("amazon", "GameInstallInfo.sqlite", games, None)
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
        scan_epic(),
        scan_legendary(),
        scan_heroic("gog", "gog_library.json"),
        scan_heroic("amazon", "nile_library.json"),
        scan_gog(),
        scan_itch(),
        scan_amazon(),
        crate::detect_ubisoft::scan_ubisoft(),
        scan_rockstar(),
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
