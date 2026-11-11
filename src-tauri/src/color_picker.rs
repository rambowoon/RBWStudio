use serde::Serialize;
use std::sync::atomic::{AtomicIsize, AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickerInitData {
    pub mon_x: i32,
    pub mon_y: i32,
    pub mon_w: i32,
    pub mon_h: i32,
    pub cursor_x: i32,
    pub cursor_y: i32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorPickerStatus {
    pub supported: bool,
    pub hotkey: String,
    pub registered: bool,
    pub error: Option<String>,
}

struct CapturedScreen {
    bmp: Vec<u8>,
    meta: PickerInitData,
}

#[derive(Clone, Copy)]
struct ParsedHotkey {
    ctrl: bool,
    shift: bool,
    alt: bool,
    win_key: bool,
    mods: u32,
    vk: u32,
}

static CAPTURED_SCREEN: Mutex<Option<CapturedScreen>> = Mutex::new(None);
static HOTKEY_STATUS: Mutex<Option<ColorPickerStatus>> = Mutex::new(None);
static TARGET_HOTKEY: Mutex<Option<ParsedHotkey>> = Mutex::new(None);
static LISTENER_THREAD_ID: OnceLock<u32> = OnceLock::new();
static TARGET_TID_ATOM: AtomicU32 = AtomicU32::new(0);
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static LAST_TRIGGER_MS: AtomicU64 = AtomicU64::new(0);

#[cfg(target_os = "windows")]
mod win {
    use super::*;

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    pub struct MONITORINFO {
        pub cb_size: u32,
        pub rc_monitor: RECT,
        pub rc_work: RECT,
        pub dw_flags: u32,
    }

    #[repr(C)]
    pub struct MSG {
        pub hwnd: isize,
        pub message: u32,
        pub w_param: usize,
        pub l_param: isize,
        pub time: u32,
        pub pt: POINT,
    }

    #[repr(C)]
    pub struct BITMAPINFOHEADER {
        pub bi_size: u32,
        pub bi_width: i32,
        pub bi_height: i32,
        pub bi_planes: u16,
        pub bi_bit_count: u16,
        pub bi_compression: u32,
        pub bi_size_image: u32,
        pub bi_xpels_per_meter: i32,
        pub bi_ypels_per_meter: i32,
        pub bi_clr_used: u32,
        pub bi_clr_important: u32,
    }

    #[repr(C)]
    pub struct BITMAPINFO {
        pub bmi_header: BITMAPINFOHEADER,
        pub bmi_colors: [u32; 3],
    }

    pub const MOD_ALT: u32 = 0x0001;
    pub const MOD_CONTROL: u32 = 0x0002;
    pub const MOD_SHIFT: u32 = 0x0004;
    pub const MOD_WIN: u32 = 0x0008;
    pub const MOD_NOREPEAT: u32 = 0x4000;
    pub const WM_HOTKEY: u32 = 0x0312;
    pub const WM_USER_RELOAD: u32 = 0x0401;
    pub const WM_USER_TRIGGER: u32 = 0x0402;
    pub const WH_KEYBOARD_LL: i32 = 13;
    pub const WM_KEYDOWN: usize = 0x0100;
    pub const WM_SYSKEYDOWN: usize = 0x0104;
    pub const VK_SHIFT: i32 = 0x10;
    pub const VK_CONTROL: i32 = 0x11;
    pub const VK_MENU: i32 = 0x12;
    pub const VK_LWIN: i32 = 0x5B;
    pub const VK_RWIN: i32 = 0x5C;
    pub const MONITOR_DEFAULTTONEAREST: u32 = 2;
    pub const SRCCOPY: u32 = 0x00CC0020;
    pub const BI_RGB: u32 = 0;
    pub const DIB_RGB_COLORS: u32 = 0;
    pub const CF_UNICODETEXT: u32 = 13;
    pub const GMEM_MOVEABLE: u32 = 0x0002;

    #[repr(C)]
    pub struct KBDLLHOOKSTRUCT {
        pub vk_code: u32,
        pub scan_code: u32,
        pub flags: u32,
        pub time: u32,
        pub dw_extra_info: usize,
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn GetCursorPos(lp_point: *mut POINT) -> i32;
        pub fn MonitorFromPoint(pt: POINT, dw_flags: u32) -> isize;
        pub fn GetMonitorInfoW(h_monitor: isize, lpmi: *mut MONITORINFO) -> i32;
        pub fn GetDC(h_wnd: isize) -> isize;
        pub fn ReleaseDC(h_wnd: isize, h_dc: isize) -> i32;
        pub fn RegisterHotKey(h_wnd: isize, id: i32, fs_modifiers: u32, vk: u32) -> i32;
        pub fn UnregisterHotKey(h_wnd: isize, id: i32) -> i32;
        pub fn GetMessageW(lp_msg: *mut MSG, h_wnd: isize, w_msg_filter_min: u32, w_msg_filter_max: u32) -> i32;
        pub fn PostThreadMessageW(id_thread: u32, msg: u32, w_param: usize, l_param: isize) -> i32;
        pub fn SetWindowsHookExW(
            id_hook: i32,
            lpfn: unsafe extern "system" fn(i32, usize, isize) -> isize,
            hmod: isize,
            dw_thread_id: u32,
        ) -> isize;
        pub fn CallNextHookEx(hhk: isize, n_code: i32, w_param: usize, l_param: isize) -> isize;
        pub fn GetAsyncKeyState(v_key: i32) -> i16;
        pub fn OpenClipboard(h_wnd_new_owner: isize) -> i32;
        pub fn EmptyClipboard() -> i32;
        pub fn SetClipboardData(u_format: u32, h_mem: isize) -> isize;
        pub fn CloseClipboard() -> i32;
        pub fn GetSystemMetrics(n_index: i32) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        pub fn CreateCompatibleDC(hdc: isize) -> isize;
        pub fn DeleteDC(hdc: isize) -> i32;
        pub fn CreateCompatibleBitmap(hdc: isize, cx: i32, cy: i32) -> isize;
        pub fn SelectObject(hdc: isize, h: isize) -> isize;
        pub fn DeleteObject(ho: isize) -> i32;
        pub fn BitBlt(
            hdc: isize,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            hdc_src: isize,
            x1: i32,
            y1: i32,
            rop: u32,
        ) -> i32;
        pub fn GetDIBits(
            hdc: isize,
            hbm: isize,
            start: u32,
            c_lines: u32,
            lpv_bits: *mut u8,
            lpbmi: *mut BITMAPINFO,
            usage: u32,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetCurrentThreadId() -> u32;
        pub fn GetLastError() -> u32;
        pub fn GlobalAlloc(u_flags: u32, dw_bytes: usize) -> isize;
        pub fn GlobalLock(h_mem: isize) -> *mut u8;
        pub fn GlobalUnlock(h_mem: isize) -> i32;
        pub fn GlobalFree(h_mem: isize) -> isize;
    }

    pub fn parse_hotkey(hotkey: &str) -> Result<ParsedHotkey, String> {
        let mut mods = MOD_NOREPEAT;
        let mut ctrl = false;
        let mut shift = false;
        let mut alt = false;
        let mut win_key = false;
        let mut vk: Option<u32> = None;

        for raw in hotkey.split('+') {
            let tok = raw.trim().to_ascii_uppercase();
            if tok.is_empty() {
                continue;
            }
            match tok.as_str() {
                "CTRL" | "CONTROL" | "COMMANDORCONTROL" => {
                    mods |= MOD_CONTROL;
                    ctrl = true;
                }
                "SHIFT" => {
                    mods |= MOD_SHIFT;
                    shift = true;
                }
                "ALT" | "OPTION" => {
                    mods |= MOD_ALT;
                    alt = true;
                }
                "WIN" | "SUPER" | "META" | "CMD" => {
                    mods |= MOD_WIN;
                    win_key = true;
                }
                other => {
                    let parsed_vk = if other.len() == 1 {
                        let ch = other.as_bytes()[0];
                        if ch.is_ascii_alphanumeric() {
                            Some(ch as u32)
                        } else {
                            None
                        }
                    } else if let Some(num_str) = other.strip_prefix('F') {
                        if let Ok(n) = num_str.parse::<u32>() {
                            if (1..=24).contains(&n) {
                                Some(0x70 + (n - 1))
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        match other {
                            "SPACE" => Some(0x20),
                            "TAB" => Some(0x09),
                            "ENTER" | "RETURN" => Some(0x0D),
                            "INSERT" => Some(0x2D),
                            "DELETE" | "DEL" => Some(0x2E),
                            "HOME" => Some(0x24),
                            "END" => Some(0x23),
                            _ => None,
                        }
                    };
                    if let Some(code) = parsed_vk {
                        vk = Some(code);
                    } else {
                        return Err(format!("Phím '{}' không được hỗ trợ", raw.trim()));
                    }
                }
            }
        }

        match vk {
            Some(code) => Ok(ParsedHotkey {
                ctrl,
                shift,
                alt,
                win_key,
                mods,
                vk: code,
            }),
            None => Err("Thiếu phím chính trong tổ hợp phím tắt (ví dụ: Ctrl+Shift+C)".to_string()),
        }
    }

    pub fn capture_active_monitor_bmp() -> Result<CapturedScreen, String> {
        unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            let _ = GetCursorPos(&mut pt);

            let h_mon = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
            let mut mon_x = 0;
            let mut mon_y = 0;
            let mut mon_w = GetSystemMetrics(0).max(1);
            let mut mon_h = GetSystemMetrics(1).max(1);

            if h_mon != 0 {
                let mut mi = MONITORINFO {
                    cb_size: std::mem::size_of::<MONITORINFO>() as u32,
                    rc_monitor: RECT {
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                    },
                    rc_work: RECT {
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                    },
                    dw_flags: 0,
                };
                if GetMonitorInfoW(h_mon, &mut mi) != 0 {
                    mon_x = mi.rc_monitor.left;
                    mon_y = mi.rc_monitor.top;
                    mon_w = (mi.rc_monitor.right - mi.rc_monitor.left).max(1);
                    mon_h = (mi.rc_monitor.bottom - mi.rc_monitor.top).max(1);
                }
            }

            let screen_dc = GetDC(0);
            if screen_dc == 0 {
                return Err("Không thể truy cập Screen DC để chụp màn hình".to_string());
            }
            let mem_dc = CreateCompatibleDC(screen_dc);
            if mem_dc == 0 {
                ReleaseDC(0, screen_dc);
                return Err("Không thể tạo Compatible DC".to_string());
            }
            let bmp_handle = CreateCompatibleBitmap(screen_dc, mon_w, mon_h);
            if bmp_handle == 0 {
                DeleteDC(mem_dc);
                ReleaseDC(0, screen_dc);
                return Err("Không thể tạo Bitmap màn hình".to_string());
            }

            let old_obj = SelectObject(mem_dc, bmp_handle);
            let blt_ok = BitBlt(mem_dc, 0, 0, mon_w, mon_h, screen_dc, mon_x, mon_y, SRCCOPY);
            SelectObject(mem_dc, old_obj);

            if blt_ok == 0 {
                DeleteObject(bmp_handle);
                DeleteDC(mem_dc);
                ReleaseDC(0, screen_dc);
                return Err("BitBlt chụp màn hình thất bại".to_string());
            }

            let pixel_bytes_len = (mon_w as usize) * (mon_h as usize) * 4;
            let total_len = 54 + pixel_bytes_len;
            let mut bmp = vec![0u8; total_len];

            // BITMAPFILEHEADER (14 bytes)
            bmp[0] = b'B';
            bmp[1] = b'M';
            bmp[2..6].copy_from_slice(&(total_len as u32).to_le_bytes());
            bmp[10..14].copy_from_slice(&54u32.to_le_bytes());

            // BITMAPINFOHEADER (40 bytes) - top-down (-mon_h), 32-bit BGRA
            bmp[14..18].copy_from_slice(&40u32.to_le_bytes());
            bmp[18..22].copy_from_slice(&mon_w.to_le_bytes());
            bmp[22..26].copy_from_slice(&(-mon_h).to_le_bytes());
            bmp[26..28].copy_from_slice(&1u16.to_le_bytes());
            bmp[28..30].copy_from_slice(&32u16.to_le_bytes());
            bmp[30..34].copy_from_slice(&BI_RGB.to_le_bytes());
            bmp[34..38].copy_from_slice(&(pixel_bytes_len as u32).to_le_bytes());

            let mut bmi = BITMAPINFO {
                bmi_header: BITMAPINFOHEADER {
                    bi_size: 40,
                    bi_width: mon_w,
                    bi_height: -mon_h,
                    bi_planes: 1,
                    bi_bit_count: 32,
                    bi_compression: BI_RGB,
                    bi_size_image: pixel_bytes_len as u32,
                    bi_xpels_per_meter: 0,
                    bi_ypels_per_meter: 0,
                    bi_clr_used: 0,
                    bi_clr_important: 0,
                },
                bmi_colors: [0; 3],
            };

            let copied = GetDIBits(
                mem_dc,
                bmp_handle,
                0,
                mon_h as u32,
                bmp[54..].as_mut_ptr(),
                &mut bmi,
                DIB_RGB_COLORS,
            );

            DeleteObject(bmp_handle);
            DeleteDC(mem_dc);
            ReleaseDC(0, screen_dc);

            if copied == 0 {
                return Err("GetDIBits đọc pixel màn hình thất bại".to_string());
            }

            // Ensure alpha channel is 255 for every pixel so WebView2 canvas renders fully opaque
            for px in bmp[54..].chunks_exact_mut(4) {
                px[3] = 255;
            }

            Ok(CapturedScreen {
                bmp,
                meta: PickerInitData {
                    mon_x,
                    mon_y,
                    mon_w,
                    mon_h,
                    cursor_x: (pt.x - mon_x).clamp(0, mon_w - 1),
                    cursor_y: (pt.y - mon_y).clamp(0, mon_h - 1),
                },
            })
        }
    }

    pub fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
        let mut utf16: Vec<u16> = text.encode_utf16().collect();
        utf16.push(0);
        let byte_len = utf16.len() * std::mem::size_of::<u16>();

        unsafe {
            if OpenClipboard(0) == 0 {
                return Err("Không thể mở Clipboard Windows".to_string());
            }
            let _ = EmptyClipboard();
            let h_mem = GlobalAlloc(GMEM_MOVEABLE, byte_len);
            if h_mem == 0 {
                CloseClipboard();
                return Err("GlobalAlloc thất bại".to_string());
            }
            let dst = GlobalLock(h_mem);
            if dst.is_null() {
                GlobalFree(h_mem);
                CloseClipboard();
                return Err("GlobalLock thất bại".to_string());
            }
            std::ptr::copy_nonoverlapping(utf16.as_ptr() as *const u8, dst, byte_len);
            GlobalUnlock(h_mem);

            if SetClipboardData(CF_UNICODETEXT, h_mem) == 0 {
                GlobalFree(h_mem);
                CloseClipboard();
                return Err("SetClipboardData thất bại".to_string());
            }
            CloseClipboard();
            Ok(())
        }
    }
}

pub fn get_status() -> ColorPickerStatus {
    if let Ok(guard) = HOTKEY_STATUS.lock() {
        if let Some(st) = guard.as_ref() {
            return st.clone();
        }
    }
    let settings = crate::config::load_app_settings();
    let hk = if settings.color_picker_hotkey.trim().is_empty() {
        "Ctrl+Shift+C".to_string()
    } else {
        settings.color_picker_hotkey.trim().to_string()
    };
    #[cfg(target_os = "windows")]
    {
        ColorPickerStatus {
            supported: true,
            hotkey: hk,
            registered: false,
            error: None,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        ColorPickerStatus {
            supported: false,
            hotkey: hk,
            registered: false,
            error: Some("Tính năng lấy mã màu toàn cục hiện hỗ trợ trên Windows.".to_string()),
        }
    }
}

#[cfg(target_os = "windows")]
fn update_status(hotkey: &str, registered: bool, error: Option<String>) {
    if let Ok(mut guard) = HOTKEY_STATUS.lock() {
        *guard = Some(ColorPickerStatus {
            supported: true,
            hotkey: hotkey.to_string(),
            registered,
            error,
        });
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn ll_keyboard_proc(n_code: i32, w_param: usize, l_param: isize) -> isize {
    if n_code >= 0 && (w_param == win::WM_KEYDOWN || w_param == win::WM_SYSKEYDOWN) {
        let kb = &*(l_param as *const win::KBDLLHOOKSTRUCT);
        // Ignore injected synthetic events
        if (kb.flags & 0x10) == 0 {
            if let Ok(guard) = TARGET_HOTKEY.try_lock() {
                if let Some(target) = *guard {
                    if kb.vk_code == target.vk {
                        let ctrl = win::GetAsyncKeyState(win::VK_CONTROL) < 0;
                        let shift = win::GetAsyncKeyState(win::VK_SHIFT) < 0;
                        let alt = win::GetAsyncKeyState(win::VK_MENU) < 0;
                        let win_k = win::GetAsyncKeyState(win::VK_LWIN) < 0
                            || win::GetAsyncKeyState(win::VK_RWIN) < 0;

                        if ctrl == target.ctrl
                            && shift == target.shift
                            && alt == target.alt
                            && win_k == target.win_key
                        {
                            let now_ms = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0);
                            let prev = LAST_TRIGGER_MS.load(Ordering::Relaxed);
                            if now_ms.saturating_sub(prev) > 450 {
                                LAST_TRIGGER_MS.store(now_ms, Ordering::Relaxed);
                                let tid = TARGET_TID_ATOM.load(Ordering::Relaxed);
                                if tid != 0 {
                                    let _ = win::PostThreadMessageW(tid, win::WM_USER_TRIGGER, 0, 0);
                                }
                            }
                            return 1;
                        }
                    }
                }
            }
        }
    }
    win::CallNextHookEx(HOOK_HANDLE.load(Ordering::Relaxed), n_code, w_param, l_param)
}

#[cfg(target_os = "windows")]
fn register_current_hotkey() {
    unsafe {
        let _ = win::UnregisterHotKey(0, 1);
    }
    let settings = crate::config::load_app_settings();
    let hk = settings.color_picker_hotkey.trim().to_string();
    if hk.is_empty() {
        if let Ok(mut guard) = TARGET_HOTKEY.lock() {
            *guard = None;
        }
        update_status("", false, None);
        return;
    }
    match win::parse_hotkey(&hk) {
        Ok(parsed) => {
            if let Ok(mut guard) = TARGET_HOTKEY.lock() {
                *guard = Some(parsed);
            }
            let hook_ok = HOOK_HANDLE.load(Ordering::Relaxed) != 0;
            // RegisterHotKey is optional bonus when WH_KEYBOARD_LL is active
            let rhk_ok = unsafe { win::RegisterHotKey(0, 1, parsed.mods, parsed.vk) != 0 };
            if hook_ok || rhk_ok {
                update_status(&hk, true, None);
            } else {
                let err_code = unsafe { win::GetLastError() };
                update_status(
                    &hk,
                    false,
                    Some(format!("Không thể đăng ký phím tắt '{}' (mã lỗi {})", hk, err_code)),
                );
            }
        }
        Err(e) => {
            if let Ok(mut guard) = TARGET_HOTKEY.lock() {
                *guard = None;
            }
            update_status(&hk, false, Some(e));
        }
    }
}

pub fn reload_hotkey(app: &AppHandle) {
    #[cfg(target_os = "windows")]
    {
        if let Some(&tid) = LISTENER_THREAD_ID.get() {
            unsafe {
                let _ = win::PostThreadMessageW(tid, win::WM_USER_RELOAD, 0, 0);
            }
            let _ = app.emit("color-picker-status", get_status());
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
}

pub fn start_hotkey_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            let tid = unsafe { win::GetCurrentThreadId() };
            TARGET_TID_ATOM.store(tid, Ordering::Relaxed);
            let _ = LISTENER_THREAD_ID.set(tid);

            let hook = unsafe { win::SetWindowsHookExW(win::WH_KEYBOARD_LL, ll_keyboard_proc, 0, 0) };
            HOOK_HANDLE.store(hook, Ordering::Relaxed);

            register_current_hotkey();
            let _ = app.emit("color-picker-status", get_status());

            let mut msg = win::MSG {
                hwnd: 0,
                message: 0,
                w_param: 0,
                l_param: 0,
                time: 0,
                pt: win::POINT { x: 0, y: 0 },
            };

            loop {
                let ret = unsafe { win::GetMessageW(&mut msg, 0, 0, 0) };
                if ret <= 0 {
                    break;
                }
                if (msg.message == win::WM_HOTKEY && msg.w_param == 1)
                    || msg.message == win::WM_USER_TRIGGER
                {
                    let now_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    // Avoid double launch if both RegisterHotKey and LL hook fire together
                    if msg.message == win::WM_USER_TRIGGER
                        || now_ms.saturating_sub(LAST_TRIGGER_MS.load(Ordering::Relaxed)) > 350
                    {
                        if msg.message != win::WM_USER_TRIGGER {
                            LAST_TRIGGER_MS.store(now_ms, Ordering::Relaxed);
                        }
                        let app_clone = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = launch_picker(app_clone.clone(), false).await {
                                let _ = app_clone.emit("color-picker-error", e);
                            }
                        });
                    }
                } else if msg.message == win::WM_USER_RELOAD {
                    register_current_hotkey();
                    let _ = app.emit("color-picker-status", get_status());
                }
            }
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
}

pub async fn launch_picker(app: AppHandle, hide_tray: bool) -> Result<(), String> {
    if hide_tray {
        if let Some(tray_win) = app.get_webview_window("tray") {
            let _ = tray_win.hide();
        }
        let _ = tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(std::time::Duration::from_millis(80));
        })
        .await;
    }

    if let Some(existing) = app.get_webview_window("color_picker") {
        let _ = existing.destroy();
        let _ = tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(std::time::Duration::from_millis(40));
        })
        .await;
    }

    #[cfg(target_os = "windows")]
    let captured = tauri::async_runtime::spawn_blocking(win::capture_active_monitor_bmp)
        .await
        .map_err(|e| e.to_string())??;

    #[cfg(not(target_os = "windows"))]
    return Err("Tính năng lấy mã màu hiện chỉ hỗ trợ Windows.".to_string());

    #[cfg(target_os = "windows")]
    {
        let meta = captured.meta.clone();
        {
            let mut guard = CAPTURED_SCREEN.lock().map_err(|e| e.to_string())?;
            *guard = Some(captured);
        }

        let picker = WebviewWindowBuilder::new(
            &app,
            "color_picker",
            WebviewUrl::App("picker.html".into()),
        )
        .title("RBWStudio Color Picker")
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

        let _ = picker.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: meta.mon_x,
            y: meta.mon_y,
        }));
        let _ = picker.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: meta.mon_w as u32,
            height: meta.mon_h as u32,
        }));

        Ok(())
    }
}

