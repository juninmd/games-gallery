pub mod detect;
mod detect_battlenet;
mod detect_ea;
mod detect_registry;
mod detect_ubisoft;
mod detect_xbox;
mod account_login;
mod account_ubisoft;
mod emulators;
mod secrets;

/// Whether this build embeds the public key that signed updates are verified against. The release
/// workflow merges it (and the update endpoint) into the Tauri config; a plain `tauri build` has none,
/// so the updater stays unregistered and the app only points to the GitHub release page.
fn updater_configured(config: &tauri::Config) -> bool {
    config
        .plugins
        .0
        .get("updater")
        .and_then(|updater| updater.get("pubkey"))
        .and_then(|key| key.as_str())
        .is_some_and(|key| !key.trim().is_empty())
}

/// Lets the UI choose between installing an update itself and linking to the release page.
#[tauri::command]
fn update_signing_ready(app: tauri::AppHandle) -> bool {
    updater_configured(app.config())
}

// Real data first: every library is detected from the launchers installed on this machine,
// games are installed/uninstalled through the store URIs, and emulators are detected,
// installed and launched for real (argv-only, no shell).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(emulators::Running::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                if updater_configured(app.config()) {
                    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                    app.handle().plugin(tauri_plugin_process::init())?;
                }
            }
            #[cfg(not(desktop))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect::detect_libraries,
            account_login::battlenet_library,
            account_login::ea_library,
            account_ubisoft::ubisoft_library,
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            update_signing_ready,
            emulators::detect_emulators,
            emulators::emulator_install,
            emulators::emulator_uninstall,
            emulators::emulator_cancel,
            emulators::emulator_launch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config_with(updater: serde_json::Value) -> tauri::Config {
        let mut config = tauri::Config::default();
        config.plugins.0.insert("updater".into(), updater);
        config
    }

    #[test]
    fn updater_needs_a_non_empty_public_key() {
        assert!(!updater_configured(&tauri::Config::default()));
        assert!(!updater_configured(&config_with(serde_json::json!({ "endpoints": [] }))));
        assert!(!updater_configured(&config_with(serde_json::json!({ "pubkey": "" }))));
        assert!(!updater_configured(&config_with(serde_json::json!({ "pubkey": "   " }))));
        assert!(!updater_configured(&config_with(serde_json::json!({ "pubkey": 7 }))));
        assert!(updater_configured(&config_with(serde_json::json!({ "pubkey": "dW50cnVzdGVk" }))));
    }
}
