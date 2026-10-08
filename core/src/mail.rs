use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, WebviewBuilder, WebviewWindowBuilder, WebviewUrl, LogicalPosition, LogicalSize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MailAccount {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub email: String,
    pub label: String,
    pub custom_url: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    pub unread_count: u32,
    pub created_at: u64,
}

pub fn clean_email_str(s: &str) -> Option<String> {
    let at_idx = s.find('@')?;
    let prefix = &s[..at_idx];
    let start = prefix
        .rfind(|c: char| !c.is_ascii_alphanumeric() && c != '.' && c != '_' && c != '%' && c != '+' && c != '-')
        .map(|i| {
            let char_len = prefix[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
            i + char_len
        })
        .unwrap_or(0);
    let user_part = &prefix[start..];
    if user_part.is_empty() {
        return None;
    }

    let suffix = &s[at_idx + 1..];
    let end = suffix
        .find(|c: char| !c.is_ascii_alphanumeric() && c != '.' && c != '-')
        .unwrap_or(suffix.len());
    let domain_part = &suffix[..end].trim_end_matches('.');
    if !domain_part.contains('.') || domain_part.starts_with('.') || domain_part.len() < 3 {
        return None;
    }

    Some(format!("{}@{}", user_part, domain_part).to_lowercase())
}

pub fn extract_email_name_from_email(email: &str) -> String {
    let clean = if let Some(cleaned) = clean_email_str(email) {
        cleaned
    } else {
        email.trim().replace("DETECTED:", "").trim().to_string()
    };

    let name_part = if let Some(at) = clean.find('@') {
        if at > 0 {
            &clean[..at]
        } else {
            &clean
        }
    } else {
        &clean
    };

    if let Some(plus) = name_part.find('+') {
        if plus > 0 {
            return name_part[..plus].to_string();
        }
    }
    name_part.to_string()
}

fn get_accounts_path(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&base);
    base.join("mail_accounts.json")
}

fn get_profiles_dir(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let dir = base.join("mail_profiles");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn save_accounts_to_disk(path: &std::path::Path, accounts: &[MailAccount]) -> Result<(), String> {
    let mut disk_accounts = accounts.to_vec();
    for a in &mut disk_accounts {
        if let Some(ref pw) = a.password {
            if !pw.is_empty() {
                a.password = Some(crate::encryption::encrypt_data(pw.clone()));
            }
        }
    }
    let json = serde_json::to_string_pretty(&disk_accounts).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rekey_mail_passwords(app: AppHandle, old_key: String, new_key: String) -> Result<(), String> {
    use magic_crypt::{new_magic_crypt, MagicCryptTrait};

    let path = get_accounts_path(&app);
    if !path.exists() {
        return Ok(());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut accounts = match serde_json::from_str::<Vec<MailAccount>>(&data) {
        Ok(acc) => acc,
        Err(_) => return Ok(()),
    };

    let old_mc = new_magic_crypt!(&old_key, 256);
    let new_mc = new_magic_crypt!(&new_key, 256);

    for a in &mut accounts {
        if let Some(ref cipher_pw) = a.password {
            if !cipher_pw.is_empty() && cipher_pw != "error" {
                let plain_pw = old_mc
                    .decrypt_base64_to_string(cipher_pw)
                    .ok()
                    .or_else(|| {
                        let active_k = crate::encryption::get_active_key();
                        if !active_k.is_empty() {
                            let active_mc = new_magic_crypt!(&active_k, 256);
                            active_mc.decrypt_base64_to_string(cipher_pw).ok()
                        } else {
                            None
                        }
                    })
                    .or_else(|| {
                        let dec = crate::encryption::decrypt_data(cipher_pw.clone());
                        if dec != "error" && !dec.is_empty() {
                            Some(dec)
                        } else {
                            None
                        }
                    });

                if let Some(plain) = plain_pw {
                    if !plain.is_empty() {
                        let new_cipher = new_mc.encrypt_str_to_base64(&plain);
                        a.password = Some(new_cipher);
                    }
                }
            }
        }
    }

    let json = serde_json::to_string_pretty(&accounts).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_mail_accounts(app: AppHandle) -> Vec<MailAccount> {
    let path = get_accounts_path(&app);
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(mut accounts) = serde_json::from_str::<Vec<MailAccount>>(&data) {
            let mut migrated = false;
            for a in &mut accounts {
                // Decrypt stored password if present
                if let Some(ref pw) = a.password {
                    if !pw.is_empty() {
                        let decrypted = crate::encryption::decrypt_data(pw.clone());
                        if decrypted != "error" && !decrypted.is_empty() {
                            a.password = Some(decrypted);
                        }
                    }
                }

                if a.id == "preload_default" {
                    let new_id = format!("mail_{}", a.created_at);
                    let old_profile = get_profiles_dir(&app).join("preload_default");
                    let new_profile = get_profiles_dir(&app).join(&new_id);
                    if old_profile.exists() && !new_profile.exists() {
                        let _ = fs::rename(&old_profile, &new_profile);
                    }
                    a.id = new_id;
                    migrated = true;
                }

                // Clean up any "DETECTED:" or prefixes in email
                if let Some(cleaned) = clean_email_str(&a.email) {
                    if cleaned != a.email {
                        a.email = cleaned;
                        migrated = true;
                    }
                }
                if a.name.starts_with("DETECTED:") || a.name.trim().is_empty() {
                    let cleaned_name = extract_email_name_from_email(&a.email);
                    if !cleaned_name.is_empty() {
                        a.name = cleaned_name;
                        migrated = true;
                    }
                }
            }
            if migrated {
                let _ = save_accounts_to_disk(&path, &accounts);
            }
            return accounts;
        }
    }
    Vec::new()
}

#[tauri::command]
pub fn save_mail_account(app: AppHandle, mut account: MailAccount) -> Result<Vec<MailAccount>, String> {
    let path = get_accounts_path(&app);
    let mut accounts = get_mail_accounts(app.clone());

    if let Some(cleaned) = clean_email_str(&account.email) {
        account.email = cleaned;
    }

    if account.name.trim().is_empty() || account.name.starts_with("DETECTED:") {
        let extracted = extract_email_name_from_email(&account.email);
        account.name = if !extracted.is_empty() {
            extracted
        } else {
            "Mail".to_string()
        };
    }
    
    if let Some(pos) = accounts.iter().position(|a| a.id == account.id) {
        accounts[pos] = account;
    } else {
        accounts.push(account);
    }

    save_accounts_to_disk(&path, &accounts)?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = preload_all_mail_webviews(app_handle).await;
    });

    Ok(accounts)
}

#[tauri::command]
pub async fn delete_mail_account(app: AppHandle, id: String) -> Result<Vec<MailAccount>, String> {
    let path = get_accounts_path(&app);
    let mut accounts = get_mail_accounts(app.clone());
    accounts.retain(|a| a.id != id);

    save_accounts_to_disk(&path, &accounts)?;

    // Close and destroy the webview for this deleted account
    let target_label = format!("mail_view_{}", id);
    for (label, wv) in app.webviews() {
        if label == target_label {
            let _ = wv.close();
        }
    }

    // Reset active view if it was pointing to this deleted account
    {
        let mut state = MAIL_STATE.lock().unwrap_or_else(|e| e.into_inner());
        state.active_login_sessions.remove(&id);
        state.detected_emails.remove(&id);
        if state.current_active_view.as_deref() == Some(&target_label) {
            state.current_active_view = None;
        }
    }

    // Clean up profile folder with retry backoff in case WebView2 holds OS file locks
    let profile_dir = get_profiles_dir(&app).join(&id);
    if profile_dir.exists() {
        let p = profile_dir.clone();
        std::thread::spawn(move || {
            for delay in [300, 700, 1500] {
                std::thread::sleep(std::time::Duration::from_millis(delay));
                if !p.exists() || fs::remove_dir_all(&p).is_ok() {
                    break;
                }
            }
        });
    }

    Ok(accounts)
}

#[tauri::command]
pub fn reorder_mail_accounts(app: AppHandle, account_ids: Vec<String>) -> Result<Vec<MailAccount>, String> {
    let path = get_accounts_path(&app);
    let current = get_mail_accounts(app.clone());
    let mut reordered: Vec<MailAccount> = Vec::new();

    for id in &account_ids {
        if let Some(acc) = current.iter().find(|a| &a.id == id) {
            reordered.push(acc.clone());
        }
    }
    for acc in current {
        if !reordered.iter().any(|a| a.id == acc.id) {
            reordered.push(acc);
        }
    }

    save_accounts_to_disk(&path, &reordered)?;

    Ok(reordered)
}

#[derive(Debug, Deserialize, Clone, Copy)]
pub struct MailBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn extract_email_from_str(s: &str) -> Option<String> {
    clean_email_str(s)
}

pub fn extract_unread_count_from_title(title: &str) -> u32 {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return 0;
    }

    // Case 1: Title starts with unread count in parentheses, e.g. "(5) Mail", "(12) Inbox", "(3) Yahoo Mail"
    if trimmed.starts_with('(') {
        if let Some(close_idx) = trimmed.find(')') {
            let inside = &trimmed[1..close_idx];
            if inside.chars().all(|c| c.is_ascii_digit()) && !inside.is_empty() && inside.len() <= 5 {
                if let Ok(count) = inside.parse::<u32>() {
                    if count > 0 && count <= 99999 {
                        return count;
                    }
                }
            }
        }
    }

    // Case 2: Unread count attached to Inbox / Mail folder, e.g.
    // "Inbox (5) - user@gmail.com", "กล่องจดหมาย (12) - ...", "Posteingang (3)", "Boîte de réception (4)"
    for (open_idx, _) in trimmed.match_indices('(') {
        if let Some(close_rel) = trimmed[open_idx..].find(')') {
            let close_idx = open_idx + close_rel;
            let inside = &trimmed[open_idx + 1..close_idx];
            if inside.chars().all(|c| c.is_ascii_digit()) && !inside.is_empty() && inside.len() <= 5 {
                let prefix = trimmed[..open_idx].trim_end().to_lowercase();
                let is_inbox_prefix = prefix.ends_with("inbox")
                    || prefix.ends_with("mail")
                    || prefix.ends_with("กล่องจดหมาย")
                    || prefix.ends_with("กล่องข้อความ")
                    || prefix.ends_with("จดหมาย")
                    || prefix.ends_with("posteingang")
                    || prefix.ends_with("réception")
                    || prefix.ends_with("reception")
                    || prefix.ends_with("recibidos")
                    || prefix.ends_with("correos");
                if is_inbox_prefix {
                    if let Ok(count) = inside.parse::<u32>() {
                        if count > 0 && count <= 99999 {
                            return count;
                        }
                    }
                }
            }
        }
    }

    0
}

