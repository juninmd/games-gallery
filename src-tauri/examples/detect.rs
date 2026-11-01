//! Dev-only smoke probe: prints one line per provider (names only, never keys or tokens) and fails
//! when a launcher that is installed on this machine could not be read.
//! Run with `cargo run --example detect`.

use std::path::PathBuf;
use std::process::ExitCode;

/// Providers whose launcher folder proves they are installed here.
fn installed_here(provider: &str) -> bool {
    let var = |k: &str| PathBuf::from(std::env::var(k).unwrap_or_default());
    match provider {
        "steam" => var("ProgramFiles(x86)").join("Steam").is_dir(),
        "gog" => var("ProgramData").join("GOG.com").join("Galaxy").is_dir(),
        "epic" => var("ProgramData").join("Epic").join("EpicGamesLauncher").is_dir(),
        "ubisoft" => var("LOCALAPPDATA").join("Ubisoft Game Launcher").is_dir(),
        _ => false,
    }
}

fn main() -> ExitCode {
    let detections = games_gallery_lib::detect::detect_libraries_sync();
    let mut failed = Vec::new();
    for d in &detections {
        let installed: usize = d.games.iter().filter(|g| g.installed).count();
        println!(
            "{:<10} available={:<5} games={:<4} installed={:<4} source={} {}",
            d.provider_id,
            d.available,
            d.games.len(),
            installed,
            d.source,
            d.note.clone().unwrap_or_default()
        );
        // Hard error = the launcher folder exists but the scanner says it is absent, or no source of
        // the provider (epic has several) produced data. A launcher with no installed games is not one.
        let served = detections.iter().any(|o| o.provider_id == d.provider_id && o.available);
        let denies_launcher = d.note.as_deref().is_some_and(|n| n.contains("não está instalado") || n.contains("não encontrado"));
        let broken = !d.available && installed_here(&d.provider_id) && (denies_launcher && !served);
        if broken && !failed.contains(&d.provider_id) {
            failed.push(d.provider_id.clone());
        }
    }
    if failed.is_empty() {
        println!("SMOKE OK ({} providers)", detections.len());
        ExitCode::SUCCESS
    } else {
        eprintln!("SMOKE FAIL: installed but unreadable: {}", failed.join(", "));
        ExitCode::FAILURE
    }
}
