//! Adds emulated games to Steam as non-Steam shortcuts by editing `userdata/<id>/config/shortcuts.vdf`
//! (binary VDF). Existing entries are kept byte-for-byte in meaning, a backup is written first, and
//! Steam must be closed: it rewrites the file from memory on exit.

use crate::detect::{home, steam_roots};
use crate::rom_hash::crc32_reader;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const MAP: u8 = 0x00;
const STR: u8 = 0x01;
const INT: u8 = 0x02;
const END: u8 = 0x08;
const MAX_ENTRIES: usize = 2000;
const MAX_FILE: u64 = 16 * 1024 * 1024;

/// Strings and keys stay raw bytes: older entries may hold ANSI text that must be written back untouched.
type Map = Vec<(Vec<u8>, Node)>;

#[derive(Debug, Clone, PartialEq)]
enum Node {
    Map(Map),
    Str(Vec<u8>),
    Int(i32),
}

fn read_cstr(buf: &[u8], pos: &mut usize) -> Result<Vec<u8>, String> {
    let end = buf[*pos..].iter().position(|&b| b == 0).ok_or("VDF truncado")? + *pos;
    let s = buf[*pos..end].to_vec();
    *pos = end + 1;
    Ok(s)
}

fn parse_map(buf: &[u8], pos: &mut usize, depth: usize) -> Result<Map, String> {
    if depth > 16 {
        return Err("VDF aninhado demais".into());
    }
    let mut out = Vec::new();
    loop {
        let kind = *buf.get(*pos).ok_or("VDF truncado")?;
        *pos += 1;
        if kind == END {
            return Ok(out);
        }
        let key = read_cstr(buf, pos)?;
        let node = match kind {
            MAP => Node::Map(parse_map(buf, pos, depth + 1)?),
            STR => Node::Str(read_cstr(buf, pos)?),
            INT => {
                let bytes: [u8; 4] = buf.get(*pos..*pos + 4).ok_or("VDF truncado")?.try_into().map_err(|_| "VDF truncado")?;
                *pos += 4;
                Node::Int(i32::from_le_bytes(bytes))
            }
            other => return Err(format!("Tipo VDF não suportado: {other:#04x}")),
        };
        out.push((key, node));
    }
}

fn write_map(out: &mut Vec<u8>, map: &[(Vec<u8>, Node)]) {
    for (key, node) in map {
        let kind = match node { Node::Map(_) => MAP, Node::Str(_) => STR, Node::Int(_) => INT };
        out.push(kind);
        out.extend_from_slice(key);
        out.push(0);
        match node {
            Node::Map(m) => write_map(out, m),
            Node::Str(s) => { out.extend_from_slice(s); out.push(0); }
            Node::Int(i) => out.extend_from_slice(&i.to_le_bytes()),
        }
    }
    out.push(END);
}

#[derive(Deserialize)]
pub struct ShortcutIn {
    name: String,
    exe: String,
    args: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct ShortcutSummary {
    added: usize,
    skipped: usize,
    files: Vec<String>,
}

fn clean(s: &str) -> bool {
    !s.chars().any(|c| c.is_control() || c == '"')
}

fn validate(e: &ShortcutIn) -> Result<(), String> {
    let name = e.name.trim();
    if name.is_empty() || name.len() > 200 || !clean(name) {
        return Err(format!("Nome inválido: {name}"));
    }
    if !Path::new(&e.exe).is_absolute() || !clean(&e.exe) || !Path::new(&e.exe).is_file() {
        return Err(format!("Executável inválido para {name}"));
    }
    if e.args.len() > 32 || e.args.iter().any(|a| a.len() > 1024 || !clean(a)) {
        return Err(format!("Argumentos inválidos para {name}"));
    }
    Ok(())
}

fn quote(s: &str) -> String {
    if s.is_empty() || s.contains(char::is_whitespace) { format!("\"{s}\"") } else { s.to_string() }
}

/// Same id Steam derives for a non-Steam shortcut, so artwork tools find it.
fn shortcut_appid(exe: &str, name: &str) -> i32 {
    let crc = crc32_reader(format!("\"{exe}\"{name}").as_bytes()).unwrap_or(0);
    (crc | 0x8000_0000) as i32
}

fn entry(e: &ShortcutIn) -> Node {
    let exe = format!("\"{}\"", e.exe);
    let dir = Path::new(&e.exe).parent().map(|p| format!("\"{}\"", p.display())).unwrap_or_default();
    let s = |k: &str, v: String| (k.as_bytes().to_vec(), Node::Str(v.into_bytes()));
    let i = |k: &str, v: i32| (k.as_bytes().to_vec(), Node::Int(v));
    Node::Map(vec![
        i("appid", shortcut_appid(&e.exe, e.name.trim())),
        s("AppName", e.name.trim().to_string()),
        s("Exe", exe),
        s("StartDir", dir),
        s("icon", String::new()),
        s("ShortcutPath", String::new()),
        s("LaunchOptions", e.args.iter().map(|a| quote(a)).collect::<Vec<_>>().join(" ")),
        i("IsHidden", 0),
        i("AllowDesktopConfig", 1),
        i("AllowOverlay", 1),
        i("OpenVR", 0),
        i("Devkit", 0),
        s("DevkitGameID", String::new()),
        i("DevkitOverrideAppID", 0),
        i("LastPlayTime", 0),
        s("FlatpakAppID", String::new()),
        (b"tags".to_vec(), Node::Map(vec![(b"0".to_vec(), Node::Str(b"Games Gallery".to_vec()))])),
    ])
}

fn field<'a>(node: &'a Node, key: &str) -> Option<&'a [u8]> {
    match node {
        Node::Map(m) => m.iter().find(|(k, _)| k.eq_ignore_ascii_case(key.as_bytes())).and_then(|(_, v)| if let Node::Str(s) = v { Some(s.as_slice()) } else { None }),
        _ => None,
    }
}

