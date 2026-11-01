//! Ubisoft Connect owned library. Ubisoft's local ownership cache is encrypted, so the list comes from
//! the ubiservices GraphQL endpoint, following the flow of the open-source Galaxy plugin
//! (FriendsOfGalaxy/galaxy-integration-uplay): sign in at connect.ubisoft.com with the Club app id,
//! read the session the login page keeps in localStorage, register it, then query `AllGames`.
//! Not validated against a real account: failures are reported as errors, never as an empty library.

use crate::account_login::{get_text, into_blocking, open_login, wait_for, RemoteGame};
use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Url};
use tauri_plugin_http::reqwest;

// Public identifiers of Ubisoft's own web client (they ship in the plugin and in the login URL).
const CLUB_APPID: &str = "b8fde481-327d-4031-85ce-7c10a202a700";
const START: &str = "https://connect.ubisoft.com/login?appId=b8fde481-327d-4031-85ce-7c10a202a700&genomeId=fbd6791c-a6c6-4206-a75e-77234080b87b&lang=en-US&nextUrl=https:%2F%2Fconnect.ubisoft.com%2Fready";
const SENTINEL: &str = "https://connect.ubisoft.com/__gg_ubi__/";
const SESSIONS: &str = "https://public-ubiservices.ubi.com/v2/profiles/sessions";
const GRAPHQL: &str = "https://public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Same query the Galaxy plugin sends (backend.py `get_club_titles`).
const ALL_GAMES: &str = "query AllGames { viewer { id ...ownedGamesList } } \
fragment gameProps on Game { id spaceId name } \
fragment ownedGameProps on Game { ...gameProps viewer { meta { id ownedPlatformGroups { id name type } } } } \
fragment ownedGamesList on User { ownedGames: games(filterBy: {isOwned: true}) { totalCount nodes { ...ownedGameProps } } }";

