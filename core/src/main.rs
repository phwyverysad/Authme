#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code, unused_imports, unused_variables)]

use std::env;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

mod auto_launch;
mod encryption;
mod mail;
mod utils;
mod window_state;

#[derive(Clone, serde::Serialize)]
struct Payload {
    event: bool,
}

fn show_main_window(window: &tauri::Window) {
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    if let Ok(pos) = window.outer_position() {
        if pos.x <= -10000 || pos.y <= -10000 {
            window_state::restore_window_state(window);
        }
    }
    let _ = window.show();
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = window.set_always_on_top(false);
}

fn main() {
    let existing_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
    let combined_args = format!(
        "{} --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=CalculateNativeWinOcclusion",
        existing_args
    );
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined_args.trim());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            auto_launch::enable_auto_launch,
            auto_launch::disable_auto_launch,
            encryption::encrypt_password,
            encryption::verify_password,
            encryption::encrypt_data,
            encryption::decrypt_data,
            encryption::set_entry,
            encryption::get_entry,
            encryption::receive_encryption_key,
            encryption::set_encryption_key,
            encryption::clear_encryption_key,
            encryption::delete_entry,
            utils::get_args,
            utils::random_values,
            utils::logger,
            utils::write_logs,
            utils::system_info,
            utils::google_authenticator_converter,
            utils::get_dll_extension_info,
            utils::create_logs_dir,
            mail::get_mail_accounts,
            mail::save_mail_account,
            mail::reorder_mail_accounts,
            mail::delete_mail_account,
            mail::open_mail_view,
            mail::update_mail_view_bounds,
            mail::reload_mail_view,
            mail::set_mail_view_visible,
            mail::close_mail_view,
            mail::cancel_login_session,
            mail::preload_mail_view,
            mail::send_mail_notification,
            mail::open_external_url,
            mail::rekey_mail_passwords,
            window_state::set_minimize_to_tray,
            window_state::set_remember_window_position,
        ])
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);

            if let Some(window) = app.get_window("main") {
                let _ = app.emit("openCodes", Payload { event: true });
                show_main_window(&window);
            }
        }))
        .setup(|app| {
            let window = match app.get_window("main") {
                Some(w) => w,
                None => return Ok(()),
            };

            // Initialize window lifecycle flags and restore saved geometry before displaying
            window_state::init_window_state(app.handle());
            window_state::restore_window_state(&window);

            // Prime encryption key in background thread immediately so fast-path decryption is instantly available
            let _ = std::thread::spawn(|| {
                let _ = encryption::set_encryption_key("authme".to_string());
            });

            // Launch args
            let args: Vec<String> = env::args().collect();
            let is_minimized = args.iter().any(|a| a == "--minimized");

            // Show window if auto launch argument not detected
            if is_minimized {
                let _ = window.hide();
            } else {
                show_main_window(&window);
            }

            if args.iter().any(|a| a == "--devtools") {
                if let Some(webview) = app.get_webview("main") {
                    let _ = webview.open_devtools();
                }
            }

            // Preload all connected mail webviews concurrently in background on startup
            let app_handle_for_preload = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                tauri::async_runtime::block_on(async move {
                    let _ = mail::preload_all_mail_webviews(app_handle_for_preload).await;
                });
            });



            // Tray
            let toggle_window_item =
                MenuItemBuilder::with_id("toggle_windows", "Show/Hide Authme").build(app)?;
            let exit_item = MenuItemBuilder::with_id("exit", "Exit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&toggle_window_item, &exit_item])
                .build()?;

            if let Some(tray) = app.tray_by_id("main") {
                let _ = tray.set_menu(Some(menu));
                if cfg!(target_os = "windows") {
                    let _ = tray.set_show_menu_on_left_click(false);
                }

                tray.on_menu_event(move |app, event| match event.id().as_ref() {
                    "toggle_windows" => {
                        if let Some(window) = app.get_window("main") {
                            let window_visible = window.is_visible().unwrap_or(false);
                            let window_minimized = window.is_minimized().unwrap_or(false);

                            if window_visible && !window_minimized {
                                let _ = app.emit("openCodes", Payload { event: false });
                                let _ = window.hide();
                            } else {
                                let _ = app.emit("openCodes", Payload { event: true });
                                show_main_window(&window);
                            }
                        }
                    }
                    "exit" => {
                        app.exit(0);
                    }
                    _ => (),
                });

                if cfg!(target_os = "windows") {
                    tray.on_tray_icon_event(|tray, event| {
                        match event {
                            TrayIconEvent::Click {
                                button: MouseButton::Left,
                                button_state: MouseButtonState::Up,
                                ..
                            }
                            | TrayIconEvent::DoubleClick {
                                button: MouseButton::Left,
                                ..
                            } => {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_window("main") {
                                    let window_visible = window.is_visible().unwrap_or(false);
                                    let window_minimized = window.is_minimized().unwrap_or(false);
                                    let window_focused = window.is_focused().unwrap_or(false);

                                    // If window is visible, unminimized, and focused, clicking tray icon hides it.
                                    // Otherwise (hidden, minimized, or behind other windows), show and focus it.
                                    if window_visible && !window_minimized && window_focused {
                                        let _ = app.emit("openCodes", Payload { event: false });
                                        let _ = window.hide();
                                    } else {
                                        let _ = app.emit("openCodes", Payload { event: true });
                                        show_main_window(&window);
                                    }
                                }
                            }
                            _ => {}
                        }
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    window_state::update_window_state_from_window(window);
                    if window_state::should_minimize_to_tray() {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        window.app_handle().exit(0);
                    }
                }
                tauri::WindowEvent::Moved(_)
                | tauri::WindowEvent::Resized(_)
                | tauri::WindowEvent::Focused(false) => {
                    window_state::update_window_state_from_window(window);
                }
                tauri::WindowEvent::Destroyed => {
                    window_state::update_window_state_from_window(window);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
