#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod color_picker;
mod config;
mod db;
mod deploy;
mod downloads;
mod fonts;
mod mail;
mod pro_tools;
mod rbw_pro_backend;
mod services;
mod sites;

use config::{AppSettings, DemoGlobalConfig};
use deploy::DeployInitData;
use downloads::DownloadItem;
use fonts::{GoogleFontItem, InstalledFontInfo, LocalFontFamily, LocalFontVariant};
use mail::CaughtEmail;
use serde::{Deserialize, Serialize};
use services::ServiceStatus;
use sites::SiteInfo;
use std::fs;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialAppState {
    pub settings: AppSettings,
    pub demo_config: DemoGlobalConfig,
    pub status: ServiceStatus,
    pub sites: Vec<SiteInfo>,
    pub emails: Vec<CaughtEmail>,
    pub store_items: Vec<DownloadItem>,
    pub os_platform: String,
    pub app_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_notes: String,
    pub download_url: String,
    pub published_at: String,
}

#[tauri::command]
async fn get_initial_state(app: AppHandle) -> InitialAppState {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = config::load_app_settings();
        let demo_config = config::load_demo_config();
        let status = services::get_service_status();
        let sites = sites::get_sites_list();
        let emails = mail::load_emails();
        let store_items = downloads::get_store_items();

        downloads::sync_online_versions_background(app);

        InitialAppState {
            settings,
            demo_config,
            status,
            sites,
            emails,
            store_items,
            os_platform: std::env::consts::OS.to_string(),
            app_version: "1.0.0".to_string(),
        }
    })
    .await
    .unwrap()
}

#[tauri::command]
async fn get_service_status() -> ServiceStatus {
    tauri::async_runtime::spawn_blocking(services::get_service_status)
        .await
        .unwrap()
}

#[tauri::command]
async fn save_general_settings(app: AppHandle, settings: AppSettings, demo_config: DemoGlobalConfig) -> Result<ServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        config::save_app_settings(&settings)?;
        config::save_demo_config(&demo_config)?;
        services::generate_vhosts_configs(&settings);
        color_picker::reload_hotkey(&app);
        Ok(services::get_service_status())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn start_color_picker(app: AppHandle) -> Result<String, String> {
    color_picker::pick_color_at_cursor(&app)
}

#[tauri::command]
fn get_color_picker_status() -> color_picker::ColorPickerStatus {
    color_picker::get_status()
}