pub fn extract_inbox_email_from_title(s: &str) -> Option<String> {
    if let Some(open) = s.find("[AUTHME_INBOX:") {
        if let Some(close) = s[open..].find(']') {
            let inside = &s[open + 14..open + close];
            return clean_email_str(inside);
        }
    }
    if let Some(open) = s.find("[INBOX:") {
        if let Some(close) = s[open..].find(']') {
            let inside = &s[open + 7..open + close];
            return clean_email_str(inside);
        }
    }

    let lower = s.to_lowercase();
    let is_login_title = lower.contains("sign in")
        || lower.contains("log in")
        || lower.contains("login")
        || lower.contains("ลงชื่อเข้าใช้")
        || lower.contains("เข้าสู่ระบบ")
        || lower.contains("anmelden")
        || lower.contains("connexion")
        || lower.contains("iniciar sesión")
        || lower.contains("accounts.google")
        || lower.contains("login.live");

    if is_login_title {
        return None;
    }

    let is_mail_context = lower.contains("inbox")
        || lower.contains("mail")
        || lower.contains("outlook")
        || lower.contains("gmail")
        || lower.contains("yahoo")
        || lower.contains("proton")
        || lower.contains("icloud")
        || lower.contains("hotmail")
        || lower.contains("กล่องจดหมาย")
        || lower.contains("กล่องข้อความ")
        || lower.contains("จดหมาย")
        || lower.contains("posteingang")
        || lower.contains("réception")
        || lower.contains("reception")
        || lower.contains("recibidos")
        || lower.contains("correos");

    if is_mail_context {
        return clean_email_str(s);
    }
    None
}

use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::collections::{HashSet, HashMap};

#[derive(Default)]
struct MailStateManager {
    active_login_sessions: HashSet<String>,
    detected_emails: HashMap<String, String>,
    current_active_view: Option<String>,
    current_bounds: Option<MailBounds>,
    is_preloading: bool,
    is_visible: bool,
}

static MAIL_STATE: Lazy<Mutex<MailStateManager>> = Lazy::new(|| {
    Mutex::new(MailStateManager::default())
});

pub fn register_login_session(id: &str) {
    let mut state = MAIL_STATE.lock().unwrap_or_else(|e| e.into_inner());
    state.active_login_sessions.insert(id.to_string());
}

pub fn unregister_login_session(id: &str) {
    let mut state = MAIL_STATE.lock().unwrap_or_else(|e| e.into_inner());
    state.active_login_sessions.remove(id);
    state.detected_emails.remove(id);
}

pub fn is_login_session(id: &str) -> bool {
    let state = MAIL_STATE.lock().unwrap_or_else(|e| e.into_inner());
    state.active_login_sessions.contains(id)
}

pub fn record_detected_email(id: &str, email: &str) {
    let mut state = MAIL_STATE.lock().unwrap_or_else(|e| e.into_inner());
    state.detected_emails.insert(id.to_string(), email.to_string());
}

