//! PlayStation Network played-games list. Sony has no public API: this follows the flow of the
//! open-source `psn-api` library (the PlayStation App's OAuth client). The user pastes the NPSSO
//! cookie from their own browser session; it is used once, in memory, and never stored or logged.

use crate::account_login::{get_text, MAX_PAGES, USER_AGENT};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::Url;
use tauri_plugin_http::reqwest;

// Public identifiers of the PlayStation App's OAuth client (shipped in the app and in psn-api).
const CLIENT_ID: &str = "09515159-7237-4370-9b40-3806e67c0891";
const CLIENT_BASIC: &str = "MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=";
const REDIRECT: &str = "com.scee.psxandroid.scecompcall://redirect";
const AUTHORIZE: &str = "https://ca.account.sony.com/api/authz/v3/oauth/authorize";
const TOKEN: &str = "https://ca.account.sony.com/api/authz/v3/oauth/token";
const GAMELIST: &str = "https://m.np.playstation.com/api/gamelist/v2/users/me/titles";
const PAGE: usize = 200;
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PsnGame {
    pub store_id: String,
    pub title: String,
    pub platform_id: &'static str,
    pub playtime_h: f64,
}

fn valid_npsso(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_alphanumeric())
}

/// The authorize endpoint answers 302 to the app's custom scheme with `?code=v3.…`.
fn code_from_location(location: &str) -> Option<String> {
    let url: Url = location.parse().ok()?;
    if !location.starts_with(REDIRECT) {
        return None;
    }
    let code = url.query_pairs().find(|(k, _)| k == "code")?.1.into_owned();
    (code.len() <= 200 && code.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')).then_some(code)
}

fn title_id_ok(s: &str) -> bool {
    (1..=40).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

/// ISO 8601 duration as Sony sends it (`PT12H3M4S`, sometimes `P1DT2H`) -> hours, one decimal.
fn duration_hours(s: &str) -> f64 {
    let (mut secs, mut num, mut in_time) = (0f64, String::new(), false);
    for c in s.chars() {
        match c {
            'P' => {}
            'T' => in_time = true,
            '0'..='9' | '.' => num.push(c),
            _ => {
                let n: f64 = num.parse().unwrap_or(0.0);
                num.clear();
                secs += n * match (c, in_time) {
                    ('D', false) => 86_400.0,
                    ('H', true) => 3_600.0,
                    ('M', true) => 60.0,
                    ('S', true) => 1.0,
                    _ => 0.0,
                };
            }
        }
    }
    (secs / 360.0).round() / 10.0
}

/// One gamelist page -> games (PS4/PS5 only; PS3/Vita/apps are dropped) and the next offset.
pub(crate) fn parse_gamelist(json: &Value) -> Result<(Vec<PsnGame>, Option<u64>), String> {
    let titles = json.get("titles").and_then(Value::as_array).ok_or("A PSN respondeu fora do formato esperado (sem titles).")?;
    let games = titles
        .iter()
        .filter_map(|t| {
            let id = t.get("titleId").and_then(Value::as_str).filter(|s| title_id_ok(s))?;
            let platform_id = match t.get("category").and_then(Value::as_str)? {
                "ps4_game" => "ps4",
                "ps5_native_game" => "ps5",
                _ => return None,
            };
            let name = ["localizedName", "name"].iter().find_map(|k| t.get(*k).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty() && s.len() <= 300))?;
            let playtime_h = t.get("playDuration").and_then(Value::as_str).map_or(0.0, duration_hours);
            Some(PsnGame { store_id: id.to_string(), title: name.to_string(), platform_id, playtime_h })
        })
        .collect();
    Ok((games, json.get("nextOffset").and_then(Value::as_u64)))
}

async fn access_token(client: &reqwest::Client, npsso: &str) -> Result<String, String> {
    let auth = Url::parse_with_params(AUTHORIZE, &[
        ("access_type", "offline"),
        ("client_id", CLIENT_ID),
        ("redirect_uri", REDIRECT),
        ("response_type", "code"),
        ("scope", "psn:mobile.v2.core psn:clientapp"),
    ])
    .map_err(|e| e.to_string())?;
    let res = client.get(auth).header("Cookie", format!("npsso={npsso}")).timeout(TIMEOUT).send().await.map_err(|e| format!("Falha de rede: {}", e.without_url()))?;
    let code = res
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .and_then(code_from_location)
        .ok_or("A Sony recusou o NPSSO (expirado ou inválido). Entre de novo em playstation.com e copie um novo.")?;
    let body: String = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("code", &code)
        .append_pair("redirect_uri", REDIRECT)
        .append_pair("grant_type", "authorization_code")
        .append_pair("token_format", "jwt")
        .finish();
    let req = client.post(TOKEN).header("Authorization", format!("Basic {CLIENT_BASIC}")).header("Content-Type", "application/x-www-form-urlencoded").body(body);
    let json: Value = serde_json::from_str(&get_text(req).await?).map_err(|_| "A Sony respondeu fora do formato esperado.".to_string())?;
    json.get("access_token").and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string).ok_or_else(|| "A Sony não devolveu uma sessão.".to_string())
}

