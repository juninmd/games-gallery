//! Battle.net: the Agent keeps `product.db`, a protobuf file with one `ProductInstall` per game
//! (`1 uid`, `2 product_code`, `3 Settings { 1 install_path }`). It is read with a small bounds-checked
//! wire-format walker; the Blizzard uninstall entries in the registry fill the gaps.

use crate::detect::{program_data, DetectedGame, ProviderDetection};
use crate::detect_registry::{existing_dir, folder_name, norm_path, uninstall_entries, UninstallEntry};
use std::collections::HashSet;
use std::fs;

const SOURCE: &str = "Agent product.db + registro";
const MAX_DB: u64 = 8 * 1024 * 1024;
const MAX_FIELDS: usize = 20_000;

/// Known Agent product ids/codes -> display title. Unknown products fall back to the registry or folder name.
const TITLES: &[(&str, &str)] = &[
    ("wow", "World of Warcraft"),
    ("wow_classic", "World of Warcraft Classic"),
    ("wow_classic_era", "World of Warcraft Classic Era"),
    ("d3", "Diablo III"),
    ("fenris", "Diablo IV"),
    ("s1", "StarCraft"),
    ("s2", "StarCraft II"),
    ("hs_beta", "Hearthstone"),
    ("hearthstone", "Hearthstone"),
    ("prometheus", "Overwatch 2"),
    ("pro", "Overwatch 2"),
    ("w3", "Warcraft III"),
    ("war3", "Warcraft III"),
    ("viper", "Call of Duty: Black Ops 4"),
    ("odin", "Call of Duty: Modern Warfare"),
    ("zeus", "Call of Duty: Black Ops Cold War"),
    ("fore", "Call of Duty: Vanguard"),
];

pub(crate) fn known_title(id: &str) -> Option<&'static str> {
    let id = id.to_lowercase();
    TITLES.iter().find(|(k, _)| *k == id).map(|(_, t)| *t)
}

pub(crate) enum Value<'a> {
    #[allow(dead_code)] // decoded for completeness; no current field reads it
    Varint(u64),
    Bytes(&'a [u8]),
    Fixed,
}

pub(crate) struct Field<'a> {
    pub number: u32,
    pub value: Value<'a>,
}

fn read_varint(buf: &[u8], pos: &mut usize) -> Option<u64> {
    let mut result = 0u64;
    for shift in (0..70).step_by(7) {
        let byte = *buf.get(*pos)?;
        *pos += 1;
        result |= u64::from(byte & 0x7f).checked_shl(shift)?;
        if byte & 0x80 == 0 {
            return Some(result);
        }
    }
    None
}

/// Decodes one protobuf message level. `None` on any malformed, truncated or oversized input.
pub(crate) fn parse_fields(buf: &[u8]) -> Option<Vec<Field<'_>>> {
    let mut fields = Vec::new();
    let mut pos = 0;
    while pos < buf.len() {
        if fields.len() >= MAX_FIELDS {
            return None;
        }
        let key = read_varint(buf, &mut pos)?;
        let number = u32::try_from(key >> 3).ok().filter(|n| *n > 0)?;
        let value = match key & 7 {
            0 => Value::Varint(read_varint(buf, &mut pos)?),
            1 | 5 => {
                let len = if key & 7 == 1 { 8 } else { 4 };
                pos = pos.checked_add(len).filter(|end| *end <= buf.len())?;
                Value::Fixed
            }
            2 => {
                let len = usize::try_from(read_varint(buf, &mut pos)?).ok()?;
                let end = pos.checked_add(len).filter(|end| *end <= buf.len())?;
                let slice = &buf[pos..end];
                pos = end;
                Value::Bytes(slice)
            }
            _ => return None,
        };
        fields.push(Field { number, value });
    }
    Some(fields)
}

fn text(fields: &[Field], number: u32) -> Option<String> {
    fields.iter().find_map(|f| match (&f.value, f.number == number) {
        (Value::Bytes(b), true) => std::str::from_utf8(b).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        _ => None,
    })
}