/// Merges new entries into the file bytes (empty = no file yet); returns the new bytes and counts.
fn merge(existing: &[u8], entries: &[ShortcutIn]) -> Result<(Vec<u8>, usize, usize), String> {
    let mut root = if existing.is_empty() {
        vec![(b"shortcuts".to_vec(), Node::Map(Vec::new()))]
    } else {
        let mut pos = 0;
        parse_map(existing, &mut pos, 0)?
    };
    let Some((_, Node::Map(list))) = root.iter_mut().find(|(k, _)| k.eq_ignore_ascii_case(b"shortcuts")) else {
        return Err("shortcuts.vdf sem a lista de atalhos".into());
    };
    let (mut added, mut skipped) = (0, 0);
    for e in entries {
        let exe = format!("\"{}\"", e.exe);
        let dup = list.iter().any(|(_, n)| field(n, "AppName").is_some_and(|a| a.eq_ignore_ascii_case(e.name.trim().as_bytes())) && field(n, "Exe") == Some(exe.as_bytes()));
        if dup {
            skipped += 1;
            continue;
        }
        let next = list.iter().filter_map(|(k, _)| std::str::from_utf8(k).ok()?.parse::<usize>().ok()).max().map_or(0, |n| n + 1);
        list.push((next.to_string().into_bytes(), entry(e)));
        added += 1;
    }
    let mut out = Vec::new();
    write_map(&mut out, &root);
    Ok((out, added, skipped))
}

fn config_dirs() -> Vec<PathBuf> {
    let h = home();
    let mut roots = steam_roots();
    roots.extend([h.join(".steam/steam"), h.join(".local/share/Steam"), h.join("Library/Application Support/Steam")]);
    let mut dirs: Vec<PathBuf> = roots
        .iter()
        .filter_map(|r| std::fs::read_dir(r.join("userdata")).ok())
        .flatten()
        .flatten()
        .filter(|d| d.file_name().to_string_lossy().chars().all(|c| c.is_ascii_digit()) && d.file_name() != "0")
        .map(|d| d.path().join("config"))
        .filter_map(|p| p.canonicalize().ok())
        .filter(|p| p.is_dir())
        .collect();
    dirs.sort();
    dirs.dedup();
    dirs
}