/// Runs on connect.ubisoft.com only: after login the site lands on /ready; /change_domain/ is the page
/// whose localStorage holds the session. The ticket leaves the page once, through the sentinel URL.
const HOOK: &str = r#"(function () {
  if (window.top !== window || location.origin !== "https://connect.ubisoft.com") return;
  var SENTINEL = "https://connect.ubisoft.com/__gg_ubi__/";
  if (location.pathname.indexOf("/ready") === 0) { window.addEventListener("load", function () { location.replace("/change_domain/"); }); return; }
  if (location.pathname.indexOf("/change_domain") !== 0) return;
  function read() {
    var out = {};
    ["PRODloginData", "PRODrememberMe", "PRODlastProfile"].forEach(function (k) {
      try {
        var o = JSON.parse(localStorage.getItem(k) || "null");
        if (o && typeof o === "object") ["ticket", "sessionId"].forEach(function (f) { if (typeof o[f] === "string") out[f] = o[f]; });
      } catch (e) {}
    });
    return out;
  }
  var tries = 0;
  (function poll() {
    var out = read();
    if (out.ticket) {
      window.location.href = SENTINEL + btoa(unescape(encodeURIComponent(JSON.stringify(out)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } else if (++tries > 60) {
      window.location.href = SENTINEL + "none";
    } else {
      setTimeout(poll, 250);
    }
  })();
})();"#;

#[derive(Deserialize)]
struct Captured {
    ticket: String,
    #[serde(rename = "sessionId")]
    session_id: String,
}

pub(crate) struct UbiSession {
    pub ticket: String,
    pub session_id: String,
}

fn is_uuid(v: &str) -> bool {
    v.len() == 36 && v.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-')
}

/// Decodes and validates what the sentinel URL carries; anything off-pattern is refused.
pub(crate) fn captured_from(url: &Url) -> Option<UbiSession> {
    let raw = url.as_str().strip_prefix(SENTINEL)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(raw.as_bytes()).ok()?;
    let c: Captured = serde_json::from_slice(&bytes).ok()?;
    let ticket_ok = c.ticket.len() >= 16 && c.ticket.len() <= 8192 && c.ticket.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-+/=".contains(&b));
    (ticket_ok && is_uuid(&c.session_id)).then_some(UbiSession { ticket: c.ticket, session_id: c.session_id })
}

/// Platform types of one game: `ownedPlatformGroups` is a list of groups, each a list of `{type}`.
fn platform_types(node: &Value) -> Vec<&str> {
    let groups = node.pointer("/viewer/meta/ownedPlatformGroups").and_then(Value::as_array);
    groups
        .into_iter()
        .flatten()
        .flat_map(|g| g.as_array().into_iter().flatten().chain(g.is_object().then_some(g)))
        .filter_map(|p| p.get("type").and_then(Value::as_str))
        .collect()
}

/// `data.viewer.ownedGames.nodes[]` -> PC games keyed by spaceId (the id the Galaxy plugin uses).
/// A game with no platform info is kept; one that lists platforms but not PC is console-only and dropped.
pub(crate) fn parse_all_games(json: &Value) -> Result<Vec<RemoteGame>, String> {
    let owned = json.pointer("/data/viewer/ownedGames");
    let nodes = owned
        .and_then(|o| o.get("nodes"))
        .and_then(Value::as_array)
        .ok_or("A Ubisoft respondeu fora do formato esperado (a consulta pode ter sido recusada).")?;
    if json.get("errors").and_then(Value::as_array).is_some_and(|e| !e.is_empty()) {
        return Err("A Ubisoft devolveu erros na consulta; a lista pode estar incompleta.".into());
    }
    if owned.and_then(|o| o.get("totalCount")).and_then(Value::as_u64).is_some_and(|n| n > nodes.len() as u64) {
        return Err("A Ubisoft devolveu só parte da biblioteca (paginada); nada foi importado.".into());
    }
    // GraphQL sends `spaceId: null` for titles without one, so each fallback must check for a string.
    let valid: Vec<(&Value, String, String)> = nodes
        .iter()
        .filter_map(|n| {
            let ok_id = |s: &&str| !s.is_empty() && s.len() <= 100 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b));
            let id = n.get("spaceId").and_then(Value::as_str).filter(ok_id).or_else(|| n.get("id").and_then(Value::as_str).filter(ok_id))?;
            let name = n.get("name").and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty() && s.len() <= 300)?;
            Some((n, id.to_string(), name.to_string()))
        })
        .collect();
    if !nodes.is_empty() && valid.is_empty() {
        return Err("A Ubisoft listou jogos, mas nenhum veio no formato esperado.".into());
    }
    let mut seen = std::collections::HashSet::new();
    Ok(valid
        .into_iter()
        .filter(|(n, _, _)| {
            let p = platform_types(n);
            p.is_empty() || p.contains(&"PC")
        })
        .filter_map(|(_, id, title)| seen.insert(id.clone()).then_some(RemoteGame { store_id: id, title }))
        .collect())
}

/// Navigation gate. The sentinel counts only right after the page that reads the session
/// (`/change_domain`), so another page cannot feed the app a library by navigating to it.
pub(crate) fn gate(armed: &AtomicBool, u: &Url) -> (bool, bool) {
    if u.as_str().starts_with(SENTINEL) {
        return (false, armed.swap(false, Ordering::SeqCst));
    }
    armed.store(u.host_str() == Some("connect.ubisoft.com") && u.path().starts_with("/change_domain"), Ordering::SeqCst);
    (true, false)
}

fn ubi_request(client: &reqwest::Client, url: &str, s: &UbiSession) -> reqwest::RequestBuilder {
    client
        .post(url)
        .header("Authorization", format!("Ubi_v1 t={}", s.ticket))
        .header("Ubi-AppId", CLUB_APPID)
        .header("Ubi-SessionId", &s.session_id)
        .header("User-Agent", USER_AGENT)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
}

