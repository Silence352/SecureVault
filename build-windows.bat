@echo off
REM SecureVault Build Script for Windows
REM ====================================

echo Installing dependencies...
npm install

echo.
echo Building Tauri application...
echo This may take 10-20 minutes on first run...
echo.

npm run tauri build

echo.
echo Build complete!
echo Output: src-tauri\target\release\bundle\nsis\SecureVault_x.x.x_x64-setup.exe
echo.
pause
