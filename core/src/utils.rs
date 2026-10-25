use google_authenticator_converter::{process_data, Account};
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::{env, fs};
use std::sync::OnceLock;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};
use tauri::Manager;

#[tauri::command]
pub fn get_args() -> Vec<String> {
    let args: Vec<String> = env::args().collect();

    args.into()
}

#[tauri::command]
pub fn random_values(length: usize) -> String {
    let safe_len = length.min(4096);
    let rand_string: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(safe_len)
        .map(char::from)
        .collect();

    rand_string.into()
}

#[tauri::command]
pub fn logger(message: String, time: String, kind: &str) {
    match kind {
        "log" => println!(
            "\x1b[32m[AUTHME LOG] \x1b[34m({}) \x1b[37m{}",
            time, message
        ),
        "warn" => println!(
            "\x1b[33m[AUTHME WARN] \x1b[34m({}) \x1b[37m{}",
            time, message
        ),
        "error" => println!(
            "\x1b[31m[AUTHME ERROR] \x1b[34m({}) \x1b[37m{}",
            time, message
        ),
        &_ => println!(
            "\x1b[31m[AUTHME LOG] \x1b[34m({}) \x1b[37m{}",
            time, message
        ),
    }
}

pub fn is_safe_log_path(p_str: &str, is_file: bool) -> bool {
    let p = std::path::Path::new(p_str);
    // Reject path traversal
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return false;
    }
    // Reject UNC paths
    if p_str.starts_with(r"\\") || p_str.starts_with("//") {
        return false;
    }
    // Reject alternate data streams (more than one colon or colon not at index 1 on Windows)
    let colon_count = p_str.matches(':').count();
    if colon_count > 1 || (colon_count == 1 && (!cfg!(windows) || p_str.chars().nth(1) != Some(':'))) {
        return false;
    }
    // Must be inside the application's designated cache or data directory
    if !p_str.contains("com.levminer.authme") {
        return false;
    }
    if is_file && !p_str.ends_with(".log") {
        return false;
    }
    true
}

#[tauri::command]
pub fn create_logs_dir(path: String) {
    if !is_safe_log_path(&path, false) {
        return;
    }
    let p = std::path::Path::new(&path);
    let _ = fs::create_dir_all(p);
}

#[tauri::command]
pub fn write_logs(name: String, message: String) {
    if !is_safe_log_path(&name, true) || message.len() > 100_000 {
        return;
    }
    let p = std::path::Path::new(&name);
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut file) = fs::OpenOptions::new()
        .write(true)
        .append(true)
        .create(true)
        .open(p)
    {
        let _ = write!(file, "{}", message);
    }
}

static CACHED_SYSINFO: OnceLock<SystemInfo> = OnceLock::new();

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os_name: String,
    pub os_arch: String,
    pub cpu_name: String,
    pub total_mem: u64,
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    if let Some(info) = CACHED_SYSINFO.get() {
        return info.clone();
    }

    let mut sys = System::new_with_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::nothing())
            .with_memory(MemoryRefreshKind::nothing().with_ram()),
    );
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let mut os_name = System::name().unwrap_or_else(|| "Windows".to_string());
    let mut os_arch = env::consts::ARCH.to_string();
    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let total_mem = sys.total_memory();

    os_name = match os_name.as_str() {
        "Darwin" => "macOS".to_string(),
        _ => os_name,
    };

    os_arch = match os_arch.as_str() {
        "x86_64" => "x64".to_string(),
        "aarch64" => "arm64".to_string(),
        _ => os_arch,
    };

    let res = SystemInfo {
        os_name,
        cpu_name,
        total_mem,
        os_arch,
    };

    let _ = CACHED_SYSINFO.set(res.clone());
    res
}

