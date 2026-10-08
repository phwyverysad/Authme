//! # Google Authenticator Converter
//!
//! -   Extract name, secret and issuer from a Google Authenticator migration QR code
//!
//! ### Example
//!
//! ```rust
//! use google_authenticator_converter::{extract_data_from_uri, process_data, Account};
//!
//! let qr_code = "otpauth-migration://offline?data=CjMKCkhlbGxvId6tvu8SGFRlc3QxOnRlc3QxQGV4YW1wbGUxLmNvbRoFVGVzdDEgASgBMAIKMwoKSGVsbG8h3q2%2B8BIYVGVzdDI6dGVzdDJAZXhhbXBsZTIuY29tGgVUZXN0MiABKAEwAgozCgpIZWxsbyHerb7xEhhUZXN0Mzp0ZXN0M0BleGFtcGxlMy5jb20aBVRlc3QzIAEoATACEAEYASAAKI3orYEE";
//!
//! let accounts = process_data(&qr_code);
//!
//! for account in accounts.unwrap() {
//!     println!("{0} {1} {2}", account.name, account.secret, account.issuer);
//! }
//!

use base64::{engine::general_purpose, Engine as _};
use protobuf::Message;
use serde::{Deserialize, Serialize};

mod proto;
#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    pub name: String,
    pub secret: String,
    pub issuer: String,
}

impl Account {
    pub fn new(name: String, secret: String, mut issuer: String) -> Account {
        // If the issuer is empty, use the name as the issuer.
        if issuer.is_empty() {
            issuer = name.clone()
        }

        Account {
            name,
            secret,
            issuer,
        }
    }
}

/// Convert a Google Authenticator migration QR code string to a list of accounts
pub fn process_data(string: &str) -> Result<Vec<Account>, Box<dyn std::error::Error>> {
    let encoded_data = extract_data_from_uri(string)?;
    let decoded_data = general_purpose::STANDARD.decode(encoded_data)?;

    let migration_payload =
        proto::google_auth::MigrationPayload::parse_from_bytes(decoded_data.as_slice())?;

    let otp_parameters = migration_payload.otp_parameters.into_vec();

    let alphabet = base32::Alphabet::RFC4648 { padding: false };

    let payloads: Vec<Account> = otp_parameters
        .into_iter()
        .map(|a| {
            Account::new(
                a.name,
                base32::encode(alphabet, a.secret.as_slice()),
                a.issuer,
            )
        })
        .collect();

    return Ok(payloads);
}

pub fn extract_data_from_uri(raw: &str) -> Result<String, Box<dyn std::error::Error>> {
    let mut split = raw.split("data=");
    split.next();

    if let Some(encoded_data) = split.next() {
        let clean_data = encoded_data.split('&').next().unwrap_or(encoded_data);
        let s = urlencoding::decode(clean_data)?;
        Ok(s.to_string())
    } else {
        Err("No data found in URI".into())
    }
}

/// Dynamic Link Library (.dll) exports for Authme extensions
#[no_mangle]
pub extern "C" fn authme_google_authenticator_convert(uri_ptr: *const std::os::raw::c_char) -> *mut std::os::raw::c_char {
    if uri_ptr.is_null() {
        return std::ptr::null_mut();
    }
    let c_str = unsafe { std::ffi::CStr::from_ptr(uri_ptr) };
    let uri = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    match process_data(uri) {
        Ok(accounts) => {
            let json = serde_json::to_string(&accounts).unwrap_or_else(|_| "[]".to_string());
            std::ffi::CString::new(json).map(|cs| cs.into_raw()).unwrap_or(std::ptr::null_mut())
        }
        Err(_) => {
            std::ffi::CString::new("[]").map(|cs| cs.into_raw()).unwrap_or(std::ptr::null_mut())
        }
    }
}

#[no_mangle]
pub extern "C" fn authme_free_string(ptr: *mut std::os::raw::c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = std::ffi::CString::from_raw(ptr);
        }
    }
}

#[no_mangle]
pub extern "C" fn authme_converter_version() -> *const std::os::raw::c_char {
    static VERSION: &[u8] = b"0.2.0-dll\0";
    VERSION.as_ptr() as *const std::os::raw::c_char
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_data_clean() {
        let uri = "otpauth-migration://offline?data=CjMKCkhlbGxvId6tvu8";
        assert_eq!(extract_data_from_uri(uri).unwrap(), "CjMKCkhlbGxvId6tvu8");
    }

    #[test]
    fn test_extract_data_with_trailing_params() {
        let uri = "otpauth-migration://offline?data=CjMKCkhlbGxvId6tvu8&foo=bar&baz=123";
        assert_eq!(extract_data_from_uri(uri).unwrap(), "CjMKCkhlbGxvId6tvu8");
    }

    #[test]
    fn test_extract_data_url_encoded() {
        let uri = "otpauth-migration://offline?data=CjMKCkhlbGxvId6tvu8%3D%3D&other=test";
        assert_eq!(extract_data_from_uri(uri).unwrap(), "CjMKCkhlbGxvId6tvu8==");
    }

    #[test]
    fn test_process_data_example() {
        let qr_code = "otpauth-migration://offline?data=CjMKCkhlbGxvId6tvu8SGFRlc3QxOnRlc3QxQGV4YW1wbGUxLmNvbRoFVGVzdDEgASgBMAIKMwoKSGVsbG8h3q2%2B8BIYVGVzdDI6dGVzdDJAZXhhbXBsZTIuY29tGgVUZXN0MiABKAEwAgozCgpIZWxsbyHerb7xEhhUZXN0Mzp0ZXN0M0BleGFtcGxlMy5jb20aBVRlc3QzIAEoATACEAEYASAAKI3orYEE";
        let accounts = process_data(&qr_code).unwrap();
        assert_eq!(accounts.len(), 3);
    }

    #[test]
    fn test_decode_js_migration_uri() {
        let uri = "otpauth-migration://offline?data=CjQKCkhlbGxvId6tvu8SGEdvb2dsZTp0ZXN0MUBleGFtcGxlLmNvbRoGR29vZ2xlIAEoATACCigKClRlc3RTZWNyZXQSDEdpdEh1Yjpjb2RlchoGR2l0SHViIAEoATACCicKCj3GyqSCSm0oh2cSDFN0ZWFtOnBsYXllchoFU3RlYW0gASgBMAIQARgBIAAowMQH";
        let accounts = process_data(uri).unwrap();
        assert_eq!(accounts.len(), 3);
        assert_eq!(accounts[0].secret, "JBSWY3DPEHPK3PXP");
        assert_eq!(accounts[0].issuer, "Google");
        assert_eq!(accounts[1].secret, "KRSXG5CTMVRXEZLU");
        assert_eq!(accounts[1].issuer, "GitHub");
        assert_eq!(accounts[2].secret, "HXDMVJECJJWSRB3H");
        assert_eq!(accounts[2].issuer, "Steam");
    }
}
