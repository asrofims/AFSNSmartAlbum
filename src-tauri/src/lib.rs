mod commands;
mod db;
mod photo_engine;
mod export_engine;

use tauri::Manager;
use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            log::info!("Single instance trigger: bringing main window to focus");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let db_path = app_data_dir.join("afsn_smart_album.db");

            let database = Database::init(db_path)
                .expect("Failed to initialize database");

            // Make database and import state available as managed state
            app.manage(database);
            app.manage(commands::photo_commands::ImportState::default());

            log::info!("AFSNSmartAlbum started successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_commands::get_app_info,
            commands::app_commands::get_db_status,
            commands::project_commands::create_project,
            commands::project_commands::get_project,
            commands::project_commands::list_recent_projects,
            commands::project_commands::delete_project,
            commands::project_commands::clear_recent_projects,
            commands::project_commands::update_project_spacing,
            commands::project_commands::save_album_structure,
            commands::project_commands::load_album_structure,
            commands::project_commands::export_afsn_package,
            commands::project_commands::import_afsn_package,
            commands::project_commands::export_afsn_with_dialog,
            commands::project_commands::export_bundled_package_with_dialog,
            commands::project_commands::import_afsn_with_dialog,
            commands::photo_commands::select_and_import_files,
            commands::photo_commands::select_and_import_folder,
            commands::photo_commands::import_file_paths,
            commands::photo_commands::get_project_photos,
            commands::photo_commands::toggle_photo_favorite,
            commands::photo_commands::remove_photo,
            commands::photo_commands::check_missing_photos,
            commands::photo_commands::relink_folder,
            commands::photo_commands::cancel_photo_import,
            commands::photo_commands::batch_delete_photos,
            commands::photo_commands::batch_toggle_favorites,
            commands::photo_commands::create_photo_folder,
            commands::photo_commands::get_photo_folders,
            commands::photo_commands::rename_photo_folder,
            commands::photo_commands::delete_photo_folder,
            commands::photo_commands::add_photos_to_folder,
            commands::photo_commands::remove_photos_from_folder,
            commands::photo_commands::move_photos_between_folders,
            commands::photo_commands::get_photos_for_folder,
            commands::export_commands::export_album_high_res,
            commands::export_commands::preflight_check_export,
            commands::export_commands::select_export_directory,
            commands::export_commands::open_export_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
