# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-26

### Added
- Quick Panel (Ctrl+Shift+P) - floating window for quick password access
- Quick Panel appears at mouse cursor position
- Quick Panel unlock interface syncs with main window
- Password copy with auto-clear (30 seconds default)
- Clipboard auto-clear configurable in settings
- Global shortcut customization (modifier + key)
- System tray with Show/Quit menu
- Close behavior settings (minimize to tray/taskbar/quit)
- Hover action buttons on entry cards for quick username/password copy

### Fixed
- Favorites category now displays correctly
- Vault initialization issues - added reset functionality
- Quick Panel toast now correctly shows "Username copied" vs "Password copied"

### Tech Stack
- Backend: Rust + Tauri 2
- Frontend: React + TypeScript
- Database: SQLite (encrypted locally)
- Encryption: AES-256-GCM + Argon2id key derivation

## [0.1.0] - 2026-02-24

### Added
- Master password authentication with Argon2id
- AES-256-GCM encryption
- Local SQLite database storage
- Configurable password generator
- Category organization (Login, Credit Card, Identity, Bank, etc.)
- Favorites functionality
- Search functionality
- Clipboard support

### Tech Stack
- Backend: Rust + Tauri 2
- Frontend: React + TypeScript
- Database: SQLite (encrypted locally)
- Encryption: AES-256-GCM + Argon2id key derivation