#[tauri::command]
pub async fn psn_library(npsso: String) -> Result<Vec<PsnGame>, String> {
    let npsso = npsso.trim();
    if !valid_npsso(npsso) {
        return Err("NPSSO inválido: são 64 letras e números.".into());
    }
    let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).user_agent(USER_AGENT).build().map_err(|e| e.to_string())?;
    let token = access_token(&client, npsso).await?;
    let mut games: Vec<PsnGame> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut offset = 0u64;
    for _ in 0..MAX_PAGES {
        let url = format!("{GAMELIST}?categories=ps4_game,ps5_native_game&limit={PAGE}&offset={offset}");
        let req = client.get(url).header("Authorization", format!("Bearer {token}")).header("Accept", "application/json");
        let json: Value = serde_json::from_str(&get_text(req).await?).map_err(|_| "A PSN respondeu fora do formato esperado.".to_string())?;
        let (page, next) = parse_gamelist(&json)?;
        games.extend(page.into_iter().filter(|g| seen.insert(g.store_id.clone())));
        match next {
            Some(n) if n > offset => offset = n,
            _ => return Ok(games),
        }
    }
    Err(format!("A lista passou de {MAX_PAGES} páginas: leitura interrompida para não importar uma lista incompleta."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn accepts_only_a_64_char_alphanumeric_npsso() {
        assert!(valid_npsso(&"a1".repeat(32)));
        assert!(!valid_npsso(&"a".repeat(63)));
        assert!(!valid_npsso(&format!("{};x=1", "a".repeat(60))));
        assert!(!valid_npsso(""));
    }

    #[test]
    fn extracts_the_code_only_from_the_app_redirect() {
        assert_eq!(code_from_location(&format!("{REDIRECT}/?code=v3.AbC_1-2&cid=x")).as_deref(), Some("v3.AbC_1-2"));
        assert_eq!(code_from_location("https://evil.example/?code=v3.abc"), None);
        assert_eq!(code_from_location(&format!("{REDIRECT}/?error=login_required")), None);
        assert_eq!(code_from_location(&format!("{REDIRECT}/?code=a%0Ab")), None);
    }

    #[test]
    fn converts_iso_durations_to_hours() {
        assert_eq!(duration_hours("PT12H30M"), 12.5);
        assert_eq!(duration_hours("P1DT2H"), 26.0);
        assert_eq!(duration_hours("PT45S"), 0.0);
        assert_eq!(duration_hours("garbage"), 0.0);
    }

    #[test]
    fn parses_ps4_and_ps5_titles_and_the_next_offset() {
        let j = json!({"titles": [
            {"titleId": "PPSA01234_00", "name": "Game", "localizedName": "Jogo", "category": "ps5_native_game", "playDuration": "PT3H6M"},
            {"titleId": "CUSA00001_00", "name": "Old", "category": "ps4_game"},
            {"titleId": "NPWR0_00", "name": "PS3", "category": "ps3_game"},
            {"titleId": "../x", "name": "Bad", "category": "ps4_game"},
            {"titleId": "CUSA00002_00", "name": "  ", "category": "ps4_game"}
        ], "nextOffset": 200});
        let (games, next) = parse_gamelist(&j).unwrap();
        assert_eq!(games, vec![
            PsnGame { store_id: "PPSA01234_00".into(), title: "Jogo".into(), platform_id: "ps5", playtime_h: 3.1 },
            PsnGame { store_id: "CUSA00001_00".into(), title: "Old".into(), platform_id: "ps4", playtime_h: 0.0 },
        ]);
        assert_eq!(next, Some(200));
        assert!(parse_gamelist(&json!({"error": {"code": 2240526}})).is_err());
    }
}
