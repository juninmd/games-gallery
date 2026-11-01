//! Account libraries that only exist on a store's servers (Battle.net, EA app).
//! The user signs in inside a throw-away window (no IPC permissions, anonymous session); the
//! session is used once, in memory, to read the library, and the window is closed. Nothing is stored.

use serde::Serialize;
use serde_json::{json, Value};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_http::reqwest;

const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_BODY: usize = 4 * 1024 * 1024;
const MAX_PAGES: usize = 20;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteGame {
    pub store_id: String,
    pub title: String,
}

pub(crate) enum Signal {
    Url(Url),
    Closed,
}

fn str_of<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty() && s.len() <= 300)
}

// ---------------------------------------------------------------- Battle.net

/// `account.battle.net/api/games-and-subs` -> one entry per title (titleId is the stable key).
pub(crate) fn parse_bnet(json: &Value) -> Result<Vec<RemoteGame>, String> {
    let accounts = json.get("gameAccounts").and_then(Value::as_array).ok_or("A Battle.net respondeu fora do formato esperado (sem gameAccounts).")?;
    let mut seen = std::collections::HashSet::new();
    Ok(accounts
        .iter()
        .filter_map(|acc| {
            let id = acc.get("titleId").and_then(Value::as_i64).filter(|n| *n > 0)?;
            let title = str_of(acc, "localizedGameName")?;
            seen.insert(id).then(|| RemoteGame { store_id: id.to_string(), title: title.to_string() })
        })
        .collect())
}

pub(crate) fn bnet_overview(url: &Url) -> bool {
    url.host_str() == Some("account.battle.net") && url.path().starts_with("/overview")
}

/// Only bare `name=value` pairs with header-safe bytes are forwarded.
pub(crate) fn cookie_header(pairs: &[(String, String)]) -> String {
    let safe = |s: &str| !s.is_empty() && s.bytes().all(|b| (0x21..=0x7e).contains(&b) && b != b';' && b != b',');
    pairs.iter().filter(|(n, v)| safe(n) && (v.is_empty() || safe(v))).map(|(n, v)| format!("{n}={v}")).collect::<Vec<_>>().join("; ")
}

// ---------------------------------------------------------------- EA app

const EA_SENTINEL: &str = "https://www.ea.com/__gg_token__/";
const EA_GRAPHQL: &str = "https://service-aggregation-layer.juno.ea.com/graphql";
// Persisted-query hash used by Playnite's EaLibrary and GameIndex; EA rotates it, so it lives in one place.
const EA_OWNED_HASH: &str = "779f1cd1355699752e20c0b3877847f4e3010ef5de131c248e98f8eff84f0718";

/// Observes the page's own calls to EA's GraphQL gateway and, when one carries a bearer token,
/// navigates to a sentinel URL that `on_navigation` intercepts (and cancels) in Rust.
const EA_HOOK: &str = r#"(function () {
  if (window.top !== window || window.__ggHook) return; window.__ggHook = true;
  var SENTINEL = "https://www.ea.com/__gg_token__/";
  var GQL = "https://service-aggregation-layer.juno.ea.com/graphql";
  function offer(v) {
    if (typeof v !== "string") return;
    var m = /^Bearer\s+(\S+)$/i.exec(v);
    if (m) window.location.href = SENTINEL + encodeURIComponent(m[1]);
  }
  var of = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = (input && input.url) || String(input);
      if (url.indexOf(GQL) === 0) {
        var h = (init && init.headers) || (input && input.headers);
        if (h && typeof h.get === "function") offer(h.get("authorization"));
        else if (h) offer(h.authorization || h.Authorization);
      }
    } catch (e) {}
    return of.apply(this, arguments);
  };
  var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, u) { this.__gg = String(u).indexOf(GQL) === 0; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (n, v) {
    try { if (this.__gg && String(n).toLowerCase() === "authorization") offer(v); } catch (e) {}
    return xs.apply(this, arguments);
  };
})();"#;

pub(crate) fn ea_token_from(url: &Url) -> Option<String> {
    let raw = url.as_str().strip_prefix(EA_SENTINEL)?;
    let token: String = url::form_urlencoded::parse(format!("t={raw}").as_bytes()).next()?.1.into_owned();
    (token.len() >= 16 && token.len() <= 4096 && token.bytes().all(|b| b.is_ascii_graphic())).then_some(token)
}

