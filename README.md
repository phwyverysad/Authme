# Authme

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE.md)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![Built with Tauri v2](https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8D8.svg?logo=tauri&logoColor=white)](https://tauri.app)
[![Svelte](https://img.shields.io/badge/Frontend-Svelte%20%2B%20TailwindCSS-FF3E00.svg?logo=svelte&logoColor=white)](https://svelte.dev)

A modern, fast, and privacy-focused cross-platform Two-Factor Authentication (2FA / TOTP) desktop application with integrated verification email management, built with **Tauri v2**, **Rust**, **Svelte**, and **Tailwind CSS**.

---

## Features

### 🔒 Security & Privacy First
- **Zero-Knowledge Encryption**: All credentials and secrets are encrypted locally using AES-256 with Argon2 key derivation. Your data never leaves your device unencrypted.
- **Inactivity Auto-Lock**: Automatically locks the vault after a configurable period of inactivity.
- **Clipboard Guard**: Automatically wipes copied 2FA verification tokens from the system clipboard after a customizable countdown to prevent unauthorized access.
- **Privacy Protection**: Blocks window capture and screen recordings to keep confidential tokens hidden.

### 🔑 Multi-Source Import & Export
- **Google Authenticator**: Import QR codes and migration links (`otpauth-migration://`) directly using high-performance native Rust protobuf decoding.
- **2FAS & Aegis Authenticator**: Native support for importing encrypted or decrypted vaults from 2FAS and Aegis.
- **Multi-Format Export**: Export your vault securely to encrypted backup files or interoperable structured formats.

### 📬 Integrated Mail Hub & Verification Code Extraction
- **In-App Mail Integration**: Manage verification mailboxes directly within the app.
- **Auto OTP Extraction**: Intelligent pattern recognition automatically extracts verification codes from incoming email bodies with one-click copy and auto-match to your 2FA accounts.

### ⚡ Smart UI & Usability
- **Intuitive Management**: Tagging, search filtering, custom account reordering, and favorite account pinning.
- **Context Menu & In-App Dialogs**: Modern right-click context menu and native styled interactive modals for a seamless desktop experience.
- **Time Drift Synchronization**: Real-time validation against UTC time servers to verify accurate TOTP generation.
- **Window State Persistence**: Remembers window position, size, and layout preferences across restarts.
- **Multi-Language Support**: Fully translated into English, Thai (ภาษาไทย), Spanish, French, German, Russian, Chinese, Japanese, Hungarian, Polish, and Arabic.

---

## Tech Stack

- **Backend**: Rust, Tauri v2 (`core`), and native extension crate (`core/crates/authme_extensions`).
- **Frontend**: Svelte 4, TypeScript, Tailwind CSS, Headless UI.
- **Bundler**: esbuild with custom build pipeline.

---

## Project Structure

```
├── core/                           # Tauri backend (Rust)
│   ├── crates/
│   │   ├── authme_extensions/      # Native Rust dynamic extension library
│   │   └── google_authenticator_converter/ # Protobuf migration decoder
│   ├── resources/                  # Bundled runtime binaries and dynamic libraries
│   └── src/                        # Main Tauri application logic, encryption, mail services
├── interface/                      # Svelte frontend
│   ├── components/                 # Reusable UI components (dialogs, context menu, filters)
│   ├── layout/                     # App layout and entry points
│   ├── stores/                     # Svelte reactive state stores
│   ├── styles/                     # Tailwind CSS and global styling
│   ├── utils/                      # Helper utilities, security guards, and translations
│   └── windows/                    # Application pages (codes, mail hub, settings, export/import)
├── scripts/                        # Build and development scripts
├── start.bat                       # Quick-launch development runner for Windows
├── package.json                    # Project dependencies and npm scripts
└── README.md                       # Documentation
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Rust & Cargo](https://rustup.rs/) (latest stable toolchain)
- Operating system build tools:
  - **Windows**: Microsoft C++ Build Tools / Visual Studio with C++ workload.
  - **Linux**: Standard build essentials and webkit2gtk development packages.
  - **macOS**: Xcode command line tools.

### Installation

Clone the repository and install frontend dependencies:

```bash
git clone https://github.com/phwyverysad/Authme.git
cd Authme
npm install
```

### Running in Development

Start the development environment with hot reloading:

```bash
npm start
```
*(On Windows, you can also run `start.bat`)*

### Building for Production

Compile the production desktop application:

```bash
npm run build
```

The compiled binaries and installers will be generated under `core/target/release/bundle/`.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE.md](LICENSE.md) file for details.