pub fn get_picker_payload() -> Result<PickerInitData, String> {
    let guard = CAPTURED_SCREEN.lock().map_err(|e| e.to_string())?;
    guard
        .as_ref()
        .map(|s| s.meta.clone())
        .ok_or_else(|| "Không có dữ liệu ảnh màn hình".to_string())
}

pub fn get_picker_bmp_bytes() -> Result<Vec<u8>, String> {
    let guard = CAPTURED_SCREEN.lock().map_err(|e| e.to_string())?;
    guard
        .as_ref()
        .map(|s| s.bmp.clone())
        .ok_or_else(|| "Không có ảnh chụp màn hình".to_string())
}

pub fn show_picker_window(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("color_picker") {
        if let Ok(guard) = CAPTURED_SCREEN.lock() {
            if let Some(cap) = guard.as_ref() {
                let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: cap.meta.mon_x,
                    y: cap.meta.mon_y,
                }));
                let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: cap.meta.mon_w as u32,
                    height: cap.meta.mon_h as u32,
                }));
            }
        }
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

pub fn finish_picker(app: &AppHandle, color_text: &str, hex: &str) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("color_picker") {
        let _ = win.close();
    }
    if let Ok(mut guard) = CAPTURED_SCREEN.lock() {
        *guard = None;
    }
    #[cfg(target_os = "windows")]
    win::copy_text_to_clipboard(color_text)?;

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct ColorPickedEvent<'a> {
        value: &'a str,
        hex: &'a str,
    }
    let _ = app.emit(
        "color-picked",
        ColorPickedEvent {
            value: color_text,
            hex,
        },
    );
    Ok(())
}

pub fn cancel_picker(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("color_picker") {
        let _ = win.close();
    }
    if let Ok(mut guard) = CAPTURED_SCREEN.lock() {
        *guard = None;
    }
}