pub fn get_detected_email(id: &str) -> Option<String> {
    let state = MAIL_STATE.lock().unwrap_or_else(|e| e.into_inner());
    state.detected_emails.get(id).cloned()
}

async fn create_embedded_webview(
    app: AppHandle,
    id: String,
    url: String,
    bounds: MailBounds,
    is_login_mode: bool,
    email: Option<String>,
    password: Option<String>,
    visible: bool,
) -> Result<(), String> {
    if is_login_mode {
        register_login_session(&id);
    }
    if let Some(ref em) = email {
        if !em.trim().is_empty() {
            record_detected_email(&id, em);
        }
    }

    let view_label = format!("mail_view_{}", id);
    let parsed_url = tauri::Url::parse(&url).map_err(|e| e.to_string())?;

    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window 'main' not found".to_string())?;

    let profile_dir = get_profiles_dir(&app).join(&id);
    let _ = fs::create_dir_all(&profile_dir);

    let autofill_email_json = serde_json::to_string(&email).unwrap_or_else(|_| "null".to_string());
    let autofill_password_json = serde_json::to_string(&password).unwrap_or_else(|_| "null".to_string());

    let init_script = format!(r#"
        (function() {{
            try {{
                Object.defineProperty(navigator, 'webdriver', {{ get: () => false }});
            }} catch(e) {{}}

            try {{
                if (!navigator.plugins || navigator.plugins.length === 0) {{
                    Object.defineProperty(navigator, 'plugins', {{
                        get: () => [{{ name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' }}]
                    }});
                }}
            }} catch(e) {{}}

            try {{
                if (navigator.userAgentData) {{
                    Object.defineProperty(navigator, 'userAgentData', {{
                        get: () => ({{
                            brands: [
                                {{ brand: 'Google Chrome', version: '131' }},
                                {{ brand: 'Chromium', version: '131' }},
                                {{ brand: 'Not_A Brand', version: '24' }}
                            ],
                            mobile: false,
                            platform: 'Windows'
                        }})
                    }});
                }}
            }} catch(e) {{}}

            const autofillEmail = {autofill_email_json};
            const autofillPassword = {autofill_password_json};

            function setNativeValue(element, value) {{
                if (!element || !value) return;
                try {{
                    const prototype = window.HTMLInputElement.prototype;
                    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
                    if (descriptor && descriptor.set) {{
                        descriptor.set.call(element, value);
                    }} else {{
                        element.value = value;
                    }}
                    element.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    element.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    element.dispatchEvent(new InputEvent('input', {{ bubbles: true, data: value }}));
                }} catch(e) {{
                    try {{ element.value = value; }} catch(err) {{}}
                }}
            }}

            function tryAutoFill() {{
                try {{
                    if (autofillEmail) {{
                        const emailSelectors = [
                            'input[type="email"]',
                            'input#identifierId',
                            'input[name="identifier"]',
                            'input[name="loginfmt"]',
                            'input#i0116',
                            'input#login-username',
                            'input#username',
                            'input#account_name_text_field',
                            'input[autocomplete="email"]',
                            'input[autocomplete="username"]'
                        ];
                        const emailInputs = document.querySelectorAll(emailSelectors.join(', '));
                        for (const inp of emailInputs) {{
                            if (inp && (!inp.value || inp.value !== autofillEmail)) {{
                                setNativeValue(inp, autofillEmail);
                            }}
                        }}
                    }}
                    if (autofillPassword) {{
                        const pwdSelectors = [
                            'input[type="password"]',
                            'input[name="Passwd"]',
                            'input[name="passwd"]',
                            'input[name="password"]',
                            'input#i0118',
                            'input#password',
                            'input[autocomplete="current-password"]'
                        ];
                        const pwdInputs = document.querySelectorAll(pwdSelectors.join(', '));
                        for (const inp of pwdInputs) {{
                            if (inp && (!inp.value || inp.value !== autofillPassword)) {{
                                setNativeValue(inp, autofillPassword);
                            }}
                        }}
                    }}
                }} catch(e) {{}}
            }}

            tryAutoFill();
            setInterval(tryAutoFill, 800);
            window.addEventListener('DOMContentLoaded', tryAutoFill);
            window.addEventListener('load', tryAutoFill);

            let capturedEmail = autofillEmail || null;
            function recordEmail(val) {{
                if (!val || typeof val !== 'string') return;
                const trimmed = val.trim();
                const match = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}/);
                if (match) {{
                    capturedEmail = match[0].toLowerCase();
                    try {{
                        sessionStorage.setItem('__authme_login_email', capturedEmail);
                        const hostParts = window.location.hostname.split('.');
                        if (hostParts.length >= 2) {{
                            const rootDomain = '.' + hostParts.slice(-2).join('.');
                            document.cookie = '__authme_login_email=' + encodeURIComponent(capturedEmail) + '; domain=' + rootDomain + '; path=/; max-age=3600';
                        }}
                    }} catch(e) {{}}
                }}
            }}

            document.addEventListener('input', function(e) {{
                if (e && e.target && (e.target.value || (e.target.getAttribute && e.target.getAttribute('value')))) {{
                    recordEmail(e.target.value || e.target.getAttribute('value'));
                }}
            }}, true);

            document.addEventListener('change', function(e) {{
                if (e && e.target && (e.target.value || (e.target.getAttribute && e.target.getAttribute('value')))) {{
                    recordEmail(e.target.value || e.target.getAttribute('value'));
                }}
            }}, true);

            function extractEmail() {{
                try {{
                    const title = document.title || '';
                    const titleMatch = title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}/);
                    if (titleMatch) return titleMatch[0].toLowerCase();

                    const gAcc = document.querySelector('a[aria-label*="@"], button[aria-label*="@"], div[aria-label*="@"], [data-email*="@"]');
                    if (gAcc) {{
                        const str = gAcc.getAttribute('aria-label') || gAcc.getAttribute('data-email') || gAcc.getAttribute('title') || '';
                        const m = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}/);
                        if (m) return m[0].toLowerCase();
                    }}

                    const msBtn = document.querySelector('button[id*="O365_MainLink_Me"], button[aria-label*="Account manager"], button[aria-label*="@"], div[title*="@"], [data-user*="@"]');
                    if (msBtn) {{
                        const str = msBtn.getAttribute('aria-label') || msBtn.getAttribute('title') || msBtn.getAttribute('data-user') || msBtn.textContent || '';
                        const m = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}/);
                        if (m) return m[0].toLowerCase();
                    }}

                    try {{
                        const cookieMatch = document.cookie.match(/__authme_login_email=([^;]+)/);
                        if (cookieMatch) {{
                            const em = decodeURIComponent(cookieMatch[1]).trim().toLowerCase();
                            if (em.includes('@')) return em;
                        }}
                    }} catch(e) {{}}

                    if (capturedEmail && capturedEmail.includes('@')) return capturedEmail.toLowerCase();

                    try {{
                        const s = sessionStorage.getItem('__authme_login_email');
                        if (s && s.includes('@')) return s.toLowerCase();
                    }} catch(e) {{}}

                    const generic = document.querySelector('[aria-label*="@"], [data-user*="@"], [data-account*="@"]');
                    if (generic) {{
                        const str = generic.getAttribute('aria-label') || generic.getAttribute('data-user') || generic.getAttribute('data-account') || '';
                        const m = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{{2,}}/);
                        if (m) return m[0].toLowerCase();
                    }}
                }} catch(e) {{}}
                return null;
            }}

            function pollForState() {{
                try {{
                    const currentUrl = window.location.href || '';
                    const isLoginPage = (
                        currentUrl.includes('accounts.google.com') ||
                        currentUrl.includes('login.live.com') ||
                        currentUrl.includes('login.microsoftonline.com') ||
                        currentUrl.includes('login.yahoo.com') ||
                        currentUrl.includes('account.proton.me/login') ||
                        currentUrl.includes('signin') ||
                        currentUrl.includes('ServiceLogin') ||
                        currentUrl.includes('idmsa.apple.com')
                    );

                    const isInbox = !isLoginPage && (
                        currentUrl.includes('mail.google.com') ||
                        currentUrl.includes('outlook.live.com') ||
                        currentUrl.includes('outlook.office.com') ||
                        currentUrl.includes('outlook.office365.com') ||
                        currentUrl.includes('mail.yahoo.com') ||
                        currentUrl.includes('mail.proton.me') ||
                        currentUrl.includes('icloud.com/mail')
                    );

                    if (isInbox) {{
                        const found = extractEmail();
                        if (found && !document.title.includes('[AUTHME_INBOX:')) {{
                            document.title = document.title + ' [AUTHME_INBOX:' + found + ']';
                        }}
                    }}
                }} catch(e) {{}}
            }}

            // Disable default right-click context menu inside webview
            document.addEventListener('contextmenu', function(e) {{
                e.preventDefault();
            }}, true);
            window.addEventListener('contextmenu', function(e) {{
                e.preventDefault();
            }}, true);

            // Handle Mouse 4 (Back) and Mouse 5 (Forward/Back) inside the webview
            let lastSideNavTime = 0;
            function handleSideMouseNavigation(e) {{
                if (e.button === 3 || e.button === 4) {{
                    e.preventDefault();
                    e.stopPropagation();

                    const now = Date.now();
                    if (now - lastSideNavTime < 350) return;
                    lastSideNavTime = now;

                    const curHash = window.location.hash || '';
                    const curUrl = window.location.href || '';

                    // Check if inside a sub-view (specific email message, folder, draft, search)
                    const isInsideMessage = (
                        (curHash.length > 7 && curHash.startsWith('#inbox/')) ||
                        curHash.startsWith('#all/') ||
                        curHash.startsWith('#sent/') ||
                        curHash.startsWith('#starred/') ||
                        curHash.startsWith('#drafts/') ||
                        curHash.startsWith('#trash/') ||
                        curHash.startsWith('#spam/') ||
                        curHash.startsWith('#search/') ||
                        curUrl.includes('/id/') ||
                        curUrl.includes('/item/')
                    );

                    if (isInsideMessage && window.history.length > 1) {{
                        window.history.back();
                    }} else if (window.history.length > 1 && !curHash.endsWith('#inbox') && curHash !== '') {{
                        window.history.back();
                    }} else {{
                        // At inbox or root: signal Authme main window to exit back to dashboard
                        try {{
                            document.title = document.title.replace(/\s*\[AUTHME_NAV_BACK\]/g, '') + ' [AUTHME_NAV_BACK]';
                            setTimeout(function() {{
                                try {{
                                    document.title = document.title.replace(/\s*\[AUTHME_NAV_BACK\]/g, '');
                                }} catch(err) {{}}
                            }}, 80);
                        }} catch(err) {{}}
                    }}
                }}
            }}

            window.addEventListener('mouseup', handleSideMouseNavigation, true);

            setInterval(pollForState, 1000);
            window.addEventListener('load', pollForState);
        }})();
    "#, autofill_email_json = autofill_email_json, autofill_password_json = autofill_password_json);

    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    let app_for_title = app.clone();
    let id_for_title = id.clone();
    let app_for_page = app.clone();
    let id_for_page = id.clone();

    let builder = WebviewBuilder::new(&view_label, WebviewUrl::External(parsed_url))
        .background_color(tauri::webview::Color(255, 255, 255, 255))
        .data_directory(profile_dir)
        .user_agent(user_agent)
        .initialization_script(init_script)
        .on_document_title_changed(move |_wv, title| {
            // 0. Handle navigation back signal from webview
            if title.contains("[AUTHME_NAV_BACK]") {
                let _ = app_for_title.emit("mail:request-exit-dashboard", serde_json::json!({}));
            }

            // 1. Check for unread count in title
            let count = extract_unread_count_from_title(&title);

            let _ = app_for_title.emit(
                "mail:unread-update",
                serde_json::json!({
                    "id": id_for_title,
                    "count": count,
                    "title": title
                }),
            );

            // 2. Record any verified inbox email seen in title and trigger login-success ONLY on verified inbox
            if let Some(email) = extract_inbox_email_from_title(&title) {
                if let Some(clean_email) = clean_email_str(&email) {
                    record_detected_email(&id_for_title, &clean_email);

                    // If currently in login mode, emit login-success and unregister
                    if is_login_session(&id_for_title) {
                        let _ = app_for_title.emit(
                            "mail:login-success",
                            serde_json::json!({
                                "id": id_for_title,
                                "email": clean_email,
                                "title": title
                            }),
                        );
                        unregister_login_session(&id_for_title);
                    }
                }
            }
        })
        .on_page_load(move |wv, payload| {
            let page_url = payload.url().as_str();
            let is_login_page = page_url.contains("accounts.google.com")
                || page_url.contains("login.live.com")
                || page_url.contains("login.microsoftonline.com")
                || page_url.contains("login.yahoo.com")
                || page_url.contains("account.proton.me/login")
                || page_url.contains("signin")
                || page_url.contains("ServiceLogin")
                || page_url.contains("idmsa.apple.com");

            let is_inbox = !is_login_page && (
                page_url.contains("mail.google.com")
                || page_url.contains("outlook.live.com")
                || page_url.contains("outlook.office.com")
                || page_url.contains("outlook.office365.com")
                || page_url.contains("mail.yahoo.com")
                || page_url.contains("mail.proton.me")
                || page_url.contains("icloud.com/mail")
            );

            if is_inbox {
                let _ = wv.eval(r#"
                    (function() {
                        const email = (function() {
                            const title = document.title || '';
                            const tm = title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                            if (tm) return tm[0].toLowerCase();

                            const g = document.querySelector('a[aria-label*="@"], button[aria-label*="@"], div[aria-label*="@"]');
                            if (g) {
                                const m = (g.getAttribute('aria-label') || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                                if (m) return m[0].toLowerCase();
                            }
                            const ms = document.querySelector('button[id*="O365_MainLink_Me"], button[aria-label*="Account manager"]');
                            if (ms) {
                                const m = (ms.getAttribute('aria-label') || ms.textContent || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                                if (m) return m[0].toLowerCase();
                            }
                            try {
                                const cm = document.cookie.match(/__authme_login_email=([^;]+)/);
                                if (cm) return decodeURIComponent(cm[1]).trim().toLowerCase();
                            } catch(e) {}
                            return null;
                        })();
                        if (email && !document.title.includes('[AUTHME_INBOX:')) {
                            document.title = document.title + ' [AUTHME_INBOX:' + email + ']';
                        }
                    })();
                "#);

                let _ = app_for_page.emit(
                    "mail:inbox-loaded",
                    serde_json::json!({
                        "id": id_for_page,
                        "url": page_url
                    }),
                );
            }
        });

    let width = bounds.width.max(100.0);
    let height = bounds.height.max(100.0);
    let on_screen_pos = LogicalPosition::new(bounds.x, bounds.y);
    let off_screen_pos = LogicalPosition::new(-30000.0, -30000.0);
    let target_pos = if visible { on_screen_pos } else { off_screen_pos };
    let size = LogicalSize::new(width, height);

    let webview = window.add_child(builder, target_pos, size).map_err(|e| e.to_string())?;
    if visible {
        let _ = webview.show();
        let _ = webview.set_focus();
    } else {
        let _ = webview.hide();
    }

    if let Ok(mut state) = MAIL_STATE.lock() {
        if visible {
            state.current_active_view = Some(view_label.clone());
            state.is_visible = true;
        } else if state.current_active_view.is_none() {
            state.current_active_view = Some(view_label.clone());
        }
        state.current_bounds = Some(bounds);
    }

    println!("[Authme Mail] Embedded webview created: label={} url={} is_login={} visible={} pos={:?} size={:?}", view_label, url, is_login_mode, visible, target_pos, size);
    Ok(())
}

pub async fn preload_all_mail_webviews(app: AppHandle) -> Result<(), String> {
    if let Ok(mut state) = MAIL_STATE.lock() {
        if state.is_preloading {
            println!("[Authme Mail] Preload already in progress, skipping concurrent call.");
            return Ok(());
        }
        state.is_preloading = true;
    }

    struct PreloadGuard;
    impl Drop for PreloadGuard {
        fn drop(&mut self) {
            if let Ok(mut state) = MAIL_STATE.lock() {
                state.is_preloading = false;
            }
        }
    }
    let _guard = PreloadGuard;

    let accounts = get_mail_accounts(app.clone());
    println!("[Authme Mail] Preloading mail webviews smoothly in background. Total accounts: {}", accounts.len());

    let nav_width = 80.0;
    let (init_width, init_height) = if let Some(w) = app.get_window("main") {
        if let Ok(size) = w.inner_size() {
            let scale = w.scale_factor().unwrap_or(1.0);
            let logical = size.to_logical::<f64>(scale);
            ((logical.width - nav_width).max(600.0), logical.height.max(400.0))
        } else {
            (1200.0, 800.0)
        }
    } else {
        (1200.0, 800.0)
    };

    let bounds = MailBounds {
        x: nav_width,
        y: 0.0,
        width: init_width,
        height: init_height,
    };
    // Preload ALL connected mail accounts concurrently in background on startup
    // so that opening any account is instantaneous with 0 loading delay
    for acc in &accounts {
        let target_id = acc.id.clone();
        let target_label = format!("mail_view_{}", target_id);
        if app.get_webview(&target_label).is_none() {
            let url = if let Some(ref cu) = acc.custom_url {
                if !cu.trim().is_empty() {
                    cu.clone()
                } else {
                    "https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox".to_string()
                }
            } else {
                match acc.provider.as_str() {
                    "outlook" => "https://outlook.live.com/mail/".to_string(),
                    "yahoo" => "https://mail.yahoo.com/".to_string(),
                    "proton" => "https://mail.proton.me/".to_string(),
                    "icloud" => "https://www.icloud.com/mail".to_string(),
                    _ => "https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox".to_string(),
                }
            };

            println!("[Authme Mail] Preloading webview in background: label={} url={}", target_label, url);
            let _ = create_embedded_webview(
                app.clone(),
                target_id.clone(),
                url,
                bounds,
                false, // visible = false, stays hidden off-screen
                Some(acc.email.clone()),
                acc.password.clone(),
                false,
            ).await;
        }
    }

    if let Ok(mut state) = MAIL_STATE.lock() {
        if state.current_active_view.is_none() {
            if let Some(first) = accounts.first() {
                state.current_active_view = Some(format!("mail_view_{}", first.id));
            }
        }
        state.current_bounds = Some(bounds);
    }

    Ok(())
}

pub async fn preload_mail_webview(app: AppHandle) -> Result<(), String> {
    preload_all_mail_webviews(app).await
}

#[tauri::command]
pub async fn preload_mail_view(app: AppHandle) -> Result<(), String> {
    preload_all_mail_webviews(app).await
}

#[tauri::command]
pub async fn open_mail_view(
    app: AppHandle,
    id: String,
    url: String,
    bounds: MailBounds,
    is_login: Option<bool>,
    email: Option<String>,
    password: Option<String>,
) -> Result<(), String> {
    let is_login_flag = is_login.unwrap_or(false);
    if is_login_flag {
        register_login_session(&id);
    } else {
        unregister_login_session(&id);
    }

    if let Some(ref em) = email {
        if !em.trim().is_empty() {
            record_detected_email(&id, em);
        }
    }

    let view_label = format!("mail_view_{}", id);
    let width = bounds.width.max(100.0);
    let height = bounds.height.max(100.0);
    let on_screen_pos = LogicalPosition::new(bounds.x, bounds.y);
    let off_screen_pos = LogicalPosition::new(-30000.0, -30000.0);
    let size = LogicalSize::new(width, height);

    if let Ok(mut state) = MAIL_STATE.lock() {
        state.current_active_view = Some(view_label.clone());
        state.current_bounds = Some(bounds);
        state.is_visible = true;
    }

    // Move any other active mail webviews off-screen so only the target one is visible
    for (label, wv) in app.webviews() {
        if label.starts_with("mail_view_") && label != view_label {
            let _ = wv.set_position(off_screen_pos);
            let _ = wv.hide();
        }
    }

    // Check if target webview already exists (preloaded or previously opened)
    if let Some(wv) = app.get_webview(&view_label) {
        let _ = wv.set_position(on_screen_pos);
        let _ = wv.set_size(size);
        let _ = wv.show();
        let _ = wv.set_focus();

        let js_nav = format!(
            "if (!window.location.href || window.location.href === 'about:blank') {{ window.location.href = '{}'; }}",
            url.replace('\'', "\\'")
        );
        let _ = wv.eval(&js_nav);

        println!("[Authme Mail] Restored existing webview instantaneously: label={} pos={:?} size={:?}", view_label, on_screen_pos, size);
        return Ok(());
    }

    // If not exists yet, create it and display it
    create_embedded_webview(
        app,
        id,
        url,
        bounds,
        is_login_flag,
        email,
        password,
        true,
    ).await
}

#[tauri::command]
pub async fn update_mail_view_bounds(
    app: AppHandle,
    bounds: MailBounds,
) -> Result<(), String> {
    let width = bounds.width.max(100.0);
    let height = bounds.height.max(100.0);
    let on_screen_pos = LogicalPosition::new(bounds.x, bounds.y);
    let size = LogicalSize::new(width, height);

    let (active_label, is_visible) = if let Ok(mut state) = MAIL_STATE.lock() {
        state.current_bounds = Some(bounds);
        (state.current_active_view.clone(), state.is_visible)
    } else {
        (None, false)
    };

    let off_screen_pos = LogicalPosition::new(-30000.0, -30000.0);
    for (label, wv) in app.webviews() {
        if label.starts_with("mail_view_") {
            let _ = wv.set_size(size);
            if let Some(ref target) = active_label {
                if &label == target && is_visible {
                    let _ = wv.set_position(on_screen_pos);
                    let _ = wv.show();
                } else if !is_visible {
                    let _ = wv.set_position(off_screen_pos);
                    let _ = wv.hide();
                }
            } else if !is_visible {
                let _ = wv.set_position(off_screen_pos);
                let _ = wv.hide();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn reload_mail_view(app: AppHandle) -> Result<(), String> {
    let active_label = if let Ok(state) = MAIL_STATE.lock() {
        state.current_active_view.clone()
    } else {
        None
    };

    for (label, wv) in app.webviews() {
        if label.starts_with("mail_view_") {
            if let Some(ref target) = active_label {
                if &label == target {
                    let _ = wv.eval("window.location.reload();");
                }
            } else {
                let _ = wv.eval("window.location.reload();");
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn set_mail_view_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let (active_label, current_bounds) = if let Ok(mut state) = MAIL_STATE.lock() {
        state.is_visible = visible;
        (state.current_active_view.clone(), state.current_bounds)
    } else {
        (None, None)
    };

    let default_bounds = {
        let nav_width = 80.0;
        if let Some(w) = app.get_window("main") {
            if let Ok(size) = w.inner_size() {
                let scale = w.scale_factor().unwrap_or(1.0);
                let logical = size.to_logical::<f64>(scale);
                MailBounds {
                    x: nav_width,
                    y: 0.0,
                    width: (logical.width - nav_width).max(600.0),
                    height: logical.height.max(400.0),
                }
            } else {
                MailBounds { x: 80.0, y: 0.0, width: 1200.0, height: 800.0 }
            }
        } else {
            MailBounds { x: 80.0, y: 0.0, width: 1200.0, height: 800.0 }
        }
    };

    let resolved_bounds = current_bounds.unwrap_or(default_bounds);
    let on_screen_pos = LogicalPosition::new(resolved_bounds.x, resolved_bounds.y);
    let off_screen_pos = LogicalPosition::new(-30000.0, -30000.0);
    let on_screen_size = LogicalSize::new(resolved_bounds.width.max(100.0), resolved_bounds.height.max(100.0));

    if visible {
        if let Ok(mut state) = MAIL_STATE.lock() {
            if state.current_bounds.is_none() {
                state.current_bounds = Some(resolved_bounds);
            }
        }
    }

    let target_label = active_label.clone().or_else(|| {
        let accounts = get_mail_accounts(app.clone());
        accounts.first().map(|a| format!("mail_view_{}", a.id))
    });

    let mut first_shown = false;
    for (label, wv) in app.webviews() {
        if label.starts_with("mail_view_") {
            if visible {
                let is_match = match &target_label {
                    Some(target) => &label == target,
                    None => {
                        if !first_shown {
                            first_shown = true;
                            true
                        } else {
                            false
                        }
                    }
                };

                if is_match {
                    let _ = wv.set_size(on_screen_size);
                    let _ = wv.set_position(on_screen_pos);
                    let _ = wv.show();
                    let _ = wv.set_focus();
                } else {
                    let _ = wv.set_position(off_screen_pos);
                    let _ = wv.hide();
                }
            } else {
                let _ = wv.set_position(off_screen_pos);
                let _ = wv.hide();
            }
        }
    }

    if !visible {
        if let Some(main_win) = app.get_window("main") {
            let _ = main_win.set_focus();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn close_mail_view(app: AppHandle) -> Result<(), String> {
    if let Ok(mut state) = MAIL_STATE.lock() {
        state.active_login_sessions.clear();
        state.detected_emails.clear();
        state.current_active_view = None;
        state.is_visible = false;
    }
    let off_screen_pos = LogicalPosition::new(-30000.0, -30000.0);
    for (label, webview) in app.webviews() {
        if label.starts_with("mail_view_") {
            let _ = webview.set_position(off_screen_pos);
            let _ = webview.hide();
        }
    }
    for (label, window) in app.webview_windows() {
        if label.starts_with("mail_window_") {
            let _ = window.close();
        }
    }
    if let Some(main_win) = app.get_window("main") {
        let _ = main_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_login_session(app: AppHandle, id: String) -> Result<(), String> {
    unregister_login_session(&id);

    if let Ok(mut state) = MAIL_STATE.lock() {
        if state.current_active_view.as_deref() == Some(&format!("mail_view_{}", id)) {
            state.current_active_view = None;
        }
    }

    let target_label = format!("mail_view_{}", id);
    for (label, wv) in app.webviews() {
        if label == target_label {
            let _ = wv.close();
        }
    }

    // Only clean up profile directory if this account is NOT a saved account
    let accounts = get_mail_accounts(app.clone());
    if !accounts.iter().any(|a| a.id == id) {
        let profile_dir = get_profiles_dir(&app).join(&id);
        if profile_dir.exists() {
            let p = profile_dir.clone();
            std::thread::spawn(move || {
                for delay in [300, 700, 1500] {
                    std::thread::sleep(std::time::Duration::from_millis(delay));
                    if !p.exists() || fs::remove_dir_all(&p).is_ok() {
                        break;
                    }
                }
            });
        }
    }

    Ok(())
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    println!("[Authme Mail] open_external_url requested: {}", url);
    // Security validation: Only allow http and https protocols to prevent local command/protocol injection
    let parsed = tauri::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Only HTTP and HTTPS URLs are permitted".to_string());
    }

    if let Ok(()) = tauri_plugin_opener::OpenerExt::opener(&app).open_url(parsed.as_str(), None::<&str>) {
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        // Invoke rundll32 url.dll,FileProtocolHandler directly without cmd.exe to avoid shell command injection
        let _ = Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", parsed.as_str()])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
        return Ok(());
    }
    #[allow(unreachable_code)]
    Ok(())
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn to_base64(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut res = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        res.push(CHARSET[b0 >> 2] as char);
        res.push(CHARSET[((b0 & 3) << 4) | (b1 >> 4)] as char);
        if chunk.len() > 1 {
            res.push(CHARSET[((b1 & 15) << 2) | (b2 >> 6)] as char);
        } else {
            res.push('=');
        }
        if chunk.len() > 2 {
            res.push(CHARSET[b2 & 63] as char);
        } else {
            res.push('=');
        }
    }
    res
}

#[tauri::command]
pub fn send_mail_notification(title: String, body: String) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            use std::process::Command;
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let escaped_title = xml_escape(&title);
            let escaped_body = xml_escape(&body);
            let xml = format!(
                "<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",
                escaped_title, escaped_body
            );
            let b64 = to_base64(xml.as_bytes());

            let ps_script = format!(
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;\
                [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;\
                $bytes = [System.Convert]::FromBase64String('{}');\
                $xmlStr = [System.Text.Encoding]::UTF8.GetString($bytes);\
                $xml = New-Object Windows.Data.Xml.Dom.XmlDocument;\
                $xml.LoadXml($xmlStr);\
                $toast = [Windows.UI.Notifications.ToastNotification]::new($xml);\
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Authme').Show($toast);",
                b64
            );

            let _ = Command::new("powershell")
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_email_from_gmail_title() {
        assert_eq!(
            extract_email_from_str("Inbox (5) - user.name@gmail.com - Gmail"),
            Some("user.name@gmail.com".to_string())
        );
        assert_eq!(
            extract_email_from_str("Inbox - test@gmail.com - Gmail"),
            Some("test@gmail.com".to_string())
        );
        assert_eq!(
            extract_email_from_str("Gmail: Private and secure email [my_user@gmail.com]"),
            Some("my_user@gmail.com".to_string())
        );
        assert_eq!(
            extract_email_from_str("กล่องจดหมาย (12) - somchai@gmail.com - Gmail"),
            Some("somchai@gmail.com".to_string())
        );
        assert_eq!(
            extract_email_from_str("กล่องจดหมาย - user_test@gmail.com - Gmail"),
            Some("user_test@gmail.com".to_string())
        );
    }

    #[test]
    fn test_extract_email_from_outlook_title() {
        assert_eq!(
            extract_email_from_str("Inbox - person@outlook.com - Outlook"),
            Some("person@outlook.com".to_string())
        );
        assert_eq!(
            extract_email_from_str("Mail - work_account@office365.com - Outlook"),
            Some("work_account@office365.com".to_string())
        );
        assert_eq!(
            extract_email_from_str("จดหมาย - thai_user@outlook.co.th - Outlook"),
            Some("thai_user@outlook.co.th".to_string())
        );
        assert_eq!(
            extract_email_from_str("Outlook [office.worker@hotmail.com]"),
            Some("office.worker@hotmail.com".to_string())
        );
    }

    #[test]
    fn test_extract_email_negative_cases() {
        assert_eq!(extract_email_from_str("Sign in - Google Accounts"), None);
        assert_eq!(extract_email_from_str("Outlook – free personal email and calendar from Microsoft"), None);
        assert_eq!(extract_email_from_str("https://mail.google.com/mail"), None);
        assert_eq!(extract_email_from_str("Just some random text"), None);
        assert_eq!(extract_email_from_str("กล่องจดหมายเข้า ไม่มีเมล"), None);
    }

    #[test]
    fn test_extract_email_name_from_email() {
        assert_eq!(extract_email_name_from_email("woranat.fluke@gmail.com"), "woranat.fluke");
        assert_eq!(extract_email_name_from_email("somchai@gmail.com"), "somchai");
        assert_eq!(extract_email_name_from_email("john.doe+dev@outlook.com"), "john.doe");
        assert_eq!(extract_email_name_from_email(" plain_user "), "plain_user");
        assert_eq!(extract_email_name_from_email("plain_user+alias"), "plain_user");
        assert_eq!(extract_email_name_from_email(""), "");
    }

    #[test]
    fn test_extract_email_edge_cases() {
        // Angle brackets
        assert_eq!(
            extract_email_from_str("John Doe <john.doe@company.org>"),
            Some("john.doe@company.org".to_string())
        );
        // Parentheses
        assert_eq!(
            extract_email_from_str("Inbox (user.name@sub.domain.co.th)"),
            Some("user.name@sub.domain.co.th".to_string())
        );
        // Colon suffix
        assert_eq!(
            extract_email_from_str("Account: user@gmail.com: Logged in"),
            Some("user@gmail.com".to_string())
        );
        // Legacy DETECTED string
        assert_eq!(
            clean_email_str("DETECTED:woranat.fluke27@gmail.com"),
            Some("woranat.fluke27@gmail.com".to_string())
        );
        assert_eq!(
            extract_email_name_from_email("DETECTED:woranat.fluke27@gmail.com"),
            "woranat.fluke27"
        );
        // AUTHME_INBOX tag
        assert_eq!(
            extract_inbox_email_from_title("[AUTHME_INBOX:woranat.fluke27@gmail.com]"),
            Some("woranat.fluke27@gmail.com".to_string())
        );
        // Must reject login titles
        assert_eq!(
            extract_inbox_email_from_title("Sign in - Google Accounts"),
            None
        );
        assert_eq!(
            extract_inbox_email_from_title("ลงชื่อเข้าใช้ - บัญชี Google"),
            None
        );
    }

    #[test]
    fn test_extract_email_utf8_multibyte_safety() {
        // Thai text immediately preceding email address (must not panic on UTF-8 char boundary)
        assert_eq!(
            clean_email_str("ไทยsomchai@gmail.com"),
            Some("somchai@gmail.com".to_string())
        );
        assert_eq!(
            clean_email_str("กล่องจดหมายsomchai.dev@gmail.com"),
            Some("somchai.dev@gmail.com".to_string())
        );
        // Japanese text preceding email
        assert_eq!(
            clean_email_str("受信トレイtanaka@outlook.co.jp"),
            Some("tanaka@outlook.co.jp".to_string())
        );
        // Chinese text preceding email
        assert_eq!(
            clean_email_str("收件箱user.name@qq.com"),
            Some("user.name@qq.com".to_string())
        );
        // Emoji and special unicode preceding email
        assert_eq!(
            clean_email_str("📩fluke@authme.app"),
            Some("fluke@authme.app".to_string())
        );
    }

    #[test]
    fn test_login_session_state_management() {
        let test_id = "test_session_123";
        unregister_login_session(test_id);
        assert!(!is_login_session(test_id));
        assert_eq!(get_detected_email(test_id), None);

        register_login_session(test_id);
        assert!(is_login_session(test_id));

        record_detected_email(test_id, "test@domain.com");
        assert_eq!(get_detected_email(test_id), Some("test@domain.com".to_string()));

        unregister_login_session(test_id);
        assert!(!is_login_session(test_id));
        assert_eq!(get_detected_email(test_id), None);
    }

    #[test]
    fn test_mail_state_bounds_and_preload_guard() {
        let mut state = MailStateManager::default();
        assert_eq!(state.current_bounds.is_none(), true);
        assert_eq!(state.is_preloading, false);
        assert_eq!(state.is_visible, false);

        state.is_preloading = true;
        state.is_visible = true;
        let bounds = MailBounds {
            x: 80.0,
            y: 0.0,
            width: 1200.0,
            height: 800.0,
        };
        state.current_bounds = Some(bounds);

        assert_eq!(state.is_preloading, true);
        assert_eq!(state.is_visible, true);
        assert!(state.current_bounds.is_some());
        let b = state.current_bounds.unwrap();
        assert_eq!(b.x, 80.0);
        assert_eq!(b.width, 1200.0);
    }

    #[test]
    fn test_extract_unread_count_from_title() {
        // Starts with count in parentheses
        assert_eq!(extract_unread_count_from_title("(5) Yahoo Mail"), 5);
        assert_eq!(extract_unread_count_from_title("(12) Mail - Outlook"), 12);
        assert_eq!(extract_unread_count_from_title(" (3) Proton Mail "), 3);

        // Folder name directly followed by count in parentheses
        assert_eq!(extract_unread_count_from_title("Inbox (7) - fluke@gmail.com - Gmail"), 7);
        assert_eq!(extract_unread_count_from_title("กล่องจดหมาย (4) - user@gmail.com"), 4);
        assert_eq!(extract_unread_count_from_title("Posteingang (2) - user@domain.de"), 2);

        // Email subjects with parentheses must NOT trigger false unread counts
        assert_eq!(extract_unread_count_from_title("Invoice # (12345) - user@domain.com"), 0);
        assert_eq!(extract_unread_count_from_title("Order Confirmation (9876) - Orders"), 0);
        assert_eq!(extract_unread_count_from_title("Meeting Discussion (10:00) - Outlook"), 0);

        // Edge cases
        assert_eq!(extract_unread_count_from_title(""), 0);
        assert_eq!(extract_unread_count_from_title("Inbox - No unread"), 0);
        assert_eq!(extract_unread_count_from_title("(9999999) Absurd Count"), 0);
    }

    #[test]
    fn test_extract_inbox_email_from_title_international_and_outlook() {
        // Outlook
        assert_eq!(
            extract_inbox_email_from_title("Mail - test@outlook.com - Outlook"),
            Some("test@outlook.com".to_string())
        );
        // Thai Outlook / Hotmail
        assert_eq!(
            extract_inbox_email_from_title("จดหมาย - fluke@hotmail.com - Outlook"),
            Some("fluke@hotmail.com".to_string())
        );
        // Gmail
        assert_eq!(
            extract_inbox_email_from_title("Inbox (5) - fluke@gmail.com - Gmail"),
            Some("fluke@gmail.com".to_string())
        );
        // German
        assert_eq!(
            extract_inbox_email_from_title("Posteingang - info@firma.de - Webmail"),
            Some("info@firma.de".to_string())
        );
        // Login page should never be detected as inbox
        assert_eq!(
            extract_inbox_email_from_title("Sign in to your Microsoft account"),
            None
        );
        assert_eq!(
            extract_inbox_email_from_title("ลงชื่อเข้าใช้ - บัญชี Google"),
            None
        );
    }

    #[test]
    fn test_save_accounts_to_disk_encrypts_passwords() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join(format!("test_mail_acc_{}.json", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));

        let raw_password = "super_secret_user_password_xyz";
        let test_account = MailAccount {
            id: "test_acc_1".to_string(),
            provider: "gmail".to_string(),
            name: "Test Account".to_string(),
            email: "test@example.com".to_string(),
            label: "Test".to_string(),
            custom_url: None,
            password: Some(raw_password.to_string()),
            unread_count: 0,
            created_at: 1000,
        };

        // Save accounts using our helper
        let res = save_accounts_to_disk(&test_file, &[test_account]);
        assert!(res.is_ok());

        // Read raw file from disk
        let disk_content = fs::read_to_string(&test_file).unwrap();

        // Plaintext password MUST NOT appear anywhere in the raw file!
        assert!(!disk_content.contains(raw_password));

        // When deserialized, password should be an encrypted string that decrypts back to raw_password
        let parsed: Vec<MailAccount> = serde_json::from_str(&disk_content).unwrap();
        assert_eq!(parsed.len(), 1);
        let enc_pw = parsed[0].password.as_ref().unwrap();
        assert_ne!(enc_pw, raw_password);

        let decrypted = crate::encryption::decrypt_data(enc_pw.clone());
        assert_eq!(decrypted, raw_password);

        let _ = fs::remove_file(test_file);
    }

    #[test]
    fn test_rekey_mail_passwords_logic() {
        use magic_crypt::{new_magic_crypt, MagicCryptTrait};
        let old_key = "old_master_key_123456";
        let new_key = "new_master_key_987654";

        let old_mc = new_magic_crypt!(old_key, 256);
        let new_mc = new_magic_crypt!(new_key, 256);

        let secret = "my_email_pass";
        let old_cipher = old_mc.encrypt_str_to_base64(secret);

        let plain = old_mc.decrypt_base64_to_string(&old_cipher).unwrap();
        let new_cipher = new_mc.encrypt_str_to_base64(&plain);

        let decrypted_new = new_mc.decrypt_base64_to_string(&new_cipher).unwrap();
        assert_eq!(decrypted_new, secret);
    }

    #[test]
    fn test_rekey_mail_passwords_fallback() {
        use magic_crypt::{new_magic_crypt, MagicCryptTrait};
        let secret = "fallback_secret_password";
        let active_key = "current_active_session_key";
        let active_mc = new_magic_crypt!(active_key, 256);
        let cipher = active_mc.encrypt_str_to_base64(secret);

        let wrong_old_key = "wrong_or_empty_key";
        let wrong_mc = new_magic_crypt!(wrong_old_key, 256);
        assert!(wrong_mc.decrypt_base64_to_string(&cipher).is_err());

        let plain = active_mc.decrypt_base64_to_string(&cipher).unwrap();
        assert_eq!(plain, secret);
    }
}

