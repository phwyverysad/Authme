use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use magic_crypt::{new_magic_crypt, MagicCryptTrait};
use once_cell::sync::Lazy;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
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
    get_keyring_key_with_name(service, "encryptionKey")
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
        if let Some(k) = get_keyring_key("authme").or_else(|| get_keyring_key("authme_dev")) {
            key = k;
            set_active_key(key.clone());
        } else {
            key = generate_random_secure_key();
            set_active_key(key.clone());
            sync_keyring_key(&key);
        }
    }

    let mc = new_magic_crypt!(key, 256);
    let encrypted_string = mc.encrypt_str_to_base64(data);
    encrypted_string.into()
}

#[tauri::command]
pub fn decrypt_data(data: String) -> String {
    if data.trim().is_empty() {
        return "".into();
    }

    let active_key = get_active_key();

    // 1. FAST PATH: If active key is already present in memory, decrypt directly.
    // This avoids blocking calls to the Windows Credential Manager / OS keyring on every decrypt.
    if !active_key.is_empty() && active_key != "error" {
        let mc = new_magic_crypt!(&active_key, 256);
        if let Ok(decrypted_string) = mc.decrypt_base64_to_string(&data) {
            return decrypted_string;
        }
    }

    // 2. SLOW PATH: Keyring access only when active_key is empty or failed
    let mut candidate_keys: Vec<String> = Vec::new();

    // Key from "authme" keychain
    if let Some(k) = get_keyring_key("authme") {
        if !candidate_keys.contains(&k) {
            candidate_keys.push(k);
        }
    }

    // Key from "authme_dev" keychain
    if let Some(k) = get_keyring_key("authme_dev") {
        if !candidate_keys.contains(&k) {
            candidate_keys.push(k);
        }
    }

    // Empty string key fallback (recovery for vaults encrypted during unkeyed state)
    if !candidate_keys.contains(&"".to_string()) {
        candidate_keys.push("".to_string());
    }

    // Attempt decryption with candidate keys
    for key in &candidate_keys {
        let mc = new_magic_crypt!(key, 256);
        if let Ok(decrypted_string) = mc.decrypt_base64_to_string(&data) {
            set_active_key(key.clone());
            return decrypted_string;
        }
    }

    "error".into()
}

#[tauri::command]
pub fn set_entry(name: String, data: String, service: String) -> String {
    let s1 = set_keyring_key_with_name(&service, &name, &data);
    if service == "authme" {
        let _ = set_keyring_key_with_name("authme_dev", &name, &data);
    } else if service == "authme_dev" {
        let _ = set_keyring_key_with_name("authme", &name, &data);
    }

    if s1 {
        "ok".into()
    } else {
        "error".into()
    }
}

#[tauri::command]
pub fn get_entry(name: String, service: String) -> String {
    if let Some(k) = get_keyring_key_with_name(&service, &name)
        .or_else(|| get_keyring_key_with_name("authme", &name))
        .or_else(|| get_keyring_key_with_name("authme_dev", &name))
    {
        return k;
    }
    "error".into()
}

#[tauri::command]
pub fn delete_entry(name: String, service: String) {
    let key_name = if name.trim().is_empty() { "encryptionKey" } else { &name };
    if let Ok(entry) = keyring::Entry::new(&service, key_name) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = keyring::Entry::new("authme", key_name) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = keyring::Entry::new("authme_dev", key_name) {
        let _ = entry.delete_credential();
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

#[tauri::command]
pub fn set_encryption_key(service: String) -> String {
    let active = get_active_key();
    if !active.is_empty() && active != "error" {
        return "ok".into();
    }

    let key_opt = get_keyring_key(&service)
        .or_else(|| get_keyring_key("authme"))
        .or_else(|| get_keyring_key("authme_dev"));

    let key = match key_opt {
        Some(k) => k,
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
mod tests {
    use super::*;

    static TEST_MUTEX: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

    #[test]
    fn test_decrypt_empty_data() {
        let res = decrypt_data("".to_string());
        assert_eq!(res, "");
        let res_spaces = decrypt_data("   ".to_string());
        assert_eq!(res_spaces, "");
    }

    #[test]
    fn test_clear_encryption_key() {
        let _guard = TEST_MUTEX.lock().unwrap();
        set_active_key("active_secret_key".to_string());
        assert_eq!(get_active_key(), "active_secret_key");
        clear_encryption_key();
        assert_eq!(get_active_key(), "");
    }

    #[test]
    fn test_encryption_fast_path_and_key_setup() {
        let _guard = TEST_MUTEX.lock().unwrap();

        let test_key = "test_secure_key_1234567890123456";
        set_active_key(test_key.to_string());

        let secret_text = "Name: Google\nSecret: JBSWY3DPEHPK3PXP\nIssuer: Google\nType: OTP_TOTP";
        let encrypted = encrypt_data(secret_text.to_string());
        assert!(!encrypted.is_empty());
        assert_ne!(encrypted, secret_text);

        let decrypted = decrypt_data(encrypted);
        assert_eq!(decrypted, secret_text);

        let res = set_encryption_key("authme".to_string());
        assert_eq!(res, "ok");
        assert_eq!(get_active_key(), test_key);
    }
}


