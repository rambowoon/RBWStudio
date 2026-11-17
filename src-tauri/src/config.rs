use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_web_server: String,
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub auto_optimize_php: bool,
    pub admin_vhost_mode: bool,
    pub web_port: u16,
    pub vhost_suffix: String,
    pub mysql_port: u16,
    pub php_cgi_port: u16,
    pub color_picker_enabled: bool,
    pub color_picker_hotkey: String,
    pub active_php_version: String,
    pub active_apache_version: String,
    pub active_nginx_version: String,
    pub active_mysql_version: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_web_server: "Apache".to_string(),
            auto_start: false,
            minimize_to_tray: true,
            auto_optimize_php: true,
            admin_vhost_mode: false,
            web_port: 80,
            vhost_suffix: ".local".to_string(),
            mysql_port: 3306,
            php_cgi_port: 9000,
            color_picker_enabled: true,
            color_picker_hotkey: "Ctrl+Shift+C".to_string(),
            active_php_version: String::new(),
            active_apache_version: String::new(),
            active_nginx_version: String::new(),
            active_mysql_version: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DemoGlobalConfig {
    #[serde(rename = "FtpHost", default)]
    pub ftp_host: String,
    #[serde(rename = "FtpUser", default)]
    pub ftp_user: String,
    #[serde(rename = "FtpPass", default)]
    pub ftp_pass: String,
    #[serde(rename = "FtpRootPath", default = "default_ftp_root")]
    pub ftp_root_path: String,
    #[serde(rename = "WebDomain", default)]
    pub web_domain: String,
    #[serde(rename = "DaUser", default)]
    pub da_user: String,
    #[serde(rename = "DaPort", default = "default_da_port")]
    pub da_port: String,
    #[serde(rename = "FontFolderPath", default)]
    pub font_folder_path: String,
    #[serde(rename = "DbNamingMode", default)]
    pub db_naming_mode: i32,
}

fn default_ftp_root() -> String {
    "/domains/{domain}/public_html".to_string()
}

fn default_da_port() -> String {
    "2222".to_string()
}

pub fn get_base_dir() -> PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        let _exe_str = exe_path.to_string_lossy();

        // 1. Nếu đang chạy trong môi trường dev (cargo run / cargo tauri dev)
        if let Some(exe_dir) = exe_path.parent() {
            let check_dir = if exe_dir.ends_with("deps") {
                exe_dir.parent().unwrap_or(exe_dir)
            } else {
                exe_dir
            };
            if check_dir.ends_with("debug") || check_dir.ends_with("release") {
                if let Some(target_dir) = check_dir.parent() {
                    if let Some(src_tauri_dir) = target_dir.parent() {
                        if let Some(root_dir) = src_tauri_dir.parent() {
                            return root_dir.to_path_buf();
                        }
                    }
                }
            }
        }

        // 2. Trên macOS: Khi chạy từ gói .app đóng gói (Applications hoặc DMG),
        // bên trong Contents/MacOS là read-only và bị macOS Sandbox bảo vệ.
        // Chuyển toàn bộ dữ liệu làm việc (data, www, bin, ssl) sang ~/RBWStudio để toàn quyền ghi.
        #[cfg(target_os = "macos")]
        {
            if _exe_str.contains(".app/Contents/MacOS") {
                if let Some(home) = dirs::home_dir() {
                    let mac_dir = home.join("RBWStudio");
                    if !mac_dir.exists() {
                        let _ = fs::create_dir_all(&mac_dir);
                    }
                    return mac_dir;
                }
            }
        }

        // 3. Chạy dạng Portable thông thường (Windows / Linux / macOS binary ngoài bundle)
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.to_path_buf();
        }
    }
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn get_data_dir() -> PathBuf {
    let data_dir = get_base_dir().join("data");
    if !data_dir.exists() {
        let _ = fs::create_dir_all(&data_dir);
    }
    data_dir
}

pub fn get_data_file_path(filename: &str) -> PathBuf {
    let data_dir = get_data_dir();
    let new_path = data_dir.join(filename);
    let old_path = get_base_dir().join(filename);

    if old_path.exists() && !new_path.exists() {
        let _ = fs::rename(&old_path, &new_path);
    }
    new_path
}

