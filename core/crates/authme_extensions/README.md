# Authme Native Extensions

`authme_extensions` is a high-performance native Rust extension library (`cdylib` and `rlib`) for Authme.

## Features

- **Google Authenticator Migration Converter**: Decodes and deserializes protobuf payloads from `otpauth-migration://` URIs with high-throughput native routines.
- **Mail & OTP Parser**: Native helper routines for parsing and matching verification codes from email messages.
- **C ABI Dynamic Library Export**: Exposes C-compatible symbol exports (`extern "C"`) allowing dynamic runtime linking or direct embedded linking within Tauri applications.

## Building

```bash
cargo build --release
```

The resulting dynamic library will be compiled to `target/release/authme_extensions.dll` (on Windows) or `.so`/`.dylib` on Linux/macOS.
