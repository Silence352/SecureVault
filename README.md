# SecureVault - Password Manager

A secure, local-first password manager built with Rust + Tauri + React.

## Features

- 🔐 Master password authentication with Argon2id
- 🔒 AES-256-GCM encryption  
- 🗄️ Local SQLite database
- 🎲 Configurable password generator
- 📂 Category organization (Login, Credit Card, Identity, Bank, etc.)
- ⭐ Favorites
- 🔍 Search functionality
- 📋 Clipboard support

## Download Windows Executable

### Build from Source

**Requirements:**
- Windows 10/11
- [Rust](https://rustup.rs/) installed
- [Node.js 20+](https://nodejs.org/) installed
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

**Build Steps:**

```cmd
:: Clone the project
git clone <your-repo>
cd Password

:: Install dependencies
npm install

:: Build Windows executable
npm run tauri build
```

The installer will be at:
```
src-tauri\target\release\bundle\nsis\SecureVault_0.1.0_x64-setup.exe
```

Or use the portable executable:
```
src-tauri\target\release\securevault.exe
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Tech Stack

- **Backend**: Rust + Tauri 2
- **Frontend**: React + TypeScript
- **Database**: SQLite (encrypted locally)
- **Encryption**: AES-256-GCM + Argon2id key derivation
