//! Cover art from a file the user dropped on the window: checked to be a real image, then copied
//! into the cover cache, the only folder the asset protocol serves.

use crate::covers::{hashed_name, MAX_BYTES};
use std::io::Read;
use tauri::{AppHandle, Manager};

/// PNG, JPEG or WebP by their magic bytes; the extension alone is not trusted.
fn is_image(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.starts_with(b"\xff\xd8\xff")
        || (bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP")
}

fn read_image(path: &std::path::Path) -> Result<Vec<u8>, String> {
    let meta = std::fs::metadata(path).map_err(|_| "Arquivo não encontrado".to_string())?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_BYTES as u64 {
        return Err("A imagem precisa ser um arquivo de até 8 MB".into());
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    // take() bounds the read even if the file grows after the size check.
    std::fs::File::open(path).and_then(|f| f.take(MAX_BYTES as u64 + 1).read_to_end(&mut bytes)).map_err(|_| "Não foi possível ler a imagem".to_string())?;
    if bytes.len() > MAX_BYTES || !is_image(&bytes) {
        return Err("Use uma imagem PNG, JPEG ou WebP".into());
    }
    Ok(bytes)
}

#[tauri::command]
pub fn cover_import(app: AppHandle, path: String) -> Result<String, String> {
    let bytes = read_image(std::path::Path::new(&path))?;
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("covers");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let target = dir.join(hashed_name(&bytes));
    crate::atomic_write::write_atomic(&target, &bytes).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_real_image_headers() {
        assert!(is_image(b"\x89PNG\r\n\x1a\nrest"));
        assert!(is_image(b"\xff\xd8\xff\xe0"));
        assert!(is_image(b"RIFF\0\0\0\0WEBPVP8 "));
        assert!(!is_image(b"RIFF\0\0\0\0WAVE"));
        assert!(!is_image(b"<svg xmlns='http://www.w3.org/2000/svg'/>"));
        assert!(!is_image(b""));
    }

    #[test]
    fn rejects_missing_empty_and_fake_files() {
        let dir = std::env::temp_dir().join(format!("gg-cover-import-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(read_image(&dir.join("missing.png")).is_err());
        assert!(read_image(&dir).is_err());
        let fake = dir.join("fake.png");
        std::fs::write(&fake, b"not an image").unwrap();
        assert!(read_image(&fake).is_err());
        let real = dir.join("real.png");
        std::fs::write(&real, b"\x89PNG\r\n\x1a\ndata").unwrap();
        assert_eq!(read_image(&real).unwrap().len(), 12);
        let _ = std::fs::remove_dir_all(dir);
    }
}
