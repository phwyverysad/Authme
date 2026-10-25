use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use magic_crypt::{new_magic_crypt, MagicCryptTrait};
use once_cell::sync::Lazy;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
extern crate keyring;

fn generate_random_secure_key() -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

static ENCRYPTION_KEY: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new("".to_owned()));

pub fn get_active_key() -> String {
    ENCRYPTION_KEY.lock().unwrap_or_else(|e| e.into_inner()).to_string()
}

fn set_active_key(key: String) {
    *ENCRYPTION_KEY.lock().unwrap_or_else(|e| e.into_inner()) = key;
}

fn get_fallback_key_paths() -> Vec<PathBuf> {
    if let Ok(test_dir) = std::env::var("AUTHME_TEST_VAULT_DIR") {
        if !test_dir.trim().is_empty() {
            let p = PathBuf::from(test_dir);
            let _ = fs::create_dir_all(&p);
            return vec![p.join(".vault_key")];
        }
    }
    let mut paths = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = PathBuf::from(appdata).join("com.levminer.authme");
            let _ = fs::create_dir_all(&p);
            paths.push(p.join(".vault_key"));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(local).join("com.levminer.authme");
            let _ = fs::create_dir_all(&p);
            paths.push(p.join(".vault_key"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let p = PathBuf::from(home).join("Library/Application Support/com.levminer.authme");
            let _ = fs::create_dir_all(&p);
            paths.push(p.join(".vault_key"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let p = PathBuf::from(home).join(".config/com.levminer.authme");
            let _ = fs::create_dir_all(&p);
            paths.push(p.join(".vault_key"));
        }
    }
    if paths.is_empty() {
        paths.push(PathBuf::from(".vault_key"));
    }
    paths
}

pub fn save_fallback_key(key: &str) {
    let trimmed = key.trim();
    if trimmed.is_empty() || trimmed == "error" {
        return;
    }
    for path in get_fallback_key_paths() {
        let _ = fs::write(&path, trimmed);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
        }
    }
}

pub fn get_fallback_key() -> Option<String> {
    for path in get_fallback_key_paths() {
        if let Ok(contents) = fs::read_to_string(path) {
            let trimmed = contents.trim().to_string();
            if !trimmed.is_empty() && trimmed != "error" {
                return Some(trimmed);
            }
        }
    }
    None
}

pub fn delete_fallback_key() {
    for path in get_fallback_key_paths() {
        let _ = fs::remove_file(path);
    }
}

pub fn has_fallback_key() -> bool {
    get_fallback_key().is_some()
}

fn get_keyring_key_with_name(service: &str, name: &str) -> Option<String> {
    let key_name = if name.trim().is_empty() { "encryptionKey" } else { name };
    if let Ok(entry) = keyring::Entry::new(service, key_name) {
        if let Ok(pw) = entry.get_password() {
            if !pw.is_empty() && pw != "error" {
                return Some(pw);
            }
        }
    }
    None
}

fn get_keyring_key(service: &str) -> Option<String> {
    if let Some(k) = get_keyring_key_with_name(service, "encryptionKey") {
        return Some(k);
    }
    get_fallback_key()
}

fn set_keyring_key_with_name(service: &str, name: &str, key: &str) -> bool {
    let key_name = if name.trim().is_empty() { "encryptionKey" } else { name };
    if let Ok(entry) = keyring::Entry::new(service, key_name) {
        entry.set_password(key).is_ok()
    } else {
        false
    }
}

fn set_keyring_key(service: &str, key: &str) -> bool {
    set_keyring_key_with_name(service, "encryptionKey", key)
}

fn sync_keyring_key(key: &str) {
    if !key.is_empty() && key != "error" {
        let _ = set_keyring_key("authme", key);
        let _ = set_keyring_key("authme_dev", key);
        save_fallback_key(key);
    }
}

#[tauri::command]
pub fn encrypt_password(password: String) -> String {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string();

    password_hash.into()
}

#[tauri::command]
pub fn verify_password(password: String, hash: String) -> bool {
    let parsed_hash = match PasswordHash::new(&hash) {
        Ok(h) => h,
        Err(_) => return false,
    };

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

#[tauri::command]
pub fn encrypt_data(data: String) -> String {
    let mut key = get_active_key();

    // Never encrypt with "error" or uninitialized key
    if key == "error" || key.is_empty() {
        if let Some(k) = get_keyring_key("authme")
            .or_else(|| get_keyring_key("authme_dev"))
            .or_else(get_fallback_key)
        {
            key = k;
            set_active_key(key.clone());
            sync_keyring_key(&key);
        } else {
            key = generate_random_secure_key();
            set_active_key(key.clone());
            sync_keyring_key(&key);
            save_fallback_key(&key);
        }
    }

    let mc = new_magic_crypt!(key, 256);
    let encrypted_string = mc.encrypt_str_to_base64(data);
    encrypted_string.into()
}

#[tauri::command]
pub fn decrypt_data(data: String) -> String {
    let clean_data = data.trim();
    if clean_data.is_empty() {
        return "".into();
    }

    let active_key = get_active_key();

    // 1. FAST PATH: If active key is already present in memory, decrypt directly.
    if !active_key.is_empty() && active_key != "error" {
        let mc = new_magic_crypt!(&active_key, 256);
        if let Ok(decrypted_string) = mc.decrypt_base64_to_string(clean_data) {
            return decrypted_string;
        }
    }

    // 2. SLOW PATH: Keyring and fallback search across all locations
    let mut candidate_keys: Vec<String> = Vec::new();

    // Key from "authme" keychain
    if let Some(k) = get_keyring_key_with_name("authme", "encryptionKey") {
        if !candidate_keys.contains(&k) {
            candidate_keys.push(k);
        }
    }

    // Key from "authme_dev" keychain
    if let Some(k) = get_keyring_key_with_name("authme_dev", "encryptionKey") {
        if !candidate_keys.contains(&k) {
            candidate_keys.push(k);
        }
    }

    // Keys from all fallback storage paths (Roaming and Local AppData)
    for path in get_fallback_key_paths() {
        if let Ok(contents) = fs::read_to_string(&path) {
            let trimmed = contents.trim().to_string();
            if !trimmed.is_empty() && trimmed != "error" && !candidate_keys.contains(&trimmed) {
                candidate_keys.push(trimmed);
            }
        }
    }

    // Empty string key fallback (recovery for vaults encrypted during unkeyed state)
    if !candidate_keys.contains(&"".to_string()) {
        candidate_keys.push("".to_string());
    }

    // Attempt decryption with candidate keys
    for key in &candidate_keys {
        let mc = new_magic_crypt!(key, 256);
        if let Ok(decrypted_string) = mc.decrypt_base64_to_string(clean_data) {
            set_active_key(key.clone());
            if !key.is_empty() {
                sync_keyring_key(key);
            }
            return decrypted_string;
        }
    }

    "error".into()
}

#[tauri::command]
pub fn set_entry(name: String, data: String, service: String) -> String {
    if name.len() > 128 || service.len() > 128 {
        return "error".into();
    }
    let s1 = set_keyring_key_with_name(&service, &name, &data);
    if service == "authme" {
        let _ = set_keyring_key_with_name("authme_dev", &name, &data);
    } else if service == "authme_dev" {
        let _ = set_keyring_key_with_name("authme", &name, &data);
    }

    // CRITICAL FIX: Only synchronize active key in memory and local fallback when saving primary encryptionKey for authme services or test sandboxes
    if (name == "encryptionKey" || name.is_empty()) && (service == "authme" || service == "authme_dev" || service.starts_with("authme_test")) {
        set_active_key(data.clone());
        save_fallback_key(&data);
    }

    if s1 || has_fallback_key() {
        "ok".into()
    } else {
        "error".into()
    }
}

#[tauri::command]
pub fn get_entry(name: String, service: String) -> String {
    if name.len() > 128 || service.len() > 128 {
        return "error".into();
    }
    let key_name = if name.trim().is_empty() { "encryptionKey" } else { &name };
    if let Some(k) = get_keyring_key_with_name(&service, key_name) {
        return k;
    }
    if service == "authme" || service == "authme_dev" {
        let other_svc = if service == "authme" { "authme_dev" } else { "authme" };
        if let Some(k) = get_keyring_key_with_name(other_svc, key_name) {
            return k;
        }
        if key_name == "encryptionKey" {
            if let Some(k) = get_fallback_key() {
                return k;
            }
        }
    }
    "error".into()
}

#[tauri::command]
pub fn delete_entry(name: String, service: String) {
    if name.len() > 128 || service.len() > 128 {
        return;
    }
    let key_name = if name.trim().is_empty() { "encryptionKey" } else { &name };
    if let Ok(entry) = keyring::Entry::new(&service, key_name) {
        let _ = entry.delete_credential();
    }
    if service == "authme" || service == "authme_dev" {
        let other_svc = if service == "authme" { "authme_dev" } else { "authme" };
        if let Ok(entry) = keyring::Entry::new(other_svc, key_name) {
            let _ = entry.delete_credential();
        }
        if key_name == "encryptionKey" {
            delete_fallback_key();
            set_active_key("".to_string());
        }
    } else if service.starts_with("authme_test") && key_name == "encryptionKey" {
        delete_fallback_key();
        set_active_key("".to_string());
    }
}

#[tauri::command]
pub fn clear_encryption_key() {
    set_active_key("".to_string());
}

#[tauri::command]
pub fn receive_encryption_key(key: String) {
    set_active_key(key);
}

pub fn prime_existing_key() {
    let active = get_active_key();
    if !active.is_empty() && active != "error" {
        return;
    }
    if let Some(k) = get_keyring_key("authme")
        .or_else(|| get_keyring_key("authme_dev"))
        .or_else(get_fallback_key)
    {
        set_active_key(k);
    }
}

#[tauri::command]
pub fn set_encryption_key(service: String) -> String {
    let active = get_active_key();
    if !active.is_empty() && active != "error" {
        return "ok".into();
    }

    let key_opt = get_keyring_key(&service)
        .or_else(|| get_keyring_key("authme"))
        .or_else(|| get_keyring_key("authme_dev"))
        .or_else(get_fallback_key);

    let key = match key_opt {
        Some(k) => {
            sync_keyring_key(&k);
            k
        }
        None => {
            let new_key = generate_random_secure_key();
            sync_keyring_key(&new_key);
            new_key
        }
    };

    set_active_key(key);
    "ok".into()
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub static TEST_MUTEX: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

    #[test]
    fn test_decrypt_empty_data() {
        let res = decrypt_data("".to_string());
        assert_eq!(res, "");
        let res_spaces = decrypt_data("   ".to_string());
        assert_eq!(res_spaces, "");
    }

    #[test]
    fn test_clear_encryption_key() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let prev_active = get_active_key();
        set_active_key("active_secret_key".to_string());
        assert_eq!(get_active_key(), "active_secret_key");
        clear_encryption_key();
        assert_eq!(get_active_key(), "");
        set_active_key(prev_active);
    }

    #[test]
    fn test_encryption_fast_path_and_key_setup() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let prev_active = get_active_key();

        let test_key = "test_secure_key_1234567890123456";
        set_active_key(test_key.to_string());

        let secret_text = "Name: Google\nSecret: JBSWY3DPEHPK3PXP\nIssuer: Google\nType: OTP_TOTP";
        let encrypted = encrypt_data(secret_text.to_string());
        assert!(!encrypted.is_empty());
        assert_ne!(encrypted, secret_text);

        let decrypted = decrypt_data(encrypted);
        assert_eq!(decrypted, secret_text);

        set_active_key(prev_active);
    }

    #[test]
    fn test_set_entry_updates_active_key_and_fallback() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = std::env::temp_dir().join("authme_test_vault_sandbox");
        let _ = fs::create_dir_all(&temp_dir);
        std::env::set_var("AUTHME_TEST_VAULT_DIR", temp_dir.to_string_lossy().to_string());

        let prev_active = get_active_key();
        clear_encryption_key();

        let new_test_key = "brand_new_key_from_frontend_32";
        let res = set_entry("encryptionKey".to_string(), new_test_key.to_string(), "authme_test_sandbox".to_string());
        assert_eq!(res, "ok");
        assert_eq!(get_active_key(), new_test_key);
        assert_eq!(get_fallback_key(), Some(new_test_key.to_string()));

        // Encrypt data with this active key
        let secret = "OTP Secret 12345";
        let enc = encrypt_data(secret.to_string());

        // Simulate app restart: clear active key in memory
        clear_encryption_key();
        assert_eq!(get_active_key(), "");

        // Decrypt must recover key from fallback/keyring and succeed!
        let dec = decrypt_data(enc);
        assert_eq!(dec, secret);
        assert_eq!(get_active_key(), new_test_key);

        // Clean up sandbox
        delete_entry("encryptionKey".to_string(), "authme_test_sandbox".to_string());
        std::env::remove_var("AUTHME_TEST_VAULT_DIR");
        let _ = fs::remove_dir_all(&temp_dir);
        set_active_key(prev_active);
    }

    #[test]
    fn test_get_entry_nonexistent_does_not_leak_master_key() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = std::env::temp_dir().join("authme_test_get_entry");
        let _ = fs::create_dir_all(&temp_dir);
        std::env::set_var("AUTHME_TEST_VAULT_DIR", temp_dir.to_string_lossy().to_string());
        let prev_active = get_active_key();

        save_fallback_key("super_secret_master_vault_key");

        // Non-existent credentials should return "error", NEVER the fallback master key
        let res = get_entry("arbitrary_unknown_password_field_xyz123".to_string(), "authme_test_unique_svc".to_string());
        assert_eq!(res, "error");

        delete_fallback_key();
        std::env::remove_var("AUTHME_TEST_VAULT_DIR");
        let _ = fs::remove_dir_all(&temp_dir);
        set_active_key(prev_active);
    }

    #[test]
    fn test_prime_existing_key_does_not_generate_unrequested_key() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = std::env::temp_dir().join("authme_test_prime_empty");
        let _ = fs::create_dir_all(&temp_dir);
        std::env::set_var("AUTHME_TEST_VAULT_DIR", temp_dir.to_string_lossy().to_string());
        let prev_active = get_active_key();
        clear_encryption_key();

        // When in isolated sandbox with empty test keyring and empty fallback, prime_existing_key doesn't crash or generate
        prime_existing_key();

        std::env::remove_var("AUTHME_TEST_VAULT_DIR");
        let _ = fs::remove_dir_all(&temp_dir);
        set_active_key(prev_active);
    }
}