#[derive(Debug, PartialEq)]
pub(crate) struct ProductInstall {
    pub uid: String,
    pub code: Option<String>,
    pub path: Option<String>,
}

/// Every `ProductInstall` (top-level field 1) of a `product.db` image.
pub(crate) fn parse_product_db(buf: &[u8]) -> Option<Vec<ProductInstall>> {
    let mut out = Vec::new();
    for f in parse_fields(buf)? {
        let (1, Value::Bytes(inner)) = (f.number, &f.value) else { continue };
        let Some(product) = parse_fields(inner) else { continue };
        let Some(uid) = text(&product, 1) else { continue };
        let path = product.iter().find_map(|p| match (&p.value, p.number) {
            (Value::Bytes(settings), 3) => parse_fields(settings).and_then(|s| text(&s, 1)),
            _ => None,
        });
        out.push(ProductInstall { uid, code: text(&product, 2), path });
    }
    Some(out)
}

fn is_blizzard_game(e: &UninstallEntry) -> bool {
    e.publisher.to_lowercase().contains("blizzard") && !e.name.to_lowercase().starts_with("battle.net")
}

/// Joins the Agent database with the Blizzard uninstall entries; only folders that exist are reported.
pub(crate) fn build_games(db: &[ProductInstall], entries: &[UninstallEntry]) -> Vec<DetectedGame> {
    let registry_title = |path: &str| entries.iter().find(|e| norm_path(&e.location) == norm_path(path)).map(|e| e.name.clone());
    let mut seen = HashSet::new();
    let mut games = Vec::new();
    for p in db {
        let Some(path) = p.path.as_deref() else { continue };
        let Some(dir) = existing_dir(path) else { continue };
        if !seen.insert(norm_path(path)) {
            continue;
        }
        let title = known_title(&p.uid)
            .or_else(|| p.code.as_deref().and_then(known_title))
            .map(str::to_string)
            .or_else(|| registry_title(path))
            .or_else(|| folder_name(path))
            .unwrap_or_else(|| p.uid.clone());
        games.push(DetectedGame {
            store_id: p.uid.clone(),
            title,
            installed: true,
            install_path: Some(dir.to_string_lossy().into_owned()),
            ..Default::default()
        });
    }
    for e in entries.iter().filter(|e| is_blizzard_game(e)) {
        let Some(dir) = existing_dir(&e.location) else { continue };
        if !seen.insert(norm_path(&e.location)) {
            continue;
        }
        games.push(DetectedGame {
            store_id: e.key.clone(),
            title: e.name.clone(),
            installed: true,
            install_path: Some(dir.to_string_lossy().into_owned()),
            ..Default::default()
        });
    }
    games
}

