//! EA app / Origin: installed games from the registry (`EA Games`, `Electronic Arts`), Origin's
//! `LocalContent/*.mfst` and each game's own `installerdata.xml`. The owned (not installed) library
//! needs the EA account and is not available locally.

use crate::detect::{program_data, reg_string, reg_subkeys, DetectedGame, Hive, ProviderDetection};
use crate::detect_registry::{existing_dir, folder_name, norm_path};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

const SOURCE: &str = "registro + installerdata.xml";
const REG_ROOTS: [&str; 3] = [
    "SOFTWARE\\WOW6432Node\\EA Games",
    "SOFTWARE\\EA Games",
    "SOFTWARE\\WOW6432Node\\Electronic Arts",
];
const MAX_FILE: u64 = 1024 * 1024;

fn hex(b: u8) -> Option<u8> {
    (b as char).to_digit(16).map(|d| d as u8)
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(if b[i] == b'+' { b' ' } else { b[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Origin `.mfst` files are a URL query string: `?currentstate=...&id=OFB-EAST%3a123&dipinstallpath=C%3a%5c...`.
pub(crate) fn parse_mfst(text: &str) -> Vec<(String, String)> {
    text.trim()
        .trim_start_matches('?')
        .split('&')
        .filter_map(|kv| kv.split_once('='))
        .map(|(k, v)| (k.to_lowercase(), percent_decode(v)))
        .collect()
}

fn mfst_field<'a>(fields: &'a [(String, String)], key: &str) -> Option<&'a str> {
    fields.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str()).filter(|v| !v.is_empty())
}

/// Text of the first `<tag ...>text</tag>`; `<tags>` (a longer name sharing the prefix) is not a match.
fn tag_text(xml: &str, tag: &str) -> Option<String> {
    let needle = format!("<{tag}");
    let mut from = 0;
    while let Some(rel) = xml[from..].find(&needle) {
        let open = from + rel;
        from = open + needle.len();
        if !xml.as_bytes().get(from).is_some_and(|b| *b == b'>' || b.is_ascii_whitespace()) {
            continue;
        }
        let start = from + xml[from..].find('>')? + 1;
        let end = start + xml[start..].find(&format!("</{tag}>"))?;
        let text = xml[start..end].trim();
        return (!text.is_empty()).then(|| text.to_string());
    }
    None
}

/// `(contentID, gameTitle)` from a game's `installerdata.xml`; either may be missing.
pub(crate) fn parse_installer_xml(xml: &str) -> (Option<String>, Option<String>) {
    (tag_text(xml, "contentID"), tag_text(xml, "gameTitle"))
}

fn read_small(path: &Path) -> Option<String> {
    if fs::metadata(path).ok()?.len() > MAX_FILE {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn installer_data(dir: &Path) -> (Option<String>, Option<String>) {
    for rel in ["__Installer\\installerdata.xml", "Installer\\installerdata.xml"] {
        if let Some(xml) = read_small(&dir.join(rel)) {
            return parse_installer_xml(&xml);
        }
    }
    (None, None)
}

/// A candidate install found by one of the sources, before the on-disk checks.
pub(crate) struct Candidate {
    pub fallback_id: String,
    pub name: Option<String>,
    pub dir: String,
}

/// Resolves candidates against the disk: existing folder only, title from installerdata, one entry per folder.
pub(crate) fn resolve(candidates: Vec<Candidate>) -> Vec<DetectedGame> {
    let mut seen = HashSet::new();
    let mut games = Vec::new();
    for c in candidates {
        let Some(dir) = existing_dir(&c.dir) else { continue };
        if !seen.insert(norm_path(&c.dir)) {
            continue;
        }
        let (content_id, xml_title) = installer_data(&dir);
        let title = xml_title.or(c.name).or_else(|| folder_name(&c.dir)).unwrap_or_else(|| c.fallback_id.clone());
        games.push(DetectedGame {
            store_id: content_id.unwrap_or(c.fallback_id),
            title,
            installed: true,
            install_path: Some(dir.to_string_lossy().into_owned()),
            ..Default::default()
        });
    }
    games
}

fn registry_candidates() -> Vec<Candidate> {
    let mut out = Vec::new();
    for root in REG_ROOTS {
        for name in reg_subkeys(Hive::LocalMachine, root) {
            let path = format!("{root}\\{name}");
            let dir = reg_string(Hive::LocalMachine, &path, "Install Dir").or_else(|| reg_string(Hive::LocalMachine, &path, "InstallDir"));
            let Some(dir) = dir else { continue };
            out.push(Candidate { fallback_id: name.clone(), name: reg_string(Hive::LocalMachine, &path, "DisplayName"), dir });
        }
    }
    out
}

/// Candidates from Origin's per-game `.mfst` manifests under `LocalContent`.
pub(crate) fn mfst_candidates(local_content: &Path) -> Vec<Candidate> {
    let mut out = Vec::new();
    let Ok(games) = fs::read_dir(local_content) else { return out };
    for game in games.flatten().filter(|e| e.path().is_dir()) {
        let Ok(files) = fs::read_dir(game.path()) else { continue };
        for f in files.flatten().filter(|f| f.path().extension().is_some_and(|x| x == "mfst")) {
            let Some(text) = read_small(&f.path()) else { continue };
            let fields = parse_mfst(&text);
            let Some(dir) = mfst_field(&fields, "dipinstallpath") else { continue };
            out.push(Candidate {
                fallback_id: mfst_field(&fields, "id").map(str::to_string).unwrap_or_else(|| game.file_name().to_string_lossy().into_owned()),
                name: Some(game.file_name().to_string_lossy().into_owned()),
                dir: dir.to_string(),
            });
        }
    }
    out
}

fn launcher_present() -> bool {
    let pd = program_data();
    pd.join("EA Desktop").is_dir() || pd.join("Origin").is_dir() || REG_ROOTS.iter().any(|r| !reg_subkeys(Hive::LocalMachine, r).is_empty())
}

pub fn scan_ea() -> ProviderDetection {
    let mut candidates = registry_candidates();
    candidates.extend(mfst_candidates(&program_data().join("Origin").join("LocalContent")));
    let games = resolve(candidates);
    if games.is_empty() {
        let note = if launcher_present() {
            "EA app/Origin encontrado, sem jogos instalados detectáveis. A biblioteca comprada exige login na conta EA."
        } else {
            "EA app/Origin não está instalado."
        };
        return ProviderDetection::unavailable("ea", SOURCE, note);
    }
    let mut detection = ProviderDetection::from_games("ea", SOURCE, games, None);
    detection.note = Some("Só jogos instalados: a biblioteca comprada exige login na conta EA.".into());
    detection
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("games-gallery-ea-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn decodes_percent_escapes_and_survives_truncated_ones() {
        assert_eq!(percent_decode("C%3a%5cGames%5cFoo"), "C:\\Games\\Foo");
        assert_eq!(percent_decode("a%2"), "a%2");
        assert_eq!(percent_decode("%"), "%");
        assert_eq!(percent_decode("%zz"), "%zz");
        assert_eq!(percent_decode("a+b"), "a b");
    }

    #[test]
    fn parses_mfst_query_string() {
        let f = parse_mfst("?currentstate=kReadyToStart&id=OFB-EAST%3a123&dipinstallpath=C%3a%5cGames%5cFoo%20Bar");
        assert_eq!(mfst_field(&f, "id"), Some("OFB-EAST:123"));
        assert_eq!(mfst_field(&f, "dipinstallpath"), Some("C:\\Games\\Foo Bar"));
        assert_eq!(mfst_field(&f, "nope"), None);
        assert!(parse_mfst("garbage without equals").is_empty());
        assert!(parse_mfst("").is_empty());
    }

    #[test]
    fn parses_installer_xml_and_tolerates_junk() {
        let xml = "<game><contentIDs><contentID>12345</contentID></contentIDs><gameTitles><gameTitle locale=\"en_US\"> Fake Racer </gameTitle></gameTitles></game>";
        assert_eq!(parse_installer_xml(xml), (Some("12345".into()), Some("Fake Racer".into())));
        assert_eq!(parse_installer_xml("<gameTitle>unterminated"), (None, None));
        assert_eq!(parse_installer_xml("<contentID></contentID>"), (None, None));
        assert_eq!(parse_installer_xml(""), (None, None));
    }

    #[test]
    fn resolve_prefers_installer_data_and_dedupes_by_folder() {
        let dir = tmp("resolve");
        fs::create_dir_all(dir.join("__Installer")).unwrap();
        fs::write(dir.join("__Installer").join("installerdata.xml"), "<contentID>99</contentID><gameTitle>Fake Racer</gameTitle>").unwrap();
        let p = dir.to_string_lossy().into_owned();
        let games = resolve(vec![
            Candidate { fallback_id: "reg".into(), name: Some("From Registry".into()), dir: p.clone() },
            Candidate { fallback_id: "mfst".into(), name: None, dir: p.to_uppercase() },
            Candidate { fallback_id: "ghost".into(), name: Some("Ghost".into()), dir: "Z:\\nope\\gg-ea".into() },
        ]);
        assert_eq!(games.len(), 1);
        assert_eq!((games[0].store_id.as_str(), games[0].title.as_str()), ("99", "Fake Racer"));
    }

    #[test]
    fn reads_origin_local_content() {
        let root = tmp("origin");
        let install = tmp("origin-install");
        let content = root.join("Fake Shooter");
        fs::create_dir_all(&content).unwrap();
        let enc = install.to_string_lossy().replace('\\', "%5c").replace(':', "%3a");
        fs::write(content.join("1.mfst"), format!("?id=OFB-EAST%3a7&dipinstallpath={enc}")).unwrap();
        fs::write(content.join("big.mfst"), vec![b'a'; (MAX_FILE + 1) as usize]).unwrap();
        let games = resolve(mfst_candidates(&root));
        assert_eq!(games.len(), 1);
        assert_eq!((games[0].store_id.as_str(), games[0].title.as_str()), ("OFB-EAST:7", "Fake Shooter"));
        assert!(mfst_candidates(&root.join("missing")).is_empty());
    }
}
