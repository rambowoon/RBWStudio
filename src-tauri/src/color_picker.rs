use serde::Serialize;
use std::sync::atomic::{AtomicIsize, AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorPickerStatus {
    pub supported: bool,
    pub hotkey: String,
    pub registered: bool,
    pub error: Option<String>,
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
    pub const VK_LSHIFT: i32 = 0xA0;
    pub const VK_RSHIFT: i32 = 0xA1;
    pub const VK_LCONTROL: i32 = 0xA2;
    pub const VK_RCONTROL: i32 = 0xA3;
    pub const VK_LMENU: i32 = 0xA4;
    pub const VK_RMENU: i32 = 0xA5;
    pub const VK_LWIN: i32 = 0x5B;
    pub const VK_RWIN: i32 = 0x5C;
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
        pub fn GetPixel(hdc: isize, x: i32, y: i32) -> u32;
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

    pub fn sample_cursor_rgb() -> Result<(u8, u8, u8), String> {
        unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut pt) == 0 {
                return Err("Không lấy được tọa độ con trỏ chuột".to_string());
            }

            let screen_dc = GetDC(0);
            if screen_dc == 0 {
                return Err("Không thể truy cập Screen DC".to_string());
            }

            // Primary method: 1x1 BitBlt + GetDIBits (works reliably across DWM composition & multi-monitor)
            let mem_dc = CreateCompatibleDC(screen_dc);
            if mem_dc != 0 {
                let bmp = CreateCompatibleBitmap(screen_dc, 1, 1);
                if bmp != 0 {
                    let old = SelectObject(mem_dc, bmp);
                    let blt_ok = BitBlt(mem_dc, 0, 0, 1, 1, screen_dc, pt.x, pt.y, SRCCOPY);
                    SelectObject(mem_dc, old);

                    if blt_ok != 0 {
                        let mut bmi = BITMAPINFO {
                            bmi_header: BITMAPINFOHEADER {
                                bi_size: 40,
                                bi_width: 1,
                                bi_height: -1,
                                bi_planes: 1,
                                bi_bit_count: 32,
                                bi_compression: BI_RGB,
                                bi_size_image: 4,
                                bi_xpels_per_meter: 0,
                                bi_ypels_per_meter: 0,
                                bi_clr_used: 0,
                                bi_clr_important: 0,
                            },
                            bmi_colors: [0; 3],
                        };
                        let mut px = [0u8; 4]; // BGRA
                        let copied = GetDIBits(
                            mem_dc,
                            bmp,
                            0,
                            1,
                            px.as_mut_ptr(),
                            &mut bmi,
                            DIB_RGB_COLORS,
                        );
                        DeleteObject(bmp);
                        DeleteDC(mem_dc);
                        ReleaseDC(0, screen_dc);
                        if copied != 0 {
                            return Ok((px[2], px[1], px[0]));
                        }
                    } else {
                        DeleteObject(bmp);
                        DeleteDC(mem_dc);
                    }
                } else {
                    DeleteDC(mem_dc);
                }
            }

            // Fallback: GetPixel
            let color_ref = GetPixel(screen_dc, pt.x, pt.y);
            ReleaseDC(0, screen_dc);
            if color_ref == 0xFFFF_FFFF {
                return Err("Không đọc được màu tại vị trí con trỏ".to_string());
            }
            let r = (color_ref & 0xFF) as u8;
            let g = ((color_ref >> 8) & 0xFF) as u8;
            let b = ((color_ref >> 16) & 0xFF) as u8;
            Ok((r, g, b))
        }
    }

    pub fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
        let mut utf16: Vec<u16> = text.encode_utf16().collect();
        utf16.push(0);
        let byte_len = utf16.len() * std::mem::size_of::<u16>();

        unsafe {
            let mut opened = false;
            for _ in 0..5 {
                if OpenClipboard(0) != 0 {
                    opened = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            if !opened {
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
unsafe fn is_any_key_down(vks: &[i32]) -> bool {
    vks.iter().any(|&vk| win::GetAsyncKeyState(vk) < 0)
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
                        let ctrl = is_any_key_down(&[win::VK_CONTROL, win::VK_LCONTROL, win::VK_RCONTROL]);
                        let shift = is_any_key_down(&[win::VK_SHIFT, win::VK_LSHIFT, win::VK_RSHIFT]);
                        let alt = is_any_key_down(&[win::VK_MENU, win::VK_LMENU, win::VK_RMENU]);
                        let win_k = is_any_key_down(&[win::VK_LWIN, win::VK_RWIN]);

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
                            if now_ms.saturating_sub(prev) > 300 {
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

pub fn pick_color_at_cursor(app: &AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let (r, g, b) = win::sample_cursor_rgb()?;
        let hex = format!("{:02X}{:02X}{:02X}", r, g, b);
        win::copy_text_to_clipboard(&hex)?;

        #[derive(Clone, Serialize)]
        #[serde(rename_all = "camelCase")]
        struct ColorPickedEvent<'a> {
            value: &'a str,
            hex: &'a str,
        }
        let _ = app.emit(
            "color-picked",
            ColorPickedEvent {
                value: &hex,
                hex: &hex,
            },
        );
        Ok(hex)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Tính năng lấy mã màu hiện chỉ hỗ trợ Windows.".to_string())
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
                    if msg.message == win::WM_USER_TRIGGER
                        || now_ms.saturating_sub(LAST_TRIGGER_MS.load(Ordering::Relaxed)) > 250
                    {
                        if msg.message != win::WM_USER_TRIGGER {
                            LAST_TRIGGER_MS.store(now_ms, Ordering::Relaxed);
                        }
                        if let Err(e) = pick_color_at_cursor(&app) {
                            let _ = app.emit("color-picker-error", e);
                        }
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
