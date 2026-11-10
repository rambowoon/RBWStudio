#!/usr/bin/env bash
set -e

echo "==================================================="
echo "  RBWStack - Build Tauri v2 + Rust (macOS)"
echo "==================================================="

if ! command -v cargo &> /dev/null; then
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    else
        echo "[X] Chưa cài đặt Rust. Hãy chạy: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        exit 1
    fi
fi

cd "$(dirname "$0")"
if command -v npx &> /dev/null; then
    npx @tauri-apps/cli build
else
    cd src-tauri
    cargo build --release
fi

echo "[OK] Hoàn tất biên dịch RBWStack cho macOS!"

