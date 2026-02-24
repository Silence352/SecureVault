mod commands;
mod crypto;
mod db;
mod models;

use commands::init_app_state;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let state = init_app_state(app_dir).expect("Failed to initialize app state");

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_vault_exists,
            commands::setup_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::is_vault_unlocked,
            commands::get_entries,
            commands::get_entry,
            commands::create_entry,
            commands::update_entry,
            commands::delete_entry,
            commands::toggle_favorite,
            commands::generate_password,
            commands::get_templates,
            commands::get_template,
            commands::create_template,
            commands::get_categories,
            commands::search_entries,
            commands::change_master_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
