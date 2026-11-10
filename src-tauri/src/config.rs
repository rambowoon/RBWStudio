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
            color_picker_enabled: false,
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
        if let Some(exe_dir) = exe_path.parent() {
            // Check if running from src-tauri/target/debug or release
            if exe_dir.ends_with("debug") || exe_dir.ends_with("release") {
                if let Some(target_dir) = exe_dir.parent() {
                    if let Some(src_tauri_dir) = target_dir.parent() {
                        if let Some(root_dir) = src_tauri_dir.parent() {
                            return root_dir.to_path_buf();
                        }
                    }
                }
            }
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
    ] {
        let p = base.join(dir);
        if !p.exists() {
            let _ = fs::create_dir_all(&p);
        }
    }
}

pub fn load_app_settings() -> AppSettings {
    let path = get_data_file_path("app_settings.json");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

pub fn save_app_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_data_file_path("app_settings.json");
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    set_os_auto_start(settings.auto_start);
    Ok(())
}

pub fn load_demo_config() -> DemoGlobalConfig {
    let path = get_data_file_path("demo_global_config.json");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
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
    }
    DemoGlobalConfig {
        ftp_root_path: default_ftp_root(),
        da_port: default_da_port(),
        ..Default::default()
    }
}

pub fn save_demo_config(cfg: &DemoGlobalConfig) -> Result<(), String> {
    let path = get_data_file_path("demo_global_config.json");
    let json_str = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    let _ = fs::write(path, &json_str);

    // Đồng bộ tức thời sang RBW Pro manager data
    let pro_dir = get_base_dir().join("config").join("rbwmanager").join("data");
    let _ = fs::create_dir_all(&pro_dir);
    let pro_demo_path = pro_dir.join("demo_config.json");
    let pro_settings_path = pro_dir.join("settings.json");

    let mut map = serde_json::Map::new();
    map.insert("ftp_host".to_string(), serde_json::Value::String(cfg.ftp_host.clone()));
    map.insert("ftp_user".to_string(), serde_json::Value::String(cfg.ftp_user.clone()));
    map.insert("ftp_pass".to_string(), serde_json::Value::String(cfg.ftp_pass.clone()));
    map.insert("ftp_root".to_string(), serde_json::Value::String(cfg.ftp_root_path.clone()));
    map.insert("web_domain".to_string(), serde_json::Value::String(cfg.web_domain.clone()));
    map.insert("da_user".to_string(), serde_json::Value::String(cfg.da_user.clone()));
    map.insert("da_port".to_string(), serde_json::Value::String(cfg.da_port.clone()));
    map.insert("db_naming_mode".to_string(), serde_json::json!(cfg.db_naming_mode));
    map.insert("default_demo_id".to_string(), serde_json::json!("default"));
    map.insert("demo_list".to_string(), serde_json::json!([
        {
            "id": "default",
            "name": if !cfg.web_domain.is_empty() { format!("Server Demo ({})", cfg.web_domain) } else { "Server Demo Chính".to_string() },
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

    if let Ok(s) = serde_json::to_string_pretty(&serde_json::Value::Object(map)) {
        let _ = fs::write(pro_demo_path, &s);
        let _ = fs::write(pro_settings_path, &s);
    }

    Ok(())
}

pub fn load_string_map(filename: &str) -> HashMap<String, String> {
    let path = get_data_file_path(filename);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&content) {
                return map;
            }
        }
    }
    HashMap::new()
}

pub fn save_string_map(filename: &str, map: &HashMap<String, String>) -> Result<(), String> {
    let path = get_data_file_path(filename);
    let json = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn load_bool_map(filename: &str) -> HashMap<String, bool> {
    let path = get_data_file_path(filename);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, bool>>(&content) {
                return map;
            }
        }
    }
    HashMap::new()
}

pub fn save_bool_map(filename: &str, map: &HashMap<String, bool>) -> Result<(), String> {
    let path = get_data_file_path(filename);
    let json = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn load_text_file(filename: &str) -> String {
    let path = get_data_file_path(filename);
    if path.exists() {
        fs::read_to_string(&path).unwrap_or_default().trim().to_string()
    } else {
        String::new()
    }
}

pub fn save_text_file(filename: &str, content: &str) -> Result<(), String> {
    let path = get_data_file_path(filename);
    fs::write(path, content.trim()).map_err(|e| e.to_string())
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

pub fn set_os_auto_start(enabled: bool) {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(exe) = env::current_exe() {
            let exe_str = exe.to_string_lossy().to_string();
            if enabled {
                let _ = Command::new("reg")
                    .args([
                        "add",
                        "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        "RBWStack",
                        "/t",
                        "REG_SZ",
                        "/d",
                        &format!("\"{}\"", exe_str),
                        "/f",
                    ])
                    .output();
            } else {
                let _ = Command::new("reg")
                    .args([
                        "delete",
                        "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        "RBWStack",
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