pub fn try_call_dll_converter(secret: &str) -> Option<Vec<Account>> {
    use std::ffi::{CStr, CString};
    use std::os::raw::c_char;

    // Search order: adjacent to current exe, current working directory, or target dir
    // Search strictly within trusted application executable directory or its resources subfolder
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
    let search_dirs = [
        exe_dir.clone(),
        exe_dir.as_ref().map(|d| d.join("resources")),
    ];

    let dll_names = ["authme_extensions.dll", "google_authenticator_converter.dll"];

    for dir_opt in &search_dirs {
        if let Some(dir) = dir_opt {
            for dll_name in &dll_names {
                let dll_path = dir.join(dll_name);
                if dll_path.exists() {
                    unsafe {
                        if let Ok(lib) = libloading::Library::new(&dll_path) {
                            // Try authme_extension_convert_google_auth first
                            if let Ok(convert_fn) = lib.get::<unsafe extern "C" fn(*const c_char) -> *mut c_char>(b"authme_extension_convert_google_auth\0") {
                                if let Ok(free_fn) = lib.get::<unsafe extern "C" fn(*mut c_char)>(b"authme_extension_free_string\0") {
                                    if let Ok(c_sec) = CString::new(secret) {
                                        let res_ptr = convert_fn(c_sec.as_ptr());
                                        if !res_ptr.is_null() {
                                            let json_str = CStr::from_ptr(res_ptr).to_str().unwrap_or("[]").to_string();
                                            free_fn(res_ptr);
                                            if let Ok(accounts) = serde_json::from_str::<Vec<Account>>(&json_str) {
                                                return Some(accounts);
                                            }
                                        }
                                    }
                                }
                            }
                            // Fallback to authme_google_authenticator_convert
                            if let Ok(convert_fn) = lib.get::<unsafe extern "C" fn(*const c_char) -> *mut c_char>(b"authme_google_authenticator_convert\0") {
                                if let Ok(free_fn) = lib.get::<unsafe extern "C" fn(*mut c_char)>(b"authme_free_string\0") {
                                    if let Ok(c_sec) = CString::new(secret) {
                                        let res_ptr = convert_fn(c_sec.as_ptr());
                                        if !res_ptr.is_null() {
                                            let json_str = CStr::from_ptr(res_ptr).to_str().unwrap_or("[]").to_string();
                                            free_fn(res_ptr);
                                            if let Ok(accounts) = serde_json::from_str::<Vec<Account>>(&json_str) {
                                                return Some(accounts);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn google_authenticator_converter(secret: &str) -> Vec<Account> {
    if let Some(accounts) = try_call_dll_converter(secret) {
        return accounts;
    }

    let res = process_data(secret);
    match res {
        Ok(accounts) => accounts,
        Err(_) => vec![],
    }
}

#[tauri::command]
pub fn get_dll_extension_info() -> serde_json::Value {
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
    let dll_name = "authme_extensions.dll";
    let dll_path = exe_dir.map(|d| d.join(dll_name));
    let exists = dll_path.as_ref().map(|p| p.exists()).unwrap_or(false);

    serde_json::json!({
        "status": if exists { "active_dll" } else { "embedded_fallback" },
        "dll_name": dll_name,
        "is_dynamic": exists,
        "version": "1.0.0"
    })
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_safe_log_path_valid() {
        assert!(is_safe_log_path("C:\\Users\\Admin\\AppData\\Local\\com.levminer.authme\\logs", false));
        assert!(is_safe_log_path("C:\\Users\\Admin\\AppData\\Local\\com.levminer.authme\\logs\\authme-2026.log", true));
        assert!(is_safe_log_path("/home/user/.cache/com.levminer.authme/authme.log", true));
    }

    #[test]
    fn test_is_safe_log_path_rejects_traversal() {
        assert!(!is_safe_log_path("C:\\com.levminer.authme\\..\\Windows\\System32\\evil.log", true));
        assert!(!is_safe_log_path("/cache/com.levminer.authme/../../../etc/passwd", false));
    }

    #[test]
    fn test_is_safe_log_path_rejects_unc_and_alternate_streams() {
        assert!(!is_safe_log_path(r"\\attacker\share\com.levminer.authme\test.log", true));
        assert!(!is_safe_log_path("//attacker/share/com.levminer.authme/test.log", true));
        assert!(!is_safe_log_path("C:\\com.levminer.authme\\test.log:hidden_stream", true));
    }

    #[test]
    fn test_is_safe_log_path_rejects_non_authme_and_wrong_extension() {
        assert!(!is_safe_log_path("C:\\Windows\\System32\\cmd.exe", false));
        assert!(!is_safe_log_path("C:\\com.levminer.authme\\script.bat", true));
        assert!(!is_safe_log_path("C:\\Windows\\System32\\logs\\test.log", true));
    }
}
