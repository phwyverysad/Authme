use auto_launch::{AutoLaunchBuilder, MacOSLaunchMode};
use std::env;

#[tauri::command]
pub fn enable_auto_launch() -> Result<(), String> {
    let exe = env::current_exe().map_err(|e| e.to_string())?;
    let exe_string = exe.to_str().ok_or_else(|| "Path to exe is not valid unicode".to_string())?;

    let auto = AutoLaunchBuilder::new()
        .set_app_name("Authme")
        .set_app_path(exe_string)
        .set_macos_launch_mode(MacOSLaunchMode::LaunchAgent)
        .set_args(&["--minimized"])
        .build()
        .map_err(|e| e.to_string())?;

    if !auto.is_enabled().unwrap_or(false) {
        auto.enable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn disable_auto_launch() -> Result<(), String> {
    let exe = env::current_exe().map_err(|e| e.to_string())?;
    let exe_string = exe.to_str().ok_or_else(|| "Path to exe is not valid unicode".to_string())?;

    let auto = AutoLaunchBuilder::new()
        .set_app_name("Authme")
        .set_app_path(exe_string)
        .set_macos_launch_mode(MacOSLaunchMode::LaunchAgent)
        .set_args(&["--minimized"])
        .build()
        .map_err(|e| e.to_string())?;

    if auto.is_enabled().unwrap_or(false) {
        auto.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}