#[tauri::command]
async fn toggle_service(service_name: String, version: String) -> Result<ServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut settings = config::load_app_settings();
        let status = services::get_service_status();

        match service_name.as_str() {
            "web" => {
                if !version.is_empty() {
                    if settings.default_web_server.eq_ignore_ascii_case("Nginx") {
                        settings.active_nginx_version = version;
                    } else {
                        settings.active_apache_version = version;
                    }
                    let _ = config::save_app_settings(&settings);
                }
                if status.web_running {
                    services::stop_web_service()?;
                } else {
                    services::start_web_service(&settings)?;
                }
            }
            "php" => {
                if !version.is_empty() {
                    settings.active_php_version = version;
                    let _ = config::save_app_settings(&settings);
                }
                if status.php_running {
                    services::stop_php_service()?;
                } else {
                    services::start_php_service(&settings)?;
                }
            }
            "mysql" => {
                if !version.is_empty() {
                    settings.active_mysql_version = version;
                    let _ = config::save_app_settings(&settings);
                }
                if status.mysql_running {
                    services::stop_mysql_service()?;
                } else {
                    services::start_mysql_service(&settings)?;
                }
            }
            _ => {}
        }

        std::thread::sleep(std::time::Duration::from_millis(280));
        Ok(services::get_service_status())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn wait_for_port_release(port: u16) {
    for _ in 0..30 {
        if !services::is_port_in_use(port) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

#[tauri::command]
async fn switch_service_version(service_name: String, version: String) -> Result<ServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if version.trim().is_empty() {
            return Ok(services::get_service_status());
        }

        let mut settings = config::load_app_settings();
        let status = services::get_service_status();

        match service_name.as_str() {
            "web" => {
                if settings.default_web_server.eq_ignore_ascii_case("Nginx") {
                    settings.active_nginx_version = version;
                } else {
                    settings.active_apache_version = version;
                }
                config::save_app_settings(&settings)?;
                if status.web_running {
                    services::stop_web_service()?;
                    wait_for_port_release(settings.web_port);
                    services::start_web_service(&settings)?;
                }
            }
            "php" => {
                settings.active_php_version = version;
                config::save_app_settings(&settings)?;
                if status.php_running {
                    services::stop_php_service()?;
                    wait_for_port_release(settings.php_cgi_port);
                    services::start_php_service(&settings)?;
                }
                if status.web_running {
                    services::generate_vhosts_configs(&settings);
                }
            }
            "mysql" => {
                settings.active_mysql_version = version;
                config::save_app_settings(&settings)?;
                if status.mysql_running {
                    services::stop_mysql_service()?;
                    wait_for_port_release(settings.mysql_port);
                    services::start_mysql_service(&settings)?;
                }
            }
            _ => {}
        }

        std::thread::sleep(std::time::Duration::from_millis(280));
        Ok(services::get_service_status())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn start_all_services() -> Result<ServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let settings = config::load_app_settings();
        let _ = services::start_php_service(&settings);
        let _ = services::start_web_service(&settings);
        let _ = services::start_mysql_service(&settings);

        // Active poll up to 2 seconds for ports to become alive
        for _ in 0..20 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            let st = services::get_service_status();
            if st.php_running && st.web_running && st.mysql_running {
                return Ok(st);
            }
        }
        Ok(services::get_service_status())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn stop_all_services() -> Result<ServiceStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let _ = services::stop_web_service();
        let _ = services::stop_php_service();
        let _ = services::stop_mysql_service();

        // Active poll up to 2 seconds for ports to be closed
        for _ in 0..20 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            let st = services::get_service_status();
            if !st.php_running && !st.web_running && !st.mysql_running {
                return Ok(st);
            }
        }
        Ok(services::get_service_status())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn read_service_config(target: String) -> Result<(String, String), String> {
    let path = services::get_config_file_path(&target)?;
    let content = fs::read_to_string(&path).unwrap_or_default();
    Ok((path.to_string_lossy().to_string(), content))
}

#[tauri::command]
fn save_service_config(file_path: String, content: String) -> Result<(), String> {
    fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_sites() -> Vec<SiteInfo> {
    tauri::async_runtime::spawn_blocking(sites::get_sites_list)
        .await
        .unwrap()
}

#[tauri::command]
async fn set_sites_root(folder_path: String) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        config::save_text_file("sites_root.txt", &folder_path)?;
        let settings = config::load_app_settings();
        services::generate_vhosts_configs(&settings);
        if services::is_port_in_use(settings.web_port) {
            let _ = services::stop_web_service();
            wait_for_port_release(settings.web_port);
            let _ = services::start_web_service(&settings);
        }
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn set_site_engine(site_name: String, engine: String) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::set_site_engine(&site_name, &engine)?;
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn toggle_site_ssl(site_name: String, enabled: bool) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::toggle_site_ssl(&site_name, enabled)?;
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn set_root_project(site_name: String) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::set_root_project(&site_name)?;
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_site_vhost(site_name: String, domain: String, enable: bool) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::save_vhost(&site_name, &domain, enable)?;
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn toggle_node_site(site_name: String) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::toggle_node_app(&site_name)?;
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_node_site_config(site_name: String, autostart: bool, start_cmd: String) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::set_node_config(&site_name, autostart, &start_cmd)?;
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn toggle_site_tunnel(site_name: String) -> Result<Vec<SiteInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sites::toggle_cloudflare_tunnel(&site_name)?;
        std::thread::sleep(std::time::Duration::from_millis(600));
        Ok(sites::get_sites_list())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    sites::open_in_file_manager(&path)
}

#[tauri::command]
fn open_vscode(path: String) -> Result<(), String> {
    sites::open_in_vscode(&path)
}

#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    sites::open_in_terminal(&path)
}