#[tauri::command]
pub async fn ubisoft_library(app: AppHandle) -> Result<Vec<RemoteGame>, String> {
    let armed = Arc::new(AtomicBool::new(false));
    let (window, rx) = open_login(&app, "login-ubisoft", START, Some(HOOK), move |u| gate(&armed, u), None)?;
    let captured = into_blocking(move || {
        let mut found = None;
        // Every sentinel is final: a malformed one must fail now, not leave the window waiting for 5 minutes.
        let r = wait_for(&rx, |u| {
            found = Some(captured_from(u));
            Some(())
        });
        r.and_then(|()| found.flatten().ok_or_else(|| "A Ubisoft entregou a sessão em formato inesperado ou vazia.".to_string()))
    })
    .await;
    let _ = window.close();
    let session = captured??;

    let client = reqwest::Client::new();
    // The plugin registers the session before querying; a refusal here means the ticket is not usable.
    get_text(ubi_request(&client, SESSIONS, &session)).await.map_err(|e| format!("A Ubisoft recusou a sessão ({e})."))?;
    let body = get_text(ubi_request(&client, GRAPHQL, &session).body(json!({ "operationName": "AllGames", "variables": { "owned": true }, "query": ALL_GAMES }).to_string())).await?;
    let json: Value = serde_json::from_str(&body).map_err(|_| "A Ubisoft respondeu fora do formato esperado.".to_string())?;
    parse_all_games(&json)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b64(s: &str) -> String {
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(s)
    }
    fn url(s: &str) -> Url {
        s.parse().unwrap()
    }
    const SESS: &str = "314d4fef-e568-454a-ae06-43e3bece12a6";
    const TICKET: &str = "abcdefghij.klmnopqrst-uv";

    fn capture(v: Value) -> Option<UbiSession> {
        captured_from(&url(&format!("{SENTINEL}{}", b64(&v.to_string()))))
    }

    #[test]
    fn start_url_carries_the_constants() {
        assert!(START.contains(CLUB_APPID) && START.contains("genomeId="));
        assert!(START.starts_with("https://connect.ubisoft.com/login?"));
    }

    #[test]
    fn decodes_a_well_formed_capture() {
        let got = capture(json!({"ticket": TICKET, "sessionId": SESS, "userId": SESS, "nameOnPlatform": "x"})).unwrap();
        assert_eq!((got.ticket.as_str(), got.session_id.as_str()), (TICKET, SESS));
        assert!(capture(json!({"ticket": TICKET, "sessionId": SESS})).is_some()); // userId is optional
    }

    #[test]
    fn refuses_anything_off_pattern() {
        assert!(capture(json!({"ticket": "short", "sessionId": SESS})).is_none());
        assert!(capture(json!({"ticket": "abcdefghij klmnopqrst\r\nX: y", "sessionId": SESS})).is_none()); // header injection
        assert!(capture(json!({"ticket": TICKET, "sessionId": "not-a-uuid"})).is_none());
        assert!(capture(json!({"ticket": TICKET, "sessionId": SESS, "userId": "ignored"})).is_some()); // unused field never rejects
        assert!(capture(json!({"sessionId": SESS})).is_none());
        assert!(captured_from(&url(&format!("{SENTINEL}!!!notbase64"))).is_none());
        assert!(captured_from(&url(&format!("{SENTINEL}{}", b64("not json")))).is_none());
        assert!(captured_from(&url("https://evil.example/__gg_ubi__/x")).is_none());
        assert!(captured_from(&url("https://connect.ubisoft.com/ready")).is_none());
    }

    #[test]
    fn a_null_space_id_falls_back_to_the_game_id() {
        let j = json!({"data": {"viewer": {"ownedGames": {"totalCount": 1, "nodes": [{"id": "g7", "spaceId": null, "name": "Legacy"}]}}}});
        let games = parse_all_games(&j).unwrap();
        assert_eq!((games[0].store_id.as_str(), games[0].title.as_str()), ("g7", "Legacy"));
    }

    #[test]
    fn partial_or_unusable_responses_are_errors_not_a_smaller_library() {
        let node = json!({"id": "g1", "spaceId": "s1", "name": "One"});
        let truncated = json!({"data": {"viewer": {"ownedGames": {"totalCount": 5, "nodes": [node]}}}});
        assert!(parse_all_games(&truncated).is_err());
        let with_errors = json!({"errors": [{"message": "boom"}], "data": {"viewer": {"ownedGames": {"totalCount": 1, "nodes": [node]}}}});
        assert!(parse_all_games(&with_errors).is_err());
        let unusable = json!({"data": {"viewer": {"ownedGames": {"totalCount": 1, "nodes": [{"id": "bad id!", "name": "x"}]}}}});
        assert!(parse_all_games(&unusable).is_err());
        // a console-only library is a legitimate empty result
        let console = json!({"data": {"viewer": {"ownedGames": {"totalCount": 1, "nodes": [{"id": "g2", "spaceId": "s2", "name": "Console", "viewer": {"meta": {"ownedPlatformGroups": [[{"type": "PS5"}]]}}}]}}}});
        assert!(parse_all_games(&console).unwrap().is_empty());
    }

    #[test]
    fn the_sentinel_only_counts_right_after_change_domain() {
        let armed = AtomicBool::new(false);
        let sentinel = url(&format!("{SENTINEL}{}", b64("{}")));
        assert_eq!(gate(&armed, &sentinel), (false, false)); // forged from nowhere: cancelled, not signalled
        assert_eq!(gate(&armed, &url("https://connect.ubisoft.com/change_domain/")), (true, false));
        assert_eq!(gate(&armed, &sentinel), (false, true));
        assert_eq!(gate(&armed, &sentinel), (false, false)); // one use
        gate(&armed, &url("https://connect.ubisoft.com/change_domain/"));
        gate(&armed, &url("https://accounts.example/other")); // any other page disarms
        assert_eq!(gate(&armed, &sentinel), (false, false));
        gate(&armed, &url("https://evil.example/change_domain/"));
        assert_eq!(gate(&armed, &sentinel), (false, false)); // host must match
    }

    #[test]
    fn parses_owned_games_and_fails_loudly_on_a_refused_query() {
        let pc = json!({"meta": {"id": "m", "ownedPlatformGroups": [[{"id": "1", "name": "PC", "type": "PC"}]]}});
        let console = json!({"meta": {"id": "m", "ownedPlatformGroups": [[{"id": "2", "name": "PS5", "type": "PS5"}]]}});
        let j = json!({"data": {"viewer": {"id": "x", "ownedGames": {"totalCount": 5, "nodes": [
            {"id": "g1", "spaceId": "6edd234a-abff-4e90-9aab-b9b9c6e49f01", "name": "  Fake Game  ", "viewer": pc},
            {"id": "g2", "spaceId": "6edd234a-abff-4e90-9aab-b9b9c6e49f01", "name": "Duplicate"},
            {"id": "g3", "name": "No platform info"},
            {"id": "g4", "spaceId": "console-only", "name": "Console Only", "viewer": console},
            {"id": "bad id too!", "spaceId": "bad id!", "name": "Bad"},
            {"id": "g6", "spaceId": "ok-id", "name": ""}
        ]}}}});
        let games = parse_all_games(&j).unwrap();
        assert_eq!(games.iter().map(|g| (g.store_id.as_str(), g.title.as_str())).collect::<Vec<_>>(), [("6edd234a-abff-4e90-9aab-b9b9c6e49f01", "Fake Game"), ("g3", "No platform info")]);
        for bad in [json!(null), json!({"errors": [{"message": "forbidden"}]}), json!({"data": {"viewer": null}})] {
            assert!(parse_all_games(&bad).is_err());
        }
        assert!(parse_all_games(&json!({"data": {"viewer": {"ownedGames": {"nodes": []}}}})).unwrap().is_empty());
    }
}
