//! CRC32 of a ROM file, read in blocks so a multi-GB image never sits in memory. The result is
//! matched against the user's own DAT (No-Intro/Redump) in the UI; nothing is looked up online.

use std::fs::File;
use std::io::{BufReader, Read};
use std::path::PathBuf;

const BLOCK: usize = 1 << 20;
const COMPRESSED: [&str; 3] = ["zip", "7z", "rar"];

/// IEEE 802.3 polynomial (reflected), the CRC-32 used by DAT files and zip.
fn table() -> [u32; 256] {
    let mut t = [0u32; 256];
    for (i, slot) in t.iter_mut().enumerate() {
        let mut c = i as u32;
        for _ in 0..8 {
            c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
        }
        *slot = c;
    }
    t
}

fn update(t: &[u32; 256], crc: u32, bytes: &[u8]) -> u32 {
    bytes.iter().fold(crc, |c, &b| t[((c ^ u32::from(b)) & 0xff) as usize] ^ (c >> 8))
}

fn crc32_reader(reader: impl Read) -> std::io::Result<u32> {
    let t = table();
    let mut reader = BufReader::with_capacity(BLOCK, reader);
    let mut buf = vec![0u8; BLOCK];
    let mut crc = 0xFFFF_FFFFu32;
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            return Ok(!crc);
        }
        crc = update(&t, crc, &buf[..n]);
    }
}

fn validate(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path.trim());
    if !path.is_absolute() || path.as_os_str().to_string_lossy().chars().any(char::is_control) {
        return Err("Caminho da ROM inválido".into());
    }
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if COMPRESSED.contains(&ext.as_str()) {
        return Err("ROM compactada: o DAT confere o arquivo descompactado".into());
    }
    if !path.is_file() {
        return Err("ROM não encontrada".into());
    }
    Ok(path)
}

/// Returns the CRC32 as 8 uppercase hex digits.
#[tauri::command]
pub async fn rom_crc32(path: String) -> Result<String, String> {
    let path = validate(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let file = File::open(&path).map_err(|e| format!("Não foi possível ler a ROM: {e}"))?;
        crc32_reader(file).map(|c| format!("{c:08X}")).map_err(|e| format!("Falha ao ler a ROM: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_standard_check_value_and_empty_input() {
        assert_eq!(crc32_reader(&b"123456789"[..]).unwrap(), 0xCBF4_3926);
        assert_eq!(crc32_reader(&b""[..]).unwrap(), 0);
    }

    #[test]
    fn block_boundaries_do_not_change_the_result() {
        let data: Vec<u8> = (0..(BLOCK * 2 + 17)).map(|i| (i * 31 % 251) as u8).collect();
        let t = table();
        let whole = !update(&t, 0xFFFF_FFFF, &data);
        assert_eq!(crc32_reader(&data[..]).unwrap(), whole);
    }

    #[test]
    fn refuses_relative_compressed_and_missing_paths() {
        assert!(validate("roms/game.sfc").is_err());
        let dir = std::env::temp_dir();
        assert!(validate(&dir.join("game.zip").to_string_lossy()).unwrap_err().contains("compactada"));
        assert!(validate(&dir.join("definitely-missing.sfc").to_string_lossy()).unwrap_err().contains("não encontrada"));
        let rom = dir.join(format!("gg-rom-{}.sfc", std::process::id()));
        std::fs::write(&rom, b"123456789").unwrap();
        assert_eq!(validate(&rom.to_string_lossy()).unwrap(), rom);
        let _ = std::fs::remove_file(rom);
    }
}
