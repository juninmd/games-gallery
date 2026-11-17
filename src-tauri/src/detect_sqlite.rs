//! Launchers that keep their library in SQLite (GOG Galaxy, itch.io butler, Amazon Games).
//! Every database is opened read-only.

use crate::detect::{app_data, local_app_data, program_data, size_gb, DetectedGame, ProviderDetection};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;

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
