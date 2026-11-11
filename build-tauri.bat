@echo off
chcp 65001 >nul
echo ===================================================
echo   RBWStudio v1.0.0 - Build Tauri v2 + Rust ^(Windows x64^)
echo ===================================================

if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
if defined CARGO_HOME if exist "%CARGO_HOME%\bin\cargo.exe" set "PATH=%CARGO_HOME%\bin;%PATH%"
if exist "E:\Rust\.cargo\bin\cargo.exe" set "PATH=E:\Rust\.cargo\bin;%PATH%"

where cargo >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [X] Chua tim thay Rust ^(cargo^). Vui long cai dat Rust tai: https://rustup.rs/
    pause
    exit /b 1
)

cd /d "%~dp0src-tauri"
echo [*] Dang bien dich RBWStudio Release Binary...
cargo build --release
if %ERRORLEVEL% neq 0 (
    echo [X] Loi trong qua trinh bien dich Rust!
    pause
    exit /b 1
)

if not exist "target\release\rbwstack.exe" (
    echo [X] Khong tim thay file target\release\rbwstack.exe!
    pause
    exit /b 1
)

copy /Y "target\release\rbwstack.exe" "%~dp0RBWStudio.exe" >nul
if errorlevel 1 (
    echo [X] Khong the ghi de RBWStudio.exe. Hay tat han app RBWStudio dang chay roi thu lai!
) else (
    echo [OK] Da xuat file thanh cong: %~dp0RBWStudio.exe
)
pause