/// One page of `data.me.ownedGameProducts` -> games + cursor.
pub(crate) fn parse_ea_page(json: &Value) -> Result<(Vec<RemoteGame>, Option<String>), String> {
    // A rotated persisted-query hash answers HTTP 200 with `errors` and no data: that is a failure, not an empty library.
    let owned = json.pointer("/data/me/ownedGameProducts").filter(|o| o.is_object()).ok_or("A EA recusou a consulta (a query persistida pode ter mudado de hash).")?;
    let games = owned
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let id = str_of(item, "originOfferId").or_else(|| str_of(item, "id")).or_else(|| str_of(item, "offerId"))?;
            let title = item.pointer("/product/name").and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty() && s.len() <= 300)?;
            Some(RemoteGame { store_id: id.to_string(), title: title.to_string() })
        })
        .collect();
    let next = owned.get("next").and_then(Value::as_str).map(str::to_string).filter(|s| !s.is_empty());
    Ok((games, next))
}

fn ea_page_url(next: &str) -> Result<Url, String> {
    let variables = json!({
        "isMac": false, "addFieldsToPreloadGames": true, "locale": "en", "limit": 500, "next": next,
        "type": ["DIGITAL_FULL_GAME", "PACKAGED_FULL_GAME"], "entitlementEnabled": true,
        "storefronts": ["EA", "STEAM", "EPIC"],
        "ownershipMethods": ["UNKNOWN", "ASSOCIATION", "PURCHASE", "REDEMPTION", "GIFT_RECEIPT", "ENTITLEMENT_GRANT", "DIRECT_ENTITLEMENT", "PRE_ORDER_PURCHASE", "VAULT", "XGP_VAULT", "STEAM", "STEAM_VAULT", "STEAM_SUBSCRIPTION", "EPIC", "EPIC_VAULT", "EPIC_SUBSCRIPTION"],
        "platforms": ["PC"],
    });
    let extensions = json!({ "persistedQuery": { "version": 1, "sha256Hash": EA_OWNED_HASH } });
    Url::parse_with_params(EA_GRAPHQL, [("operationName", "getPreloadedOwnedGames"), ("variables", &variables.to_string()), ("extensions", &extensions.to_string())])
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------- shared window + http plumbing

pub(crate) type LoadCheck = Box<dyn Fn(&Url) -> bool + Send + Sync>;

/// Opens an anonymous, IPC-less window. `nav` sees every top-level navigation and returns (allow, signal);
/// `on_loaded` is checked when a page finishes loading. The title always shows the current host, since the
/// window has no address bar.
pub(crate) fn open_login<F>(app: &AppHandle, label: &str, start: &str, script: Option<&str>, nav: F, on_loaded: Option<LoadCheck>) -> Result<(WebviewWindow, Receiver<Signal>), String>
where
    F: Fn(&Url) -> (bool, bool) + Send + 'static,
{
    let (tx, rx): (Sender<Signal>, Receiver<Signal>) = channel();
    let tx_nav = tx.clone();
    let tx_load = tx.clone();
    let url = start.parse::<Url>().map_err(|e| e.to_string())?;
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
        .title("Entrar na loja")
        .inner_size(520.0, 720.0)
        .incognito(true)
        .on_navigation(move |u| {
            if u.scheme() != "https" {
                return false;
            }
            let (allow, signal) = nav(u);
            if signal {
                let _ = tx_nav.send(Signal::Url(u.clone()));
            }
            allow
        })
        .on_page_load(move |w, payload| {
            if let Some(host) = payload.url().host_str() {
                let _ = w.set_title(&format!("Entrar na loja - {host}"));
            }
            if matches!(payload.event(), PageLoadEvent::Finished) && on_loaded.as_ref().is_some_and(|f| f(payload.url())) {
                let _ = tx_load.send(Signal::Url(payload.url().clone()));
            }
        });
    if let Some(js) = script {
        builder = builder.initialization_script(js);
    }
    let window = builder.build().map_err(|e| format!("Não foi possível abrir a janela de login: {e}"))?;
    window.on_window_event(move |e| {
        if matches!(e, WindowEvent::Destroyed) {
            let _ = tx.send(Signal::Closed);
        }
    });
    Ok((window, rx))
}

pub(crate) fn wait_for(rx: &Receiver<Signal>, mut on_url: impl FnMut(&Url) -> Option<()>) -> Result<(), String> {
    loop {
        match rx.recv_timeout(LOGIN_TIMEOUT) {
            Ok(Signal::Url(u)) => {
                if on_url(&u).is_some() {
                    return Ok(());
                }
            }
            Ok(Signal::Closed) => return Err("A janela de login foi fechada antes de terminar.".into()),
            Err(RecvTimeoutError::Timeout) => return Err("Tempo esgotado esperando o login (5 min).".into()),
            Err(RecvTimeoutError::Disconnected) => return Err("Login interrompido.".into()),
        }
    }
}

pub(crate) async fn get_text(req: reqwest::RequestBuilder) -> Result<String, String> {
    let res = req.timeout(HTTP_TIMEOUT).send().await.map_err(|e| format!("Falha de rede: {}", e.without_url()))?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status().as_u16()));
    }
    if res.content_length().is_some_and(|n| n as usize > MAX_BODY) {
        return Err("Resposta excede o limite permitido".into());
    }
    let bytes = res.bytes().await.map_err(|e| format!("Falha de rede: {}", e.without_url()))?;
    if bytes.len() > MAX_BODY {
        return Err("Resposta excede o limite permitido".into());
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| "Resposta inválida".to_string())
}

