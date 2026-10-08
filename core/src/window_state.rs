use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow, Window};
use std::sync::atomic::{AtomicBool, Ordering};

static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);

#[tauri::command]
pub fn set_minimize_to_tray(app: AppHandle, enabled: bool) {
    MINIMIZE_TO_TRAY.store(enabled, Ordering::Relaxed);
    let mut current = load_window_state(&app).unwrap_or_default();
    current.minimize_to_tray = enabled;
    save_window_state(&app, &current);
}

pub fn should_minimize_to_tray() -> bool {
    MINIMIZE_TO_TRAY.load(Ordering::Relaxed)
}

pub fn init_window_state(app: &AppHandle) {
    if let Some(state) = load_window_state(app) {
        MINIMIZE_TO_TRAY.store(state.minimize_to_tray, Ordering::Relaxed);
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_maximized: bool,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 1280,
            height: 800,
            is_maximized: false,
            enabled: true,
            minimize_to_tray: true,
        }
    }
}

pub fn get_state_file_path(app: &AppHandle) -> PathBuf {
    let mut path = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&path);
    path.push("window-state.json");
    path
}

pub fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let path = get_state_file_path(app);
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(state) = serde_json::from_str::<WindowState>(&contents) {
            if state.width >= 400 && state.height >= 300 {
                return Some(state);
            }
        }
    }
    None
}

pub fn save_window_state(app: &AppHandle, state: &WindowState) {
    let path = get_state_file_path(app);
    if let Ok(json) = serde_json::to_string_pretty(state) {
        let _ = fs::write(path, json);
    }
}

#[tauri::command]
pub fn set_remember_window_position(app: AppHandle, enabled: bool) {
    let mut current = load_window_state(&app).unwrap_or_default();
    current.enabled = enabled;
    save_window_state(&app, &current);
}

/// Restores the saved position, size, and maximized state before the window is displayed
pub fn restore_window_state(window: &Window) {
    let app = window.app_handle();
    if let Some(state) = load_window_state(&app) {
        if !state.enabled {
            let _ = window.center();
            return;
        }

        let safe_x = if state.x < -10000 { 100 } else { state.x };
        let safe_y = if state.y < -10000 { 100 } else { state.y };
        let safe_w = if state.width < 500 { 1280 } else { state.width };
        let safe_h = if state.height < 400 { 800 } else { state.height };

        // Validate coordinates against all connected monitors
        let is_valid_position = if let Ok(monitors) = window.available_monitors() {
            monitors.iter().any(|m| {
                let m_pos = m.position();
                let m_size = m.size();
                safe_x >= m_pos.x - 20
                    && safe_x < m_pos.x + m_size.width as i32 - 100
                    && safe_y >= m_pos.y - 20
                    && safe_y < m_pos.y + m_size.height as i32 - 100
            })
        } else {
            true
        };

        if is_valid_position {
            let _ = window.set_position(Position::Physical(PhysicalPosition {
                x: safe_x,
                y: safe_y,
            }));
        } else {
            let _ = window.center();
        }

        let _ = window.set_size(Size::Physical(PhysicalSize {
            width: safe_w,
            height: safe_h,
        }));

        if state.is_maximized {
            let _ = window.maximize();
        }
    } else {
        let _ = window.center();
    }
}

/// Updates the persisted window state from current window geometry
pub fn update_window_state_from_window(window: &Window) {
    if window.label() != "main" {
        return;
    }

    // Do not save state when window is hidden or minimized
    let is_visible = window.is_visible().unwrap_or(false);
    if !is_visible {
        return;
    }

    let is_minimized = window.is_minimized().unwrap_or(false);
    if is_minimized {
        return;
    }

    let app = window.app_handle();
    let mut current = load_window_state(&app).unwrap_or_default();
    if !current.enabled {
        return;
    }

    let is_maximized = window.is_maximized().unwrap_or(false);
    current.is_maximized = is_maximized;

    // Only update position & dimensions when NOT maximized so unmaximize can return to them
    if !is_maximized {
        if let Ok(pos) = window.outer_position() {
            // Ignore Windows minimization artifact coordinates (-32000) and maximize border offsets (-8, -8)
            if pos.x > -10000 && pos.y > -10000 {
                current.x = pos.x;
                current.y = pos.y;
            }
        }
        if let Ok(size) = window.outer_size() {
            if size.width >= 400 && size.height >= 300 {
                current.width = size.width;
                current.height = size.height;
            }
        }
    }

    save_window_state(&app, &current);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_state_default() {
        let state = WindowState::default();
        assert_eq!(state.enabled, true);
        assert_eq!(state.minimize_to_tray, true);
        assert_eq!(state.width, 1280);
        assert_eq!(state.height, 800);
        assert_eq!(state.is_maximized, false);
    }

    #[test]
    fn test_window_state_serialization() {
        let mut state = WindowState::default();
        state.enabled = false;
        state.minimize_to_tray = false;
        state.x = 250;
        state.y = 180;

        let json = serde_json::to_string(&state).unwrap();
        let deserialized: WindowState = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.enabled, false);
        assert_eq!(deserialized.minimize_to_tray, false);
        assert_eq!(deserialized.x, 250);
        assert_eq!(deserialized.y, 180);
    }

    #[test]
    fn test_minimize_to_tray_atomic_flag() {
        MINIMIZE_TO_TRAY.store(false, Ordering::Relaxed);
        assert_eq!(should_minimize_to_tray(), false);
        MINIMIZE_TO_TRAY.store(true, Ordering::Relaxed);
        assert_eq!(should_minimize_to_tray(), true);
    }
}
