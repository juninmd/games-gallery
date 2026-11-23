//! Local cover cache: downloads an image once from an allow-listed CDN into the app cache folder
//! and returns its path, which the WebView reads through the asset protocol (scoped to that folder).

use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

pub(crate) const MAX_BYTES: usize = 8 * 1024 * 1024;
/// Same image hosts the CSP allows, plus SteamGridDB's CDN.
const HOSTS: [&str; 9] = [
    "cdn.cloudflare.steamstatic.com",
    "shared.akamai.steamstatic.com",
    "cdn.akamai.steamstatic.com",
    "shared.fastly.steamstatic.com",
    "thumbnails.libretro.com",
    "cdn1.epicgames.com",
    "cdn2.unrealengine.com",
    "cdn2.steamgriddb.com",
    "images.gog-statics.com",
];

fn allowed(url: &url::Url) -> bool {
    url.scheme() == "https" && url.port().is_none() && url.username().is_empty() && url.host_str().is_some_and(|h| HOSTS.contains(&h))
}

/// FNV-1a: a stable file name per URL; collisions only cost a wrong cover, never a path escape.
fn file_name(url: &str) -> String {
    hashed_name(url.as_bytes())
}

/// Hex FNV-1a of `bytes` plus `.img`: never carries a path part.
pub(crate) fn hashed_name(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for &byte in bytes {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    format!("{hash:016x}.img")
}

fn cached(dir: &Path, url: &str) -> (PathBuf, bool) {
    let path = dir.join(file_name(url));
    let hit = path.metadata().is_ok_and(|m| m.is_file() && m.len() > 0);
    (path, hit)
}

#[tauri::command]
pub async fn cover_cached(app: AppHandle, url: String) -> Result<String, String> {
    let parsed = url::Url::parse(&url).map_err(|_| "URL de capa inválida".to_string())?;
    if !allowed(&parsed) {
        return Err("Host de capa não permitido".into());
    }
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("covers");
    let (path, hit) = cached(&dir, parsed.as_str());
    if hit {
        return Ok(path.to_string_lossy().into_owned());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let mut res = client.get(parsed).send().await.map_err(|_| "Falha ao baixar a capa".to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status().as_u16()));
    }
    let is_image = res.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).is_some_and(|v| v.starts_with("image/"));
    if !is_image {
        return Err("A resposta não é uma imagem".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|_| "Falha ao baixar a capa".to_string())? {
        if bytes.len() + chunk.len() > MAX_BYTES {
            return Err("Capa excede o limite de tamanho".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Write then rename, so a half-written file is never served as a cache hit.
    crate::atomic_write::write_atomic(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> url::Url {
        url::Url::parse(s).unwrap()
    }

    #[test]
    fn only_https_on_known_cdns_is_allowed() {
        assert!(allowed(&parse("https://cdn2.steamgriddb.com/grid/abc.png")));
        assert!(!allowed(&parse("http://cdn2.steamgriddb.com/grid/abc.png")));
        assert!(!allowed(&parse("https://evil.example/x.png")));
        assert!(!allowed(&parse("https://cdn2.steamgriddb.com.evil.example/x.png")));
        assert!(!allowed(&parse("https://cdn2.steamgriddb.com:8443/x.png")));
        assert!(!allowed(&parse("https://user@cdn2.steamgriddb.com/x.png")));
    }

    #[test]
    fn file_names_are_stable_hex_without_path_parts() {
        let a = file_name("https://cdn2.steamgriddb.com/grid/../../etc/passwd");
        assert_eq!(a, file_name("https://cdn2.steamgriddb.com/grid/../../etc/passwd"));
        assert_ne!(a, file_name("https://cdn2.steamgriddb.com/grid/other.png"));
        assert!(a.ends_with(".img") && a.len() == 20 && a[..16].chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn empty_files_are_not_cache_hits() {
        let dir = std::env::temp_dir().join(format!("gg-covers-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let url = "https://cdn2.steamgriddb.com/grid/a.png";
        let (path, hit) = cached(&dir, url);
        assert!(!hit);
        std::fs::write(&path, b"").unwrap();
        assert!(!cached(&dir, url).1);
        std::fs::write(&path, b"png").unwrap();
        assert!(cached(&dir, url).1);
        let _ = std::fs::remove_dir_all(dir);
    }
}
