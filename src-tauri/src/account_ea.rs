//! EA app library: a `fetch` hook in the throw-away login window captures the token the page
//! itself uses, then the persisted `getPreloadedOwnedGames` query is read page by page.

use crate::account_login::*;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Url};
use tauri_plugin_http::reqwest;

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