#[tauri::command]
fn open_browser(url: String) -> Result<(), String> {
    sites::open_url_in_browser(&url)
}

#[tauri::command]
fn get_emails() -> Vec<CaughtEmail> {
    mail::load_emails()
}

#[tauri::command]
fn mark_email_read(id: String) -> Result<Vec<CaughtEmail>, String> {
    mail::mark_email_read(&id)
}

#[tauri::command]
fn delete_email(id: String) -> Result<Vec<CaughtEmail>, String> {
    mail::delete_email(&id)
}

#[tauri::command]
fn clear_emails() -> Result<Vec<CaughtEmail>, String> {
    mail::clear_all_emails()
}

#[tauri::command]
fn open_email_in_browser(id: String) -> Result<(), String> {
    let emails = mail::load_emails();
    if let Some(m) = emails.into_iter().find(|e| e.id == id) {
        let preview_path = config::get_base_dir().join("tmp/mail/preview.html");
        let _ = fs::write(&preview_path, &m.html_body);
        sites::open_url_in_browser(&preview_path.to_string_lossy())?;
    }
    Ok(())
}

#[tauri::command]
async fn scan_local_fonts(folder_path: String) -> Vec<LocalFontFamily> {
    tauri::async_runtime::spawn_blocking(move || fonts::scan_local_fonts(&folder_path))
        .await
        .unwrap()
}

#[tauri::command]
async fn get_google_fonts() -> Vec<GoogleFontItem> {
    tauri::async_runtime::spawn_blocking(fonts::fetch_google_fonts_list)
        .await
        .unwrap()
}

#[tauri::command]
async fn get_project_fonts(project_path: String) -> (String, Vec<InstalledFontInfo>) {
    tauri::async_runtime::spawn_blocking(move || fonts::get_project_fonts_info(&project_path))
        .await
        .unwrap()
}

