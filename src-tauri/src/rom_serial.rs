//! Game ID read from a disc or cartridge header (GameCube, Wii, 3DS): the key GameTDB uses for
//! its cover scans. Reads a few KB, read-only; every format is checked by a magic number first,
//! so an unrelated file never yields an ID. Ported from iBox (MIT, scanner/headers.rs).

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};

const WII_MAGIC: u32 = 0x5D1C_9EA3;
const GC_MAGIC: u32 = 0xC233_9F3D;

fn read_at(src: &mut (impl Read + Seek), offset: u64, len: usize) -> Option<Vec<u8>> {
    src.seek(SeekFrom::Start(offset)).ok()?;
    let mut buf = Vec::with_capacity(len);
    src.take(len as u64).read_to_end(&mut buf).ok()?;
    (buf.len() == len).then_some(buf)
}

fn be32(b: &[u8], at: usize) -> u32 {
    u32::from_be_bytes([b[at], b[at + 1], b[at + 2], b[at + 3]])
}

/// Uppercase letters and digits only: what GameTDB IDs are made of.
fn id(bytes: &[u8]) -> Option<String> {
    bytes.iter().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()).then(|| String::from_utf8_lossy(bytes).into_owned())
}

/// GameCube/Wii disc header: 6-char ID (GALE01) when the console magic is present.
fn gc_wii(h: &[u8]) -> Option<String> {
    if h.len() < 0x20 || (be32(h, 0x18) != WII_MAGIC && be32(h, 0x1C) != GC_MAGIC) {
        return None;
    }
    id(&h[0..6])
}

/// The ID, or None for an unknown or unreadable format.
pub(crate) fn detect(src: &mut (impl Read + Seek), ext: &str) -> Option<String> {
    let head = read_at(src, 0, 0x200)?;
    match &head[..4] {
        b"RVZ\x01" | b"WIA\x01" => return gc_wii(&read_at(src, 0x58, 0x20)?),
        b"WBFS" => {
            let shift = head[8];
            return if (9..=31).contains(&shift) { gc_wii(&read_at(src, 1u64 << shift, 0x20)?) } else { None };
        }
        b"CISO" if ext == "ciso" => return gc_wii(&read_at(src, 0x8000, 0x20)?),
        _ => {}
    }
    match &head[0x100..0x104] {
        // 3DS cartridge image: product code "CTR-P-AREE"; GameTDB keys on the last 4 chars.
        b"NCSD" => read_at(src, 0x1150, 10).and_then(|c| (c.starts_with(b"CTR-") || c.starts_with(b"KTR-")).then(|| id(&c[6..10])).flatten()),
        // 3DS executable partition (.cxi): product code at 0x150.
        b"NCCH" => (head[0x150..0x154] == *b"CTR-" || head[0x150..0x154] == *b"KTR-").then(|| id(&head[0x156..0x15A])).flatten(),
        _ => gc_wii(&head),
    }
}

/// GameTDB ID of a GameCube, Wii or 3DS dump, or null when the header has none.
#[tauri::command]
pub async fn rom_serial(path: String) -> Result<Option<String>, String> {
    let path = crate::rom_hash::validate(&path)?;
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || {
        let mut file = File::open(&path).map_err(|e| format!("Não foi possível ler a ROM: {e}"))?;
        Ok(detect(&mut file, &ext))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn disc(id: &[u8; 6], magic_at: usize, magic: u32, len: usize) -> Vec<u8> {
        let mut b = vec![0u8; len];
        b[..6].copy_from_slice(id);
        b[magic_at..magic_at + 4].copy_from_slice(&magic.to_be_bytes());
        b
    }

    #[test]
    fn reads_gamecube_and_wii_ids_only_with_their_magic() {
        assert_eq!(detect(&mut Cursor::new(disc(b"GALE01", 0x1C, GC_MAGIC, 0x400)), "iso").as_deref(), Some("GALE01"));
        assert_eq!(detect(&mut Cursor::new(disc(b"RMGE01", 0x18, WII_MAGIC, 0x400)), "iso").as_deref(), Some("RMGE01"));
        assert_eq!(detect(&mut Cursor::new(disc(b"GALE01", 0x1C, 0xDEAD_BEEF, 0x400)), "iso"), None);
    }

    #[test]
    fn finds_the_disc_header_inside_wbfs_and_rvz() {
        let mut wbfs = vec![0u8; 0x400];
        wbfs[..4].copy_from_slice(b"WBFS");
        wbfs[8] = 9; // 512-byte sectors: disc header at 0x200
        wbfs[0x200..0x220].copy_from_slice(&disc(b"RMGP01", 0x18, WII_MAGIC, 0x20));
        assert_eq!(detect(&mut Cursor::new(wbfs), "wbfs").as_deref(), Some("RMGP01"));

        let mut rvz = vec![0u8; 0x400];
        rvz[..4].copy_from_slice(b"RVZ\x01");
        rvz[0x58..0x78].copy_from_slice(&disc(b"GALP01", 0x1C, GC_MAGIC, 0x20));
        assert_eq!(detect(&mut Cursor::new(rvz), "rvz").as_deref(), Some("GALP01"));
    }

    #[test]
    fn reads_the_3ds_product_code() {
        let mut cart = vec![0u8; 0x1200];
        cart[0x100..0x104].copy_from_slice(b"NCSD");
        cart[0x1150..0x115A].copy_from_slice(b"CTR-P-AREE");
        assert_eq!(detect(&mut Cursor::new(cart), "3ds").as_deref(), Some("AREE"));
    }

    #[test]
    fn rejects_short_garbage_and_non_id_bytes() {
        assert_eq!(detect(&mut Cursor::new(vec![0u8; 16]), "iso"), None);
        assert_eq!(detect(&mut Cursor::new(disc(b"ga\0e01", 0x1C, GC_MAGIC, 0x400)), "iso"), None);
        let mut wbfs = vec![0u8; 0x400];
        wbfs[..4].copy_from_slice(b"WBFS");
        wbfs[8] = 40;
        assert_eq!(detect(&mut Cursor::new(wbfs), "wbfs"), None);
    }
}