const EMBEDDED_ASSETS: &[(&str, &[u8])] = &[
    (
        "config/rbwmanager/bridge.php",
        include_bytes!("../../config/rbwmanager/bridge.php"),
    ),
    (
        "config/rbwmanager/rbw_autologin.template.php",
        include_bytes!("../../config/rbwmanager/rbw_autologin.template.php"),
    ),
    (
        "extensions/nasani-sync/README.md",
        include_bytes!("../../extensions/nasani-sync/README.md"),
    ),
    (
        "extensions/nasani-sync/background.js",
        include_bytes!("../../extensions/nasani-sync/background.js"),
    ),
    (
        "extensions/nasani-sync/content-local.js",
        include_bytes!("../../extensions/nasani-sync/content-local.js"),
    ),
    (
        "extensions/nasani-sync/content.css",
        include_bytes!("../../extensions/nasani-sync/content.css"),
    ),
    (
        "extensions/nasani-sync/content.js",
        include_bytes!("../../extensions/nasani-sync/content.js"),
    ),
    (
        "extensions/nasani-sync/icon.png",
        include_bytes!("../../extensions/nasani-sync/icon.png"),
    ),
    (
        "extensions/nasani-sync/manifest.json",
        include_bytes!("../../extensions/nasani-sync/manifest.json"),
    ),
    (
        "extensions/nasani-sync/popup.html",
        include_bytes!("../../extensions/nasani-sync/popup.html"),
    ),
    (
        "extensions/nasani-sync/popup.js",
        include_bytes!("../../extensions/nasani-sync/popup.js"),
    ),
];

pub fn ensure_directories() {
    let base = get_base_dir();
    for dir in &[
        "data",
        "www",
        "bin/php",
        "bin/apache",
        "bin/nginx",
        "bin/mysql",
        "bin/nodejs",
        "bin/cloudflared",
        "phpmyadmin",
        "ssl",
        "tmp/mail",
        "tmp/sessions",
        "tmp/uploads",
        "downloads",
        "config/rbwmanager",
        "extensions/nasani-sync",
    ] {
        let p = base.join(dir);
        if !p.exists() {
            let _ = fs::create_dir_all(&p);
        }
    }

    for (rel_path, bytes) in EMBEDDED_ASSETS {
        let dest = base.join(rel_path);
        if !dest.exists() {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&dest, bytes);
        }
    }
}

