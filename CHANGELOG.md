# Changelog

All notable changes to this project will be documented in this file.

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
