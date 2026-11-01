//! Xbox app / Game Pass PC installed games. The Xbox app installs each title under `<drive>:\XboxGames\<Name>\Content`
//! with a `MicrosoftGame.Config` (package identity + display name). Owned-but-not-installed titles live only
//! on Microsoft's servers, so they are not listed here.

use crate::detect::{DetectedGame, ProviderDetection};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

const SOURCE: &str = "XboxGames\\*\\Content\\MicrosoftGame.Config";
const MAX_FILE: u64 = 512 * 1024;

fn decode_entities(s: &str) -> String {
    s.replace("&quot;", "\"").replace("&apos;", "'").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
}

/// Value of `attr="..."` on the first `<tag ...>`; `<tags>` sharing the prefix is not a match.
fn attr(xml: &str, tag: &str, name: &str) -> Option<String> {
    let needle = format!("<{tag}");
    let mut from = 0;
    while let Some(rel) = xml[from..].find(&needle) {
        let start = from + rel + needle.len();
        from = start;
        if !xml.as_bytes().get(start).is_some_and(|b| b.is_ascii_whitespace()) {
            continue;
        }
        let end = start + xml[start..].find('>')?;
        let head = &xml[start..end];
        let key = format!("{name}=\"");
        let mut at = 0;
        while let Some(k) = head[at..].find(&key) {
            let pos = at + k;
            at = pos + key.len();
            if pos > 0 && !head.as_bytes()[pos - 1].is_ascii_whitespace() {
                continue;
            }
            let value = &head[at..at + head[at..].find('"')?];
            let value = decode_entities(value.trim());
            return (!value.is_empty()).then_some(value);
        }
        return None;
    }
    None
}

/// `(package identity name, display name)`; a `ms-resource:` display name is a localized lookup, not text.
pub(crate) fn parse_config(xml: &str) -> (Option<String>, Option<String>) {
    let name = attr(xml, "Identity", "Name").filter(|n| n.len() <= 100 && n.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)));
    let title = attr(xml, "ShellVisuals", "DefaultDisplayName").filter(|t| !t.starts_with("ms-resource:") && t.len() <= 300);
    (name, title)
}

pub(crate) fn scan_roots(roots: &[PathBuf]) -> Vec<DetectedGame> {
    let mut seen = HashSet::new();
    let mut games = Vec::new();
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else { continue };
        for entry in entries.flatten() {
            let content = entry.path().join("Content");
            let cfg = content.join("MicrosoftGame.Config");
            let Some(xml) = read_capped(&cfg) else { continue };
            let (name, title) = parse_config(&xml);
            let folder = entry.file_name().to_string_lossy().to_string();
            let Some(store_id) = name else { continue };
            if !seen.insert(store_id.clone()) {
                continue;
            }
            games.push(DetectedGame {
                store_id,
                title: title.unwrap_or(folder),
                installed: true,
                install_path: Some(content.to_string_lossy().to_string()),
                ..Default::default()
            });
        }
    }
    games
}

/// Reads at most `MAX_FILE` bytes; a bigger (or growing) file is refused instead of truncated.
fn read_capped(path: &Path) -> Option<String> {
    let mut text = String::new();
    fs::File::open(path).ok()?.take(MAX_FILE + 1).read_to_string(&mut text).ok()?;
    (text.len() as u64 <= MAX_FILE).then_some(text)
}

#[cfg(windows)]
mod drives {
    extern "system" {
        fn GetLogicalDrives() -> u32;
        fn GetDriveTypeW(root: *const u16) -> u32;
    }
    const DRIVE_FIXED: u32 = 3;

    /// Fixed local disks only: probing an offline network drive or an empty card reader can block for a minute.
    pub fn fixed_letters() -> Vec<char> {
        // SAFETY: GetLogicalDrives takes no arguments; GetDriveTypeW gets a NUL-terminated buffer that outlives the call.
        let mask = unsafe { GetLogicalDrives() };
        ('A'..='Z')
            .enumerate()
            .filter(|(i, _)| mask & (1 << i) != 0)
            .map(|(_, c)| c)
            .filter(|c| {
                let root: Vec<u16> = format!("{c}:\\").encode_utf16().chain(std::iter::once(0)).collect();
                unsafe { GetDriveTypeW(root.as_ptr()) == DRIVE_FIXED }
            })
            .collect()
    }
}

