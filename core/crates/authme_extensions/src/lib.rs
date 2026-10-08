use std::ffi::{CStr, CString};
use std::os::raw::c_char;

/// Get Authme Extensions DLL Version
#[no_mangle]
pub extern "C" fn authme_extension_version() -> *const c_char {
    static VERSION: &[u8] = b"1.0.0-authme-dll\0";
    VERSION.as_ptr() as *const c_char
}

/// Free strings allocated by this DLL
#[no_mangle]
pub extern "C" fn authme_extension_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

/// Google Authenticator QR Migration Converter (returns JSON array of accounts)
#[no_mangle]
pub extern "C" fn authme_extension_convert_google_auth(uri_ptr: *const c_char) -> *mut c_char {
    if uri_ptr.is_null() {
        return std::ptr::null_mut();
    }
    let c_str = unsafe { CStr::from_ptr(uri_ptr) };
    let uri = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    match google_authenticator_converter::process_data(uri) {
        Ok(accounts) => {
            let json = serde_json::to_string(&accounts).unwrap_or_else(|_| "[]".to_string());
            CString::new(json).map(|cs| cs.into_raw()).unwrap_or(std::ptr::null_mut())
        }
        Err(_) => CString::new("[]").map(|cs| cs.into_raw()).unwrap_or(std::ptr::null_mut()),
    }
}

/// Extract clean email from webview or title text
#[no_mangle]
pub extern "C" fn authme_extension_extract_email(text_ptr: *const c_char) -> *mut c_char {
    if text_ptr.is_null() {
        return std::ptr::null_mut();
    }
    let c_str = unsafe { CStr::from_ptr(text_ptr) };
    let text = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let re = regex::Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
    if let Some(mat) = re.find(text) {
        let email = mat.as_str().to_lowercase();
        CString::new(email).map(|cs| cs.into_raw()).unwrap_or(std::ptr::null_mut())
    } else {
        std::ptr::null_mut()
    }
}

/// Extract unread count from mail tab title
#[no_mangle]
pub extern "C" fn authme_extension_extract_unread_count(title_ptr: *const c_char) -> i32 {
    if title_ptr.is_null() {
        return 0;
    }
    let c_str = unsafe { CStr::from_ptr(title_ptr) };
    let title = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return 0,
    };

    let re = regex::Regex::new(r"\((\d+)\)").unwrap();
    if let Some(caps) = re.captures(title) {
        if let Some(m) = caps.get(1) {
            return m.as_str().parse::<i32>().unwrap_or(0);
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        let v = authme_extension_version();
        let s = unsafe { CStr::from_ptr(v).to_str().unwrap() };
        assert!(s.contains("1.0.0"));
    }

    #[test]
    fn test_extract_email() {
        let sample = CString::new("Inbox - user@gmail.com - Gmail").unwrap();
        let res = authme_extension_extract_email(sample.as_ptr());
        assert!(!res.is_null());
        let email = unsafe { CStr::from_ptr(res).to_str().unwrap() };
        assert_eq!(email, "user@gmail.com");
        authme_extension_free_string(res);
    }

    #[test]
    fn test_extract_unread() {
        let sample = CString::new("Inbox (15) - user@gmail.com").unwrap();
        let unread = authme_extension_extract_unread_count(sample.as_ptr());
        assert_eq!(unread, 15);
    }
}
