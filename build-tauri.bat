@echo off
chcp 65001 >nul
echo ===================================================
echo   RBWStudio v1.0.0 - Build Tauri v2 + Rust (Windows x64)
echo ===================================================

if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

where cargo >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [X] Chua tim thay Rust (cargo). Vui long cai dat Rust tai: https://rustup.rs/
    pause
    exit /b 1
)

cd /d "%~dp0src-tauri"
echo [*] Dang bien dich RBWStudio Release Binary...
cargo build --release

if exist "target\release\rbwstack.exe" (
    copy /Y "target\release\rbwstack.exe" "%~dp0RBWStudio.exe" >nul
    copy /Y "target\release\rbwstack.exe" "%~dp0RBWStack-Tauri.exe" >nul
    echo [OK] Da xuat file thanh cong: %~dp0RBWStudio.exe
) else (
    echo [X] Loi trong qua trinh bien dich Rust!
)
pause