fn apply(config: &Path, entries: &[ShortcutIn]) -> Result<(usize, usize), String> {
    let path = config.join("shortcuts.vdf");
    let existing = match std::fs::metadata(&path) {
        Ok(m) if m.len() > MAX_FILE => return Err("shortcuts.vdf grande demais".into()),
        Ok(_) => std::fs::read(&path).map_err(|e| e.to_string())?,
        Err(_) => Vec::new(),
    };
    let (bytes, added, skipped) = merge(&existing, entries)?;
    if added == 0 {
        return Ok((0, skipped));
    }
    // Only the first export keeps a backup, so it always holds the file from before the app touched it.
    let backup = config.join("shortcuts.vdf.bak");
    if !existing.is_empty() && !backup.exists() {
        std::fs::write(backup, &existing).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("vdf.part");
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok((added, skipped))
}

#[tauri::command]
pub async fn steam_add_shortcuts(entries: Vec<ShortcutIn>) -> Result<ShortcutSummary, String> {
    if entries.is_empty() || entries.len() > MAX_ENTRIES {
        return Err("Nenhum jogo para exportar".into());
    }
    entries.iter().try_for_each(validate)?;
    tauri::async_runtime::spawn_blocking(move || {
        let dirs = config_dirs();
        if dirs.is_empty() {
            return Err("Nenhuma conta da Steam encontrada neste computador".to_string());
        }
        let mut summary = ShortcutSummary { added: 0, skipped: 0, files: Vec::new() };
        for dir in dirs {
            let (added, skipped) = apply(&dir, &entries)?;
            summary.added += added;
            summary.skipped += skipped;
            summary.files.push(dir.join("shortcuts.vdf").to_string_lossy().into_owned());
        }
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn game(name: &str) -> ShortcutIn {
        ShortcutIn { name: name.into(), exe: "/emu/pcsx2".into(), args: vec!["/roms/My Game.iso".into(), "-fullscreen".into()] }
    }

    fn parse(bytes: &[u8]) -> Map {
        let mut pos = 0;
        let out = parse_map(bytes, &mut pos, 0).unwrap();
        assert_eq!(pos, bytes.len());
        out
    }

    #[test]
    fn creates_a_file_and_round_trips() {
        let (bytes, added, skipped) = merge(&[], &[game("Okami")]).unwrap();
        assert_eq!((added, skipped), (1, 0));
        let root = parse(&bytes);
        let Node::Map(list) = &root[0].1 else { panic!() };
        assert_eq!(list[0].0, b"0");
        assert_eq!(field(&list[0].1, "Exe"), Some(&b"\"/emu/pcsx2\""[..]));
        assert_eq!(field(&list[0].1, "LaunchOptions"), Some(&b"\"/roms/My Game.iso\" -fullscreen"[..]));
        let mut again = Vec::new();
        write_map(&mut again, &root);
        assert_eq!(again, bytes);
    }

    #[test]
    fn keeps_existing_entries_and_skips_duplicates() {
        let (first, ..) = merge(&[], &[game("Okami")]).unwrap();
        let (second, added, skipped) = merge(&first, &[game("okami"), game("Shadow")]).unwrap();
        assert_eq!((added, skipped), (1, 1));
        let root = parse(&second);
        let Node::Map(list) = &root[0].1 else { panic!() };
        assert_eq!(list.iter().map(|(k, _)| k.as_slice()).collect::<Vec<_>>(), [b"0", b"1"]);
        assert_eq!(field(&list[1].1, "AppName"), Some(&b"Shadow"[..]));
    }

    #[test]
    fn non_utf8_text_in_existing_entries_survives_byte_for_byte() {
        let mut file = Vec::new();
        let old = vec![(b"shortcuts".to_vec(), Node::Map(vec![(b"0".to_vec(), Node::Map(vec![(b"AppName".to_vec(), Node::Str(vec![b'C', 0xE9]))]))]))];
        write_map(&mut file, &old);
        file.push(END);
        let (out, added, _) = merge(&file, &[game("Novo")]).unwrap();
        assert_eq!(added, 1);
        assert!(out.windows(3).any(|w| w == [b'C', 0xE9, 0]));
    }

    #[test]
    fn rejects_truncated_or_unknown_vdf_and_bad_input() {
        let (bytes, ..) = merge(&[], &[game("Okami")]).unwrap();
        assert!(merge(&bytes[..bytes.len() - 3], &[game("x")]).is_err());
        assert!(merge(&[0x07, b'a', 0], &[game("x")]).is_err());
        assert!(validate(&ShortcutIn { name: "a\"b".into(), exe: "/x".into(), args: vec![] }).is_err());
        assert!(validate(&ShortcutIn { name: "ok".into(), exe: "relative".into(), args: vec![] }).is_err());
        assert!(validate(&ShortcutIn { name: "ok".into(), exe: "/x".into(), args: vec!["a\nb".into()] }).is_err());
        let exe = std::env::current_exe().unwrap().to_string_lossy().into_owned();
        assert!(validate(&ShortcutIn { name: "ok".into(), exe, args: vec!["x".into()] }).is_ok());
        assert!(validate(&game("missing exe")).is_err());
    }

    #[test]
    fn appid_has_the_high_bit_set() {
        assert!(shortcut_appid("/emu/pcsx2", "Okami") < 0);
    }
}