pub(crate) fn into_blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> impl std::future::Future<Output = Result<T, String>> {
    let handle = tauri::async_runtime::spawn_blocking(f);
    async move { handle.await.map_err(|e| e.to_string()) }
}

// ---------------------------------------------------------------- commands

const BNET_API: &str = "https://account.battle.net/api/games-and-subs";

#[tauri::command]
pub async fn battlenet_library(app: AppHandle) -> Result<Vec<RemoteGame>, String> {
    // The anonymous session is always sent to the login first; /overview finishing loading afterwards means signed in.
    let seen_login = Arc::new(AtomicBool::new(false));
    let nav_flag = seen_login.clone();
    let load_flag = seen_login;
    let (window, rx) = open_login(
        &app,
        "login-battlenet",
        "https://account.battle.net/overview",
        None,
        move |u| {
            if !bnet_overview(u) {
                nav_flag.store(true, Ordering::SeqCst);
            }
            (true, false)
        },
        Some(Box::new(move |u| bnet_overview(u) && load_flag.load(Ordering::SeqCst))),
    )?;
    let waited = into_blocking(move || wait_for(&rx, |_| Some(()))).await?;
    waited.inspect_err(|_| {
        let _ = window.close();
    })?;
    let api: Url = BNET_API.parse().map_err(|e: url::ParseError| e.to_string())?;
    let cookies = window.cookies_for_url(api);
    let _ = window.close();
    let cookies = cookies.map_err(|e| e.to_string())?;
    let header = cookie_header(&cookies.iter().map(|c| (c.name().to_string(), c.value().to_string())).collect::<Vec<_>>());
    if header.is_empty() {
        return Err("O login terminou sem sessão válida.".into());
    }
    let client = reqwest::Client::new();
    let req = client
        .get(BNET_API)
        .header("Cookie", header)
        .header("User-Agent", USER_AGENT)
        .header("Referer", "https://account.battle.net/overview")
        .header("Accept", "application/json");
    let body = get_text(req).await?;
    let json: Value = serde_json::from_str(&body).map_err(|_| "A Battle.net respondeu fora do formato esperado.".to_string())?;
    parse_bnet(&json)
}

