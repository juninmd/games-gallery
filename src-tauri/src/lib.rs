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
        .invoke_handler(tauri::generate_handler![
            detect::detect_libraries,
            account_login::battlenet_library,
            account_login::ea_library,
            account_ubisoft::ubisoft_library,
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            emulators::detect_emulators,
            emulators::emulator_install,
            emulators::emulator_uninstall,
            emulators::emulator_cancel,
            emulators::emulator_launch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
