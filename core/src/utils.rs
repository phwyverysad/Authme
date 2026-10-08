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
    let rand_string: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
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

#[tauri::command]
pub fn create_logs_dir(path: String) {
    let _ = fs::create_dir_all(path);
}

#[tauri::command]
pub fn write_logs(name: String, message: String) {
    if let Some(parent) = std::path::Path::new(&name).parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut file) = fs::OpenOptions::new()
        .write(true)
        .append(true)
        .create(true)
        .open(&name)
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
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
    let search_dirs = [
        exe_dir.clone(),
        exe_dir.as_ref().map(|d| d.join("resources")),
        std::env::current_dir().ok(),
        std::env::current_dir().ok().map(|d| d.join("resources")),
        std::env::current_dir().ok().map(|d| d.join("dist-exe")),
        std::env::current_dir().ok().map(|d| d.join("core").join("resources")),
        std::env::current_dir().ok().map(|d| d.join("core").join("target").join("release")),
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