#[tauri::command]
pub async fn ea_library(app: AppHandle) -> Result<Vec<RemoteGame>, String> {
    // The token is only accepted after the user reached the signed-in home page: a page-supplied
    // sentinel (or an anonymous bearer) before that point is ignored.
    let signed_in = Arc::new(AtomicBool::new(false));
    let flag = signed_in.clone();
    let (window, rx) = open_login(
        &app,
        "login-ea",
        "https://www.ea.com/login",
        Some(EA_HOOK),
        move |u| {
            if u.as_str().starts_with(EA_SENTINEL) {
                // Cancel the navigation; hand the token to Rust only once signed in.
                return (false, flag.load(Ordering::SeqCst));
            }
            let home = u.as_str() == "https://www.ea.com/";
            if home {
                flag.store(true, Ordering::SeqCst);
            }
            (true, home)
        },
        None,
    )?;
    let handle = window.clone();
    let token = into_blocking(move || {
        let mut token = None;
        let r = wait_for(&rx, |u| {
            if let Some(t) = ea_token_from(u) {
                token = Some(t);
                return Some(());
            }
            // Signed in: load a page that makes the gateway call the hook is waiting for.
            if u.as_str() == "https://www.ea.com/" {
                if let Ok(deals) = "https://www.ea.com/sales/deals".parse::<Url>() {
                    let _ = handle.navigate(deals);
                }
            }
            None
        });
        r.and_then(|()| token.ok_or_else(|| "Token não encontrado.".to_string()))
    })
    .await;
    let _ = window.close();
    let token = token??;

    let client = reqwest::Client::new();
    let mut games: Vec<RemoteGame> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut next = "0".to_string();
    for _ in 0..MAX_PAGES {
        let req = client
            .get(ea_page_url(&next)?)
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/json");
        let json: Value = serde_json::from_str(&get_text(req).await?).map_err(|_| "A EA respondeu fora do formato esperado.".to_string())?;
        let (page, cursor) = parse_ea_page(&json)?;
        games.extend(page.into_iter().filter(|g| seen.insert(g.store_id.clone())));
        match cursor {
            Some(c) if c != next => next = c,
            _ => return Ok(games),
        }
    }
    Err(format!("A biblioteca passou de {MAX_PAGES} páginas: leitura interrompida para não importar uma lista incompleta."))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        s.parse().unwrap()
    }

    #[test]
    fn parses_battlenet_titles_and_dedupes_by_title_id() {
        let j = json!({"gameAccounts": [
            {"titleId": 5730135, "localizedGameName": "World of Warcraft", "gameAccountName": "x#1"},
            {"titleId": 5730135, "localizedGameName": "World of Warcraft"},
            {"titleId": 0, "localizedGameName": "Zero"},
            {"titleId": 1, "localizedGameName": "  "},
            {"localizedGameName": "No id"},
            {"titleId": 1465140039, "localizedGameName": "Hearthstone"}
        ]});
        let games = parse_bnet(&j).unwrap();
        assert_eq!(games, vec![
            RemoteGame { store_id: "5730135".into(), title: "World of Warcraft".into() },
            RemoteGame { store_id: "1465140039".into(), title: "Hearthstone".into() },
        ]);
        // an unexpected shape is an error, not an empty library
        for bad in [json!(null), json!({}), json!({"gameAccounts": "no"})] {
            assert!(parse_bnet(&bad).is_err());
        }
        assert!(parse_bnet(&json!({"gameAccounts": []})).unwrap().is_empty());
    }

    #[test]
    fn recognizes_only_the_battlenet_overview_page() {
        assert!(bnet_overview(&url("https://account.battle.net/overview")));
        assert!(bnet_overview(&url("https://account.battle.net/overview/games")));
        assert!(!bnet_overview(&url("https://account.battle.net/login/en/")));
        assert!(!bnet_overview(&url("https://evil.example/overview")));
        assert!(!bnet_overview(&url("https://account.battle.net.evil.example/overview")));
    }

    #[test]
    fn cookie_header_drops_unsafe_pairs() {
        let pairs = vec![
            ("a".to_string(), "1".to_string()),
            ("b c".to_string(), "x".to_string()),
            ("d".to_string(), "x;y".to_string()),
            ("e".to_string(), "line\r\nbreak".to_string()),
            ("f".to_string(), String::new()),
        ];
        assert_eq!(cookie_header(&pairs), "a=1; f=");
    }

    #[test]
    fn extracts_the_ea_token_only_from_the_sentinel_url() {
        let ok = url(&format!("{EA_SENTINEL}ABCDEFGH12345678abcd"));
        assert_eq!(ea_token_from(&ok).as_deref(), Some("ABCDEFGH12345678abcd"));
        assert_eq!(ea_token_from(&url(&format!("{EA_SENTINEL}short"))), None);
        assert_eq!(ea_token_from(&url("https://www.ea.com/")), None);
        assert_eq!(ea_token_from(&url("https://evil.example/__gg_token__/ABCDEFGH12345678abcd")), None);
        // percent-decoded, but control characters are refused
        assert_eq!(ea_token_from(&url(&format!("{EA_SENTINEL}ABCDEFGH1234%0A5678abcd"))), None);
    }

    #[test]
    fn parses_an_ea_page_and_its_cursor() {
        let j = json!({"data": {"me": {"ownedGameProducts": {"items": [
            {"originOfferId": "Origin.OFR.50.0001", "product": {"name": "Fake Game", "baseItem": {"gameType": "BASE_GAME"}}},
            {"id": "Origin.OFR.50.0002", "product": {"name": "Other"}},
            {"originOfferId": "x", "product": {"name": ""}},
            {"product": {"name": "No id"}}
        ], "next": "500", "totalCount": 2}}}});
        let (games, next) = parse_ea_page(&j).unwrap();
        assert_eq!(games.iter().map(|g| g.store_id.as_str()).collect::<Vec<_>>(), ["Origin.OFR.50.0001", "Origin.OFR.50.0002"]);
        assert_eq!(next.as_deref(), Some("500"));
        let (none, end) = parse_ea_page(&json!({"data": {"me": {"ownedGameProducts": {"items": [], "next": null}}}})).unwrap();
        assert!(none.is_empty() && end.is_none());
        // a rotated hash answers 200 with errors and no data: that must fail loudly
        assert!(parse_ea_page(&json!({"errors": [{"message": "PersistedQueryNotFound"}]})).is_err());
        assert!(parse_ea_page(&json!({"data": {"me": null}})).is_err());
        assert!(parse_ea_page(&json!(null)).is_err());
    }

    #[test]
    fn builds_the_persisted_query_url_with_the_cursor() {
        let u = ea_page_url("500").unwrap();
        let q: std::collections::HashMap<_, _> = u.query_pairs().into_owned().collect();
        assert_eq!(q["operationName"], "getPreloadedOwnedGames");
        assert!(q["extensions"].contains(EA_OWNED_HASH));
        assert!(q["variables"].contains("\"next\":\"500\""));
        assert!(q["variables"].contains("\"limit\":500"));
        assert_eq!(u.host_str(), Some("service-aggregation-layer.juno.ea.com"));
    }
}