pub fn load_app_settings() -> AppSettings {
    if let Some(content) = crate::db::get_setting("app_settings.json") {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

pub fn save_app_settings(settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string(settings).map_err(|e| e.to_string())?;
    crate::db::set_setting("app_settings.json", &json).map_err(|e| e.to_string())?;
    set_os_auto_start(settings.auto_start);
    Ok(())
}

pub fn load_demo_config() -> DemoGlobalConfig {
    if let Some(content) = crate::db::get_setting("demo_global_config.json") {
        if let Ok(mut cfg) = serde_json::from_str::<DemoGlobalConfig>(&content) {
            if cfg.ftp_root_path.is_empty() {
                cfg.ftp_root_path = default_ftp_root();
            }
            if cfg.da_port.is_empty() {
                cfg.da_port = default_da_port();
            }
            return cfg;
        }
    }
    DemoGlobalConfig {
        ftp_root_path: default_ftp_root(),
        da_port: default_da_port(),
        ..Default::default()
    }
}

pub fn save_demo_config_file_only(cfg: &DemoGlobalConfig) -> Result<(), String> {
    let json_str = serde_json::to_string(cfg).map_err(|e| e.to_string())?;
    crate::db::set_setting("demo_global_config.json", &json_str).map_err(|e| e.to_string())
}

pub fn save_demo_config(cfg: &DemoGlobalConfig) -> Result<(), String> {
    save_demo_config_file_only(cfg)?;

    // Đồng bộ sang pro_settings trong SQLite nhưng giữ nguyên demo_list và các cấu hình Pro khác
    let mut map = crate::db::get_json_setting("pro_settings")
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();

    map.insert("ftp_host".to_string(), serde_json::Value::String(cfg.ftp_host.clone()));
    map.insert("ftp_user".to_string(), serde_json::Value::String(cfg.ftp_user.clone()));
    map.insert("ftp_pass".to_string(), serde_json::Value::String(cfg.ftp_pass.clone()));
    map.insert("ftp_root".to_string(), serde_json::Value::String(cfg.ftp_root_path.clone()));
    map.insert("web_domain".to_string(), serde_json::Value::String(cfg.web_domain.clone()));
    map.insert("da_user".to_string(), serde_json::Value::String(cfg.da_user.clone()));
    map.insert("da_port".to_string(), serde_json::Value::String(cfg.da_port.clone()));
    map.insert("db_naming_mode".to_string(), serde_json::json!(cfg.db_naming_mode));
    if !cfg.font_folder_path.is_empty() {
        map.insert("font_source_path".to_string(), serde_json::Value::String(cfg.font_folder_path.clone()));
    }

    let has_demo_list = map
        .get("demo_list")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_demo_list {
        map.insert("default_demo_id".to_string(), serde_json::json!("default"));
        map.insert("demo_list".to_string(), serde_json::json!([
            {
                "id": "default",
                "name": if !cfg.web_domain.is_empty() { cfg.web_domain.clone() } else { "Server Demo Chính".to_string() },
                "ftp_host": cfg.ftp_host,
                "web_domain": cfg.web_domain,
                "da_user": cfg.da_user,
                "da_port": cfg.da_port,
                "ftp_user": cfg.ftp_user,
                "ftp_pass": cfg.ftp_pass,
                "ftp_root": cfg.ftp_root_path,
                "db_naming_mode": cfg.db_naming_mode
            }
        ]));
    }

    let _ = crate::db::set_json_setting("pro_settings", &serde_json::Value::Object(map));
    Ok(())
}

pub fn load_string_map(filename: &str) -> HashMap<String, String> {
    let mut map = if let Some(content) = crate::db::get_setting(filename) {
        serde_json::from_str::<HashMap<String, String>>(&content).unwrap_or_default()
    } else {
        HashMap::new()
    };

    if filename == "sites.json" {
        for (k, v) in crate::db::get_all_projects_php_map() {
            map.entry(k).or_insert(v);
        }
    } else if filename == "sites_vhosts.json" {
        for (k, v) in crate::db::get_all_vhosts_map() {
            map.entry(k).or_insert(v);
        }
    }
    map
}

pub fn save_string_map(filename: &str, map: &HashMap<String, String>) -> Result<(), String> {
    let json = serde_json::to_string(map).map_err(|e| e.to_string())?;
    crate::db::set_setting(filename, &json).map_err(|e| e.to_string())
}

pub fn load_bool_map(filename: &str) -> HashMap<String, bool> {
    let mut map = if let Some(content) = crate::db::get_setting(filename) {
        serde_json::from_str::<HashMap<String, bool>>(&content).unwrap_or_default()
    } else {
        HashMap::new()
    };

    if filename == "ssl.json" {
        for (k, v) in crate::db::get_all_ssl_map() {
            map.entry(k).or_insert(v);
        }
    }
    map
}

pub fn save_bool_map(filename: &str, map: &HashMap<String, bool>) -> Result<(), String> {
    let json = serde_json::to_string(map).map_err(|e| e.to_string())?;
    crate::db::set_setting(filename, &json).map_err(|e| e.to_string())
}

pub fn load_text_file(filename: &str) -> String {
    crate::db::get_setting(filename)
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub fn save_text_file(filename: &str, content: &str) -> Result<(), String> {
    crate::db::set_setting(filename, content.trim()).map_err(|e| e.to_string())
}

pub fn get_sites_root_dir() -> PathBuf {
    let custom = load_text_file("sites_root.txt");
    if !custom.is_empty() {
        let p = Path::new(&custom);
        if p.exists() && p.is_dir() {
            return p.to_path_buf();
        }
    }
    let www = get_base_dir().join("www");
    if !www.exists() {
        let _ = fs::create_dir_all(&www);
    }
    www
}

pub fn is_month_or_cat_folder(name: &str) -> bool {
    let lower = name.to_lowercase();
    if lower.len() == 7 && lower.chars().nth(4) == Some('_') {
        let (y, m) = lower.split_at(4);
        let m_num = &m[1..];
        return y.chars().all(|c| c.is_ascii_digit()) && m_num.chars().all(|c| c.is_ascii_digit());
    }
    if lower.starts_with("thang") {
        let rest = &lower[5..];
        return !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit());
    }
    false
}

pub fn get_www_base_dir() -> PathBuf {
    let configured = get_sites_root_dir();
    let default_www = get_base_dir().join("www");

    if configured.starts_with(&default_www) && default_www.is_dir() {
        return default_www;
    }

    if let Some(folder_name) = configured.file_name().and_then(|s| s.to_str()) {
        if is_month_or_cat_folder(folder_name) {
            if let Some(parent) = configured.parent() {
                if parent.is_dir() {
                    return parent.to_path_buf();
                }
            }
        }
    }

    configured
}

pub fn set_os_auto_start(enabled: bool) {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(exe) = env::current_exe() {
            let exe_str = exe.to_string_lossy().to_string();
            // Xóa key cũ RBWStack nếu có
            let _ = Command::new("reg")
                .args(["delete", "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "RBWStack", "/f"])
                .output();
            if enabled {
                let _ = Command::new("reg")
                    .args([
                        "add",
                        "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        "RBWStudio",
                        "/t",
                        "REG_SZ",
                        "/d",
                        &format!("\"{}\" --autostart", exe_str),
                        "/f",
                    ])
                    .output();
            } else {
                let _ = Command::new("reg")
                    .args([
                        "delete",
                        "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        "RBWStudio",
                        "/f",
                    ])
                    .output();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let launch_agents = home.join("Library/LaunchAgents");
            let _ = fs::create_dir_all(&launch_agents);
            let plist_path = launch_agents.join("com.rbwstack.app.plist");
            if enabled {
                if let Ok(exe) = env::current_exe() {
                    let plist = format!(
                        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rbwstack.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"#,
                        exe.to_string_lossy()
                    );
                    let _ = fs::write(plist_path, plist);
                }
            } else if plist_path.exists() {
                let _ = fs::remove_file(plist_path);
            }
        }
    }
}

/// Phân giải đường dẫn thư mục thực tế của một dự án (hỗ trợ cả nằm trực tiếp hoặc trong thư mục tháng như 2026_11/ten_du_an).
pub fn resolve_site_dir(site_name: &str) -> Option<PathBuf> {
    let clean = site_name.trim().trim_matches(|c| c == '/' || c == '\\');
    if clean.is_empty() {
        return None;
    }

    let sites_root = get_sites_root_dir();
    let www_base = get_www_base_dir();

    let direct_sites = sites_root.join(clean);
    if direct_sites.is_dir() {
        return Some(direct_sites);
    }

    let direct_www = www_base.join(clean);
    if direct_www.is_dir() {
        return Some(direct_www);
    }

    for base_dir in [&www_base, &sites_root] {
        if let Ok(entries) = fs::read_dir(base_dir) {
            for entry in entries.flatten() {
                let sub_dir = entry.path();
                if !sub_dir.is_dir() {
                    continue;
                }
                let folder_name = entry.file_name().to_string_lossy().to_string();
                if is_month_or_cat_folder(&folder_name) {
                    let candidate = sub_dir.join(clean);
                    if candidate.is_dir() {
                        return Some(candidate);
                    }
                }
            }
        }
    }

    None
}

/// Lấy đường dẫn tương đối (vd: "2026_11/lychihung_1962126w" hoặc "my_project") so với thư mục www gốc.
pub fn get_site_rel_path(site_path: &Path) -> String {
    let www_base = get_www_base_dir();
    let sites_root = get_sites_root_dir();

    site_path
        .strip_prefix(&www_base)
        .or_else(|_| site_path.strip_prefix(&sites_root))
        .map(|r| r.to_string_lossy().replace('\\', "/").trim_matches('/').to_string())
        .unwrap_or_else(|_| {
            site_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string()
        })
}