pub fn scan_battlenet() -> ProviderDetection {
    let agent = program_data().join("Battle.net").join("Agent");
    let db_path = agent.join("product.db");
    let entries = uninstall_entries();
    let launcher = agent.is_dir() || entries.iter().any(|e| e.name.eq_ignore_ascii_case("Battle.net"));
    if !launcher {
        return ProviderDetection::unavailable("battlenet", SOURCE, "Battle.net não está instalado.");
    }
    let db = match fs::metadata(&db_path) {
        Ok(m) if m.len() <= MAX_DB => fs::read(&db_path).ok().and_then(|b| parse_product_db(&b)),
        _ => None,
    };
    let games = build_games(db.as_deref().unwrap_or(&[]), &entries);
    if games.is_empty() {
        let why = if db.is_none() { "product.db ausente ou ilegível" } else { "product.db sem jogos com pasta existente" };
        return ProviderDetection::unavailable("battlenet", SOURCE, &format!("Battle.net instalado: {why} e nenhum jogo da Blizzard no registro."));
    }
    ProviderDetection::from_games("battlenet", SOURCE, games, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn varint(mut v: u64) -> Vec<u8> {
        let mut out = Vec::new();
        loop {
            let b = (v & 0x7f) as u8;
            v >>= 7;
            if v == 0 {
                out.push(b);
                return out;
            }
            out.push(b | 0x80);
        }
    }

    fn bytes_field(number: u32, data: &[u8]) -> Vec<u8> {
        let mut out = varint(u64::from(number) << 3 | 2);
        out.extend(varint(data.len() as u64));
        out.extend(data);
        out
    }

    fn product(uid: &str, code: &str, path: &str) -> Vec<u8> {
        let mut inner = bytes_field(1, uid.as_bytes());
        inner.extend(bytes_field(2, code.as_bytes()));
        inner.extend(bytes_field(3, &bytes_field(1, path.as_bytes())));
        inner.extend(varint(5 << 3)); // trailing varint field is skipped
        inner.extend(varint(1));
        bytes_field(1, &inner)
    }

    #[test]
    fn reads_products_with_install_paths() {
        let mut db = product("s2", "s2", "C:\\Games\\StarCraft II");
        db.extend(product("zzz", "zzz", "C:\\Games\\Other"));
        db.extend(bytes_field(2, b"unrelated top-level message"));
        let parsed = parse_product_db(&db).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0], ProductInstall { uid: "s2".into(), code: Some("s2".into()), path: Some("C:\\Games\\StarCraft II".into()) });
    }

    #[test]
    fn malformed_input_never_panics_or_hangs() {
        let good = product("s1", "s1", "C:\\x");
        for cut in 0..good.len() {
            let _ = parse_product_db(&good[..cut]); // every truncation point
        }
        assert!(parse_fields(&[0xff; 32]).is_none(), "unterminated varint");
        assert!(parse_fields(&[0x0a, 0xff, 0xff, 0xff, 0xff, 0x0f]).is_none(), "length past the buffer");
        assert!(parse_fields(&[0x0a, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01]).is_none(), "length overflows usize math");
        assert!(parse_fields(&[0x00, 0x01]).is_none(), "field number 0");
        assert!(parse_fields(&[0x0b]).is_none(), "start-group wire type");
        assert!(parse_fields(&[0x0d, 1, 2]).is_none(), "truncated fixed32");
        assert_eq!(parse_fields(&[]).unwrap().len(), 0);
        let flood = [0x08u8, 0x01].repeat(MAX_FIELDS + 1);
        assert!(parse_fields(&flood).is_none(), "field-count cap");
    }

    #[test]
    fn maps_known_titles_and_falls_back() {
        assert_eq!(known_title("WoW_Classic"), Some("World of Warcraft Classic"));
        assert_eq!(known_title("unknown_product"), None);
        let dir = std::env::temp_dir().join("games-gallery-bnet-unknown");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_string_lossy().into_owned();
        let db = [ProductInstall { uid: "mystery".into(), code: None, path: Some(path.clone()) }];
        assert_eq!(build_games(&db, &[])[0].title, "games-gallery-bnet-unknown");
        let entry = UninstallEntry { key: "k".into(), name: "Registry Title".into(), publisher: "Blizzard Entertainment".into(), location: path };
        assert_eq!(build_games(&db, &[entry])[0].title, "Registry Title");
    }

    #[test]
    fn registry_only_games_are_added_once_and_launcher_is_skipped() {
        let dir = std::env::temp_dir().join("games-gallery-bnet-reg");
        fs::create_dir_all(&dir).unwrap();
        let loc = dir.to_string_lossy().into_owned();
        let game = UninstallEntry { key: "Warcraft III".into(), name: "Warcraft III".into(), publisher: "Blizzard Entertainment".into(), location: loc.clone() };
        let launcher = UninstallEntry { key: "Battle.net".into(), name: "Battle.net".into(), publisher: "Blizzard Entertainment".into(), location: loc };
        let games = build_games(&[], &[game, launcher]);
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].title, "Warcraft III");
    }

    #[test]
    fn skips_products_whose_folder_is_gone() {
        let db = [ProductInstall { uid: "wow".into(), code: None, path: Some("Z:\\nope\\gg-bnet".into()) }];
        assert!(build_games(&db, &[]).is_empty());
    }
}
