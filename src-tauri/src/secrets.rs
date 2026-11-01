//! API keys live in the OS credential store, not in the WebView's localStorage. Only an
//! allow-listed set of names can be read or written, so the command cannot be used as a generic vault.

use keyring::Entry;

const SERVICE: &str = "games-gallery";
const ALLOWED: [&str; 2] = ["steamKey", "rawgKey"];
const MAX_LEN: usize = 256;

fn entry(name: &str) -> Result<Entry, String> {
    if !ALLOWED.contains(&name) {
        return Err("Nome de segredo não permitido.".into());
    }
    Entry::new(SERVICE, name).map_err(|e| format!("Cofre do sistema indisponível: {e}"))
}

fn set(name: &str, value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > MAX_LEN || value.chars().any(char::is_control) {
        return Err("Valor inválido.".into());
    }
    entry(name)?.set_password(value).map_err(|e| format!("Não foi possível salvar no cofre: {e}"))
}

fn get(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Não foi possível ler o cofre: {e}")),
    }
}

fn delete(name: &str) -> Result<(), String> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Não foi possível apagar do cofre: {e}")),
    }
}

#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    set(&name, &value)
}

#[tauri::command]
pub fn secret_get(name: String) -> Result<Option<String>, String> {
    get(&name)
}

#[tauri::command]
pub fn secret_delete(name: String) -> Result<(), String> {
    delete(&name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_allow_listed_names_reach_the_store() {
        for bad in ["", "other", "steamkey", "steamKey ", "../steamKey", "steamKey\0"] {
            assert!(entry(bad).is_err(), "{bad:?}");
        }
        assert!(entry("steamKey").is_ok());
    }

    #[test]
    fn rejects_empty_oversized_and_control_values_before_touching_the_store() {
        assert!(set("steamKey", "").is_err());
        assert!(set("steamKey", &"a".repeat(MAX_LEN + 1)).is_err());
        assert!(set("steamKey", "abc\ndef").is_err());
        assert!(set("nope", "abc").is_err());
    }

    /// Round-trips through the real OS store with a throwaway name-space value, then removes it.
    #[test]
    fn round_trips_through_the_os_credential_store() {
        let original = get("rawgKey").ok().flatten();
        let saved = set("rawgKey", "smoke-test-value");
        // Windows always has Credential Manager; elsewhere a headless CI may lack a secret service.
        assert!(saved.is_ok() || !cfg!(windows), "{saved:?}");
        if saved.is_err() {
            return;
        }
        assert_eq!(get("rawgKey").unwrap().as_deref(), Some("smoke-test-value"));
        delete("rawgKey").unwrap();
        assert_eq!(get("rawgKey").unwrap(), None);
        if let Some(v) = original {
            set("rawgKey", &v).unwrap();
        }
    }
}