fn drive_roots() -> Vec<PathBuf> {
    #[cfg(windows)]
    {
        drives::fixed_letters().into_iter().map(|d| PathBuf::from(format!("{d}:\\XboxGames"))).filter(|p| p.is_dir()).collect()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

pub fn scan_xbox() -> ProviderDetection {
    let games = scan_roots(&drive_roots());
    if games.is_empty() {
        return ProviderDetection::unavailable("xboxpc", SOURCE, "Nenhum jogo instalado pelo app Xbox em <unidade>:\\XboxGames. A biblioteca comprada exige login na conta Microsoft.");
    }
    let mut detection = ProviderDetection::from_games("xboxpc", SOURCE, games, None);
    detection.note = Some("Só jogos instalados: a biblioteca comprada exige login na conta Microsoft.".into());
    detection
}

#[cfg(test)]
mod tests {
    use super::*;

    const CFG: &str = r#"<Game configVersion="1"><Identity Name="Fake.Studio.RacerX" Publisher="CN=Fake" Version="1.0.0.0"/><ShellVisuals DefaultDisplayName="Racer &amp; Co" Square150x150Logo="a.png"/></Game>"#;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("games-gallery-xbox-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn install(root: &Path, folder: &str, cfg: &str) {
        let content = root.join(folder).join("Content");
        fs::create_dir_all(&content).unwrap();
        fs::write(content.join("MicrosoftGame.Config"), cfg).unwrap();
    }

    #[test]
    fn parses_identity_and_display_name() {
        assert_eq!(parse_config(CFG), (Some("Fake.Studio.RacerX".into()), Some("Racer & Co".into())));
        // localized display names are references, not titles; hostile identities are refused
        let xml = r#"<Identity Name="A.B"/><ShellVisuals DefaultDisplayName="ms-resource:AppName"/>"#;
        assert_eq!(parse_config(xml), (Some("A.B".into()), None));
        assert_eq!(parse_config(r#"<Identity Name="a b/../c"/>"#).0, None);
        assert_eq!(parse_config("<Identities Name=\"x\"/>"), (None, None));
        assert_eq!(parse_config(r#"<Identity PackageName="x"/>"#).0, None);
        assert_eq!(parse_config(""), (None, None));
    }

    #[test]
    fn scans_installed_titles_and_skips_junk() {
        let root = tmp("scan");
        install(&root, "Racer X", CFG);
        install(&root, "Dup", CFG); // same package id under another folder
        install(&root, "No Name", r#"<ShellVisuals DefaultDisplayName="Ghost"/>"#);
        install(&root, "Localized", r#"<Identity Name="Fake.Loc"/><ShellVisuals DefaultDisplayName="ms-resource:X"/>"#);
        install(&root, "Huge", &"a".repeat((MAX_FILE + 1) as usize));
        fs::create_dir_all(root.join("Empty")).unwrap();
        let mut games = scan_roots(&[root.clone(), root.join("missing")]);
        games.sort_by(|a, b| a.store_id.cmp(&b.store_id));
        let got: Vec<_> = games.iter().map(|g| (g.store_id.as_str(), g.title.as_str(), g.installed)).collect();
        assert_eq!(got.len(), 2);
        assert!(got.contains(&("Fake.Loc", "Localized", true)));
        assert!(got.iter().any(|(id, t, _)| *id == "Fake.Studio.RacerX" && (*t == "Racer & Co")));
        assert!(games[0].install_path.as_deref().is_some_and(|p| p.ends_with("Content")));
    }

    #[cfg(windows)]
    #[test]
    fn lists_fixed_drives_including_the_system_one() {
        let sys = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into()).chars().next().unwrap().to_ascii_uppercase();
        assert!(drives::fixed_letters().contains(&sys));
    }
}
