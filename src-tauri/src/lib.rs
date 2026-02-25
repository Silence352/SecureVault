mod commands;
mod crypto;
mod db;
mod models;

use commands::init_app_state;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

fn create_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show SecureVault", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let icon = Image::from_path("icons/32x32.png").unwrap_or_else(|_| {
        Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("Failed to load tray icon")
    });

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("SecureVault - Password Manager")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new()
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::LogDir { file_name: Some("securevault".into()) }
            ))
            .build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let state = init_app_state(app_dir).expect("Failed to initialize app state");

            app.manage(state);

            // Create system tray
            if let Err(e) = create_tray(app) {
                log::error!("Failed to create system tray: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_vault_exists,
            commands::reset_vault,
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
            commands::get_cursor_position,
            commands::create_quick_panel,
            commands::close_quick_panel,
            commands::copy_password_to_clipboard,
            commands::copy_username_to_clipboard,
            commands::simulate_paste,
            commands::get_quick_entries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