#[tauri::command]
async fn install_local_font(
    project_path: String,
    family_name: String,
    variants: Vec<LocalFontVariant>,
    convert_woff: bool,
) -> Result<(String, Vec<InstalledFontInfo>), String> {
    tauri::async_runtime::spawn_blocking(move || {
        fonts::install_local_font_to_project(&project_path, &family_name, &variants, convert_woff)?;
        Ok(fonts::get_project_fonts_info(&project_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn install_google_font(
    project_path: String,
    family_name: String,
    weights: Vec<String>,
    mode: String,
) -> Result<(String, Vec<InstalledFontInfo>), String> {
    tauri::async_runtime::spawn_blocking(move || {
        fonts::install_google_font_to_project(&project_path, &family_name, &weights, &mode)?;
        Ok(fonts::get_project_fonts_info(&project_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn uninstall_project_font(project_path: String, family_name: String) -> Result<(String, Vec<InstalledFontInfo>), String> {
    tauri::async_runtime::spawn_blocking(move || {
        fonts::uninstall_font_from_project(&project_path, &family_name)?;
        Ok(fonts::get_project_fonts_info(&project_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_deploy_data(site_name: String) -> DeployInitData {
    tauri::async_runtime::spawn_blocking(move || deploy::get_deploy_init_data(&site_name))
        .await
        .unwrap()
}

#[tauri::command]
fn start_deploy_demo(
    app: AppHandle,
    site_name: String,
    ssl_enabled: bool,
    db_only: bool,
    custom_db_suffix: String,
) {
    deploy::run_deploy_demo(app, site_name, ssl_enabled, db_only, custom_db_suffix);
}

#[tauri::command]
fn toggle_lock_demo(app: AppHandle, site_name: String) {
    deploy::toggle_lock_demo(app, site_name);
}

#[tauri::command]
fn delete_demo_project(app: AppHandle, site_name: String) {
    deploy::delete_demo_project(app, site_name);
}

#[tauri::command]
async fn get_store_items() -> Vec<DownloadItem> {
    tauri::async_runtime::spawn_blocking(downloads::get_store_items)
        .await
        .unwrap()
}

#[tauri::command]
fn sync_online_store_versions(app: AppHandle) {
    downloads::sync_online_versions_background(app);
}

#[tauri::command]
fn download_and_install_item(app: AppHandle, item_id: String) {
    downloads::install_store_item(app, item_id);
}

#[tauri::command]
async fn check_github_update() -> ReleaseInfo {
    tauri::async_runtime::spawn_blocking(|| {
        let current = "1.0.0".to_string();
        if let Ok(client) = reqwest::blocking::Client::builder()
            .user_agent("RBWStudio-Updater/1.0")
            .timeout(std::time::Duration::from_secs(6))
            .build()
        {
            if let Ok(resp) = client
                .get("https://api.github.com/repos/rambowoon/RBWStack/releases/latest")
                .send()
            {
                if let Ok(val) = resp.json::<serde_json::Value>() {
                    let tag = val
                        .get("tag_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("v1.0.0")
                        .trim_start_matches('v')
                        .to_string();
                    let notes = val
                        .get("body")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Đã tối ưu hóa kiến trúc đa nền tảng Tauri v2 + Rust.")
                        .to_string();
                    let html_url = val
                        .get("html_url")
                        .and_then(|v| v.as_str())
                        .unwrap_or("https://github.com/rambowoon/RBWStack/releases")
                        .to_string();
                    let pub_at = val
                        .get("published_at")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let has_update = tag != current && !tag.is_empty();
                    return ReleaseInfo {
                        current_version: current,
                        latest_version: tag,
                        has_update,
                        release_notes: notes,
                        download_url: html_url,
                        published_at: pub_at,
                    };
                }
            }
        }

        ReleaseInfo {
            current_version: current.clone(),
            latest_version: current,
            has_update: false,
            release_notes: "• Ra mắt RBWStudio v1.0.0 chạy trên lõi Rust + Tauri v2 siêu nhẹ.\n• Hỗ trợ tương thích song song Windows & macOS.\n• Tích hợp sẵn máy chủ SMTP Mail Sandbox (cổng 1025).\n• Tích hợp bộ chuyển đổi TTF/OTF sang WOFF & trình tải Google Fonts.\n• Tự động đồng bộ cấu hình DirectAdmin & FTP Deploy Demo.".to_string(),
            download_url: "https://github.com/rambowoon/RBWStack/releases".to_string(),
            published_at: "2026".to_string(),
        }
    })
    .await
    .unwrap()
}

#[tauri::command]
fn window_close_or_hide(app: AppHandle) {
    let settings = config::load_app_settings();
    if let Some(win) = app.get_webview_window("main") {
        if settings.minimize_to_tray {
            let _ = win.hide();
        } else {
            let _ = win.hide();
            std::thread::spawn(move || {
                let _ = services::stop_web_service();
                let _ = services::stop_php_service();
                let _ = services::stop_mysql_service();
                app.exit(0);
            });
        }
    }
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    std::thread::spawn(move || {
        let _ = services::stop_web_service();
        let _ = services::stop_php_service();
        let _ = services::stop_mysql_service();
        app.exit(0);
    });
}

#[tauri::command]
async fn resize_tray_window(app: AppHandle, height: f64) -> Result<(), String> {
    if let Some(tray_win) = app.get_webview_window("tray") {
        let win_w = 270.0;
        let win_h = height.max(200.0);
        let _ = tray_win.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: win_w,
            height: win_h,
        }));
    }
    Ok(())
}

// ============================================================================
// RBW PRO TOOLS COMMANDS
// ============================================================================

#[tauri::command]
fn window_toggle_maximize(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_maximized().unwrap_or(false) {
            let _ = w.unmaximize();
        } else {
            let _ = w.maximize();
        }
    }
}

#[tauri::command]
async fn pro_get_manager_url() -> String {
    tauri::async_runtime::spawn_blocking(pro_tools::ensure_rbwmanager_server)
        .await
        .unwrap()
}

#[tauri::command]
async fn pro_get_hosts() -> pro_tools::HostsData {
    tauri::async_runtime::spawn_blocking(pro_tools::load_hosts_data)
        .await
        .unwrap()
}

#[tauri::command]
async fn pro_save_hosts_raw(raw_content: String) -> Result<pro_tools::HostsData, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::write_hosts_content(&raw_content))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_add_host(ip: String, domain: String, comment: String) -> Result<pro_tools::HostsData, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::add_host_line(&ip, &domain, &comment))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_toggle_host(line_index: usize) -> Result<pro_tools::HostsData, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::toggle_host_line(line_index))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_delete_host(line_index: usize) -> Result<pro_tools::HostsData, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::delete_host_line(line_index))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_scan_images(site_name: String) -> Result<Vec<pro_tools::ProjectImageItem>, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::scan_project_images(&site_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_convert_webp(
    site_name: String,
    rel_paths: Vec<String>,
    quality: u8,
    replace_original: bool,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pro_tools::convert_project_images_webp(&site_name, rel_paths, quality, replace_original)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_trim_images(
    site_name: String,
    rel_paths: Vec<String>,
    tolerance: u8,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pro_tools::trim_project_images(&site_name, rel_paths, tolerance)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_undo_images(site_name: String, rel_paths: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::undo_project_images(&site_name, rel_paths))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_scan_media_ratios(site_name: String) -> Result<pro_tools::MediaScanReport, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::scan_media_ratios(&site_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_seed_sample_data(site_name: String, type_key: String, count: usize) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pro_tools::seed_project_sample_data(&site_name, &type_key, count)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_list_schemas(site_name: String) -> Result<Vec<pro_tools::SchemaFileInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::list_project_schema_files(&site_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_read_schema(site_name: String, rel_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pro_tools::read_project_schema_file(&site_name, &rel_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_save_schema(site_name: String, rel_path: String, content: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pro_tools::save_project_schema_file(&site_name, &rel_path, &content)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_scan_cache() -> Vec<pro_tools::CacheStatItem> {
    tauri::async_runtime::spawn_blocking(pro_tools::scan_projects_cache)
        .await
        .unwrap()
}

#[tauri::command]
async fn pro_clean_cache(site_name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::clean_project_cache(&site_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_check_ai_key(provider: String, api_key: String) -> Result<pro_tools::AiCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::check_ai_api_key(&provider, &api_key))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_scan_sync(site_name: String) -> Result<pro_tools::SyncCenterReport, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::scan_sync_center(&site_name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_sync_push(site_name: String, rel_paths: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::create_sync_snapshot(&site_name, rel_paths))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_restore_snapshot(site_name: String, backup_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::restore_sync_snapshot(&site_name, &backup_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pro_delete_snapshot(site_name: String, backup_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || pro_tools::delete_sync_snapshot(&site_name, &backup_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn rbw_pro_dispatch(req: rbw_pro_backend::ProDispatchRequest) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || rbw_pro_backend::dispatch(req))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rbw_pro_load_image(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || rbw_pro_backend::load_local_image_data_url(&url))
        .await
        .map_err(|e| e.to_string())?
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let header_i = MenuItem::with_id(app, "title", "⚡ RBWStudio v1.0.0", false, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "🖥️  Mở Bảng Điều Khiển (Dashboard)", true, None::<&str>)?;

    // Service controls
    let start_all_i = MenuItem::with_id(app, "start_all", "▶  Start All Services", true, None::<&str>)?;
    let stop_all_i = MenuItem::with_id(app, "stop_all", "■  Stop All Services", true, None::<&str>)?;
    let restart_all_i = MenuItem::with_id(app, "restart_all", "🔄 Khởi động lại tất cả", true, None::<&str>)?;

    // Individual service toggles
    let toggle_web_i = MenuItem::with_id(app, "toggle_web", "🌐 Web Server (Apache/Nginx)", true, None::<&str>)?;
    let toggle_php_i = MenuItem::with_id(app, "toggle_php", "🐘 PHP FastCGI Engine", true, None::<&str>)?;
    let toggle_mysql_i = MenuItem::with_id(app, "toggle_mysql", "🗄️ MySQL / MariaDB", true, None::<&str>)?;
    let svc_sub = Submenu::with_items(app, "⚙️ Dịch vụ riêng lẻ", true, &[&toggle_web_i, &toggle_php_i, &toggle_mysql_i])?;

    // Quick Web access
    let open_localhost_i = MenuItem::with_id(app, "open_localhost", "🌍 Mở Localhost", true, None::<&str>)?;
    let open_pma_i = MenuItem::with_id(app, "open_pma", "📊 Quản trị phpMyAdmin", true, None::<&str>)?;
    let open_www_i = MenuItem::with_id(app, "open_www", "📂 Mở Thư mục Root (www)", true, None::<&str>)?;

    // Config files shortcut
    let cfg_php_i = MenuItem::with_id(app, "cfg_php", "Sửa php.ini", true, None::<&str>)?;
    let cfg_web_i = MenuItem::with_id(app, "cfg_web", "Sửa httpd.conf / nginx.conf", true, None::<&str>)?;
    let cfg_my_i = MenuItem::with_id(app, "cfg_my", "Sửa my.ini", true, None::<&str>)?;
    let cfg_sub = Submenu::with_items(app, "📝 Chỉnh sửa Cấu hình nhanh", true, &[&cfg_php_i, &cfg_web_i, &cfg_my_i])?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "❌ Thoát hoàn toàn (Exit)", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &header_i,
            &show_i,
            &sep1,
            &start_all_i,
            &stop_all_i,
            &restart_all_i,
            &svc_sub,
            &sep2,
            &open_localhost_i,
            &open_pma_i,
            &open_www_i,
            &cfg_sub,
            &sep3,
            &quit_i,
        ],
    )?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("RBWStudio — Portable Web Server Manager")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
            "start_all" => {
                std::thread::spawn(|| {
                    let settings = config::load_app_settings();
                    let _ = services::start_php_service(&settings);
                    let _ = services::start_web_service(&settings);
                    let _ = services::start_mysql_service(&settings);
                });
            }
            "stop_all" => {
                std::thread::spawn(|| {
                    let _ = services::stop_web_service();
                    let _ = services::stop_php_service();
                    let _ = services::stop_mysql_service();
                });
            }
            "restart_all" => {
                std::thread::spawn(|| {
                    let settings = config::load_app_settings();
                    let _ = services::stop_web_service();
                    let _ = services::stop_php_service();
                    let _ = services::stop_mysql_service();
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    let _ = services::start_php_service(&settings);
                    let _ = services::start_web_service(&settings);
                    let _ = services::start_mysql_service(&settings);
                });
            }
            "toggle_web" => {
                std::thread::spawn(|| {
                    let settings = config::load_app_settings();
                    let st = services::get_service_status();
                    if st.web_running {
                        let _ = services::stop_web_service();
                    } else {
                        let _ = services::start_web_service(&settings);
                    }
                });
            }
            "toggle_php" => {
                std::thread::spawn(|| {
                    let settings = config::load_app_settings();
                    let st = services::get_service_status();
                    if st.php_running {
                        let _ = services::stop_php_service();
                    } else {
                        let _ = services::start_php_service(&settings);
                    }
                });
            }
            "toggle_mysql" => {
                std::thread::spawn(|| {
                    let settings = config::load_app_settings();
                    let st = services::get_service_status();
                    if st.mysql_running {
                        let _ = services::stop_mysql_service();
                    } else {
                        let _ = services::start_mysql_service(&settings);
                    }
                });
            }
            "open_localhost" => {
                let settings = config::load_app_settings();
                let port = settings.web_port;
                let port_suffix = if port == 80 { String::new() } else { format!(":{}", port) };
                let _ = sites::open_url_in_browser(&format!("http://localhost{}", port_suffix));
            }
            "open_pma" => {
                let settings = config::load_app_settings();
                let port = settings.web_port;
                let port_suffix = if port == 80 { String::new() } else { format!(":{}", port) };
                let _ = sites::open_url_in_browser(&format!("http://localhost{}/phpmyadmin/", port_suffix));
            }
            "open_www" => {
                let root = config::get_sites_root_dir();
                let _ = sites::open_in_file_manager(&root.to_string_lossy());
            }
            "cfg_php" => {
                if let Ok(path) = services::get_config_file_path("php") {
                    let _ = sites::open_in_file_manager(&path.to_string_lossy());
                }
            }
            "cfg_web" => {
                if let Ok(path) = services::get_config_file_path("web") {
                    let _ = sites::open_in_file_manager(&path.to_string_lossy());
                }
            }
            "cfg_my" => {
                if let Ok(path) = services::get_config_file_path("mysql") {
                    let _ = sites::open_in_file_manager(&path.to_string_lossy());
                }
            }
            "quit" => {
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    let _ = services::stop_web_service();
                    let _ = services::stop_php_service();
                    let _ = services::stop_mysql_service();
                    app_clone.exit(0);
                });
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Right,
                    button_state: MouseButtonState::Up,
                    position,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(tray_win) = app.get_webview_window("tray") {
                        if tray_win.is_visible().unwrap_or(false) {
                            let _ = tray_win.hide();
                        } else {
                            let factor = tray_win.scale_factor().unwrap_or(1.0);
                            let size = tray_win.outer_size().unwrap_or(tauri::PhysicalSize { width: (270.0 * factor) as u32, height: (420.0 * factor) as u32 });
                            let phys_w = size.width as f64;
                            let phys_h = size.height as f64;
                            let x = (position.x - (phys_w / 2.0)).max(10.0);
                            let y = (position.y - phys_h - 10.0).max(10.0);
                            let _ = tray_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                                x: x as i32,
                                y: y as i32,
                            }));
                            let _ = tray_win.show();
                            let _ = tray_win.set_focus();
                        }
                    }
                }
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(tray_win) = app.get_webview_window("tray") {
                        let _ = tray_win.hide();
                    }
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                }
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let _ = builder.build(app)?;
    Ok(())
}

fn main() {
    config::ensure_directories();
    let _ = db::init_database();
    services::create_default_index_if_empty();
    mail::start_smtp_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let _ = setup_tray(app.handle());
            color_picker::start_hotkey_listener(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "tray" {
                if let WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
            } else if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let settings = config::load_app_settings();
                    if settings.minimize_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        api.prevent_close();
                        let _ = window.hide();
                        let app_handle = window.app_handle().clone();
                        std::thread::spawn(move || {
                            let _ = services::stop_web_service();
                            let _ = services::stop_php_service();
                            let _ = services::stop_mysql_service();
                            app_handle.exit(0);
                        });
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_state,
            get_service_status,
            save_general_settings,
            toggle_service,
            switch_service_version,
            start_all_services,
            stop_all_services,
            read_service_config,
            save_service_config,
            get_sites,
            set_sites_root,
            set_site_engine,
            toggle_site_ssl,
            set_root_project,
            save_site_vhost,
            toggle_node_site,
            save_node_site_config,
            toggle_site_tunnel,
            open_folder,
            open_vscode,
            open_terminal,
            open_browser,
            get_emails,
            mark_email_read,
            delete_email,
            clear_emails,
            open_email_in_browser,
            scan_local_fonts,
            get_google_fonts,
            get_project_fonts,
            install_local_font,
            install_google_font,
            uninstall_project_font,
            get_deploy_data,
            start_deploy_demo,
            toggle_lock_demo,
            delete_demo_project,
            get_store_items,
            sync_online_store_versions,
            download_and_install_item,
            check_github_update,
            window_close_or_hide,
            window_toggle_maximize,
            show_main_window,
            exit_app,
            resize_tray_window,
            pro_get_manager_url,
            pro_get_hosts,
            pro_save_hosts_raw,
            pro_add_host,
            pro_toggle_host,
            pro_delete_host,
            pro_scan_images,
            pro_convert_webp,
            pro_trim_images,
            pro_undo_images,
            pro_scan_media_ratios,
            pro_seed_sample_data,
            pro_list_schemas,
            pro_read_schema,
            pro_save_schema,
            pro_scan_cache,
            pro_clean_cache,
            pro_check_ai_key,
            pro_scan_sync,
            pro_sync_push,
            pro_restore_snapshot,
            pro_delete_snapshot,
            rbw_pro_dispatch,
            rbw_pro_load_image,
            start_color_picker,
            get_color_picker_status
        ])
        .run(tauri::generate_context!())
        .expect("Lỗi khởi chạy ứng dụng RBWStudio");
}
