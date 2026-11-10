use crate::config;
use crate::services::{self, create_hidden_command};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployInitData {
    pub site_name: String,
    pub site_path: String,
    pub deploy_status: String,
    pub ssl_enabled: bool,
    pub db_naming_mode: i32,
    pub custom_db_suffix: String,
    pub local_db_name: String,
    pub target_db_name: String,
    pub target_url: String,
    pub config_ready: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeployLogEvent {
    pub message: String,
    pub progress: u8,
    pub done: bool,
    pub success: bool,
}

fn emit_log(app: &AppHandle, msg: &str, progress: u8, done: bool, success: bool) {
    let _ = app.emit(
        "deploy-log",
        DeployLogEvent {
            message: msg.to_string(),
            progress,
            done,
            success,
        },
    );
}

pub fn get_deploy_init_data(site_name: &str) -> DeployInitData {
    let demo_cfg = config::load_demo_config();
    let site_path = config::get_sites_root_dir().join(site_name);
    let status_map = config::load_string_map("demo_deploy_status.json");
    let ssl_map = config::load_bool_map("demo_ssl_config.json");
    let db_map = config::load_string_map("demo_db_config.json");

    let deploy_status = status_map
        .get(site_name)
        .cloned()
        .unwrap_or_else(|| "none".to_string());
    let ssl_enabled = *ssl_map.get(site_name).unwrap_or(&true);
    let custom_db_suffix = db_map.get(site_name).cloned().unwrap_or_default();

    let local_db_name = read_env_value(&site_path, "DB_DATABASE");
    let clean_proj: String = site_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>()
        .to_lowercase();

    let suffix = if demo_cfg.db_naming_mode == 1 && !custom_db_suffix.is_empty() {
        custom_db_suffix.clone()
    } else if clean_proj.len() > 8 {
        clean_proj[..8].to_string()
    } else {
        clean_proj
    };

    let da_prefix = if demo_cfg.da_user.is_empty() {
        "user".to_string()
    } else {
        demo_cfg.da_user.clone()
    };
    let target_db_name = format!("{}_{}", da_prefix, suffix);

    let scheme = if ssl_enabled { "https" } else { "http" };
    let domain = if demo_cfg.web_domain.is_empty() {
        "demo.example.com".to_string()
    } else {
        demo_cfg.web_domain
            .trim_start_matches("http://")
            .trim_start_matches("https://")
            .trim_end_matches('/')
            .to_string()
    };

    let target_url = format!("{}://{}/{}/", scheme, domain, site_name);
    let config_ready = !demo_cfg.ftp_host.is_empty()
        && !demo_cfg.ftp_user.is_empty()
        && !demo_cfg.ftp_pass.is_empty()
        && !demo_cfg.web_domain.is_empty();

    DeployInitData {
        site_name: site_name.to_string(),
        site_path: site_path.to_string_lossy().to_string(),
        deploy_status,
        ssl_enabled,
        db_naming_mode: demo_cfg.db_naming_mode,
        custom_db_suffix,
        local_db_name,
        target_db_name,
        target_url,
        config_ready,
    }
}

pub fn save_site_deploy_options(site_name: &str, ssl_enabled: bool, custom_db_suffix: &str) -> Result<(), String> {
    let mut ssl_map = config::load_bool_map("demo_ssl_config.json");
    ssl_map.insert(site_name.to_string(), ssl_enabled);
    config::save_bool_map("demo_ssl_config.json", &ssl_map)?;

    let mut db_map = config::load_string_map("demo_db_config.json");
    db_map.insert(site_name.to_string(), custom_db_suffix.trim().to_string());
    config::save_string_map("demo_db_config.json", &db_map)?;
    Ok(())
}

pub fn run_deploy_demo(
    app: AppHandle,
    site_name: String,
    ssl_enabled: bool,
    db_only: bool,
    custom_db_suffix: String,
) {
    std::thread::spawn(move || {
        let _ = save_site_deploy_options(&site_name, ssl_enabled, &custom_db_suffix);
        let demo_cfg = config::load_demo_config();
        if demo_cfg.ftp_host.is_empty() || demo_cfg.ftp_user.is_empty() || demo_cfg.web_domain.is_empty() {
            emit_log(
                &app,
                "❌ Lỗi: Chưa cấu hình thông tin FTP / Hosting trong mục General!",
                0,
                true,
                false,
            );
            return;
        }

        let init = get_deploy_init_data(&site_name);
        let site_path = PathBuf::from(&init.site_path);
        let tmp_dir = config::get_base_dir().join("tmp/deploy_work");
        let _ = fs::remove_dir_all(&tmp_dir);
        let _ = fs::create_dir_all(&tmp_dir);

        emit_log(
            &app,
            &format!("🚀 Bắt đầu tiến trình Deploy dự án '{}'...", site_name),
            5,
            false,
            false,
        );

        // 1. Export MySQL database if configured
        let sql_path = tmp_dir.join("database.sql");
        let has_db = !init.local_db_name.is_empty();
        if has_db {
            emit_log(
                &app,
                &format!("📦 Đang trích xuất Database local '{}'...", init.local_db_name),
                15,
                false,
                false,
            );
            if let Err(e) = dump_local_database(&init.local_db_name, &sql_path, ssl_enabled, &demo_cfg.web_domain, &site_name) {
                emit_log(&app, &format!("⚠️ Cảnh báo xuất DB: {}", e), 20, false, false);
            } else {
                emit_log(&app, "✅ Đã xuất file database.sql thành công.", 25, false, false);
            }
        }

        // 2. Create Zip archive
        let zip_path = tmp_dir.join("payload.zip");
        if db_only {
            emit_log(&app, "🗜️ Đang đóng gói dữ liệu Database (chế độ Chỉ cập nhật DB)...", 35, false, false);
            if let Ok(file) = File::create(&zip_path) {
                let mut zip = ZipWriter::new(file);
                if sql_path.exists() {
                    if let Ok(bytes) = fs::read(&sql_path) {
                        let _ = zip.start_file("database.sql", SimpleFileOptions::default());
                        let _ = zip.write_all(&bytes);
                    }
                }
                let _ = zip.finish();
            }
        } else {
            emit_log(&app, "🗜️ Đang nén mã nguồn dự án và cấu hình .env cho Hosting...", 35, false, false);
            if let Err(e) = create_project_zip(
                &site_path,
                &zip_path,
                &sql_path,
                &init.target_url,
                &site_name,
                &init.target_db_name,
            ) {
                emit_log(&app, &format!("❌ Lỗi khi nén dự án: {}", e), 40, true, false);
                return;
            }
            emit_log(&app, "✅ Đã đóng gói mã nguồn payload.zip hoàn tất.", 50, false, false);
        }

        // 3. DirectAdmin DB creation if needed
        if has_db && !demo_cfg.da_user.is_empty() {
            emit_log(
                &app,
                &format!("🗄️ Đang khởi tạo/đồng bộ Database '{}' trên DirectAdmin...", init.target_db_name),
                60,
                false,
                false,
            );
            let _ = ensure_directadmin_database(&demo_cfg, &init.target_db_name);
        }

        // 4. Generate bridge.php and upload via FTP
        let bridge_path = tmp_dir.join("bridge.php");
        let bridge_code = generate_bridge_php(&init.target_db_name, &demo_cfg.da_user, &demo_cfg.ftp_pass);
        let _ = fs::write(&bridge_path, bridge_code);

        emit_log(&app, "☁️ Đang tải gói dữ liệu lên Hosting qua FTP...", 75, false, false);
        if let Err(e) = ftp_upload_file(&demo_cfg, &site_name, &zip_path, "payload.zip") {
            emit_log(&app, &format!("❌ Lỗi tải lên payload.zip qua FTP: {}", e), 75, true, false);
            return;
        }
        if let Err(e) = ftp_upload_file(&demo_cfg, &site_name, &bridge_path, "bridge.php") {
            emit_log(&app, &format!("❌ Lỗi tải lên bridge.php qua FTP: {}", e), 80, true, false);
            return;
        }

        // 5. Trigger bridge.php via HTTP
        emit_log(&app, "⚙️ Đang kích hoạt giải nén & nạp Database trên Server...", 90, false, false);
        let action = if db_only { "deployDb" } else { "deploy" };
        let trigger_url = format!("{}bridge.php?action={}", init.target_url, action);
        if let Ok(client) = reqwest::blocking::Client::builder()
            .danger_accept_invalid_certs(true)
            .timeout(std::time::Duration::from_secs(60))
            .build()
        {
            match client.get(&trigger_url).send() {
                Ok(resp) => {
                    let body = resp.text().unwrap_or_default();
                    emit_log(&app, &format!("📡 Phản hồi từ Server: {}", body.trim()), 95, false, false);
                }
                Err(e) => {
                    emit_log(&app, &format!("⚠️ Cảnh báo gọi bridge.php: {}", e), 95, false, false);
                }
            }
        }

        // Cleanup bridge
        let clean_url = format!("{}bridge.php?action=cleanup", init.target_url);
        if let Ok(client) = reqwest::blocking::Client::builder()
            .danger_accept_invalid_certs(true)
            .timeout(std::time::Duration::from_secs(10))
            .build()
        {
            let _ = client.get(&clean_url).send();
        }

        let mut status_map = config::load_string_map("demo_deploy_status.json");
        status_map.insert(site_name.clone(), "deployed".to_string());
        let _ = config::save_string_map("demo_deploy_status.json", &status_map);

        emit_log(
            &app,
            &format!("🎉 HOÀN TẤT! Dự án đã sẵn sàng tại: {}", init.target_url),
            100,
            true,
            true,
        );
    });
}

pub fn toggle_lock_demo(app: AppHandle, site_name: String) {
    std::thread::spawn(move || {
        let demo_cfg = config::load_demo_config();
        let mut status_map = config::load_string_map("demo_deploy_status.json");
        let current = status_map.get(&site_name).cloned().unwrap_or_else(|| "deployed".to_string());
        let locking = current != "locked";

        emit_log(
            &app,
            if locking {
                "🔒 Đang khóa trang Demo trên Hosting..."
            } else {
                "🔓 Đang mở khóa trang Demo trên Hosting..."
            },
            40,
            false,
            false,
        );

        let tmp_dir = config::get_base_dir().join("tmp/deploy_work");
        let _ = fs::create_dir_all(&tmp_dir);
        let htaccess_local = tmp_dir.join(".htaccess_lock");

        if locking {
            let lock_content = r#"RewriteEngine On
RewriteCond %{REQUEST_URI} !^/503\.php$
RewriteRule ^(.*)$ - [R=503,L]
ErrorDocument 503 "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Locked</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;color:#1f2937}.box{background:#fff;padding:32px;border-radius:12px;border:1px solid #e5e7eb;text-align:center}</style></head><body><div class='box'><h2>🔒 Dự án Demo đang tạm khóa</h2><p>Vui lòng liên hệ quản trị viên để mở khóa truy cập.</p></div></body></html>"
"#;
            let _ = fs::write(&htaccess_local, lock_content);
        } else {
            let site_htaccess = config::get_sites_root_dir().join(&site_name).join(".htaccess");
            if site_htaccess.exists() {
                let _ = fs::copy(&site_htaccess, &htaccess_local);
            } else {
                let _ = fs::write(&htaccess_local, "RewriteEngine On\n");
            }
        }

        match ftp_upload_file(&demo_cfg, &site_name, &htaccess_local, ".htaccess") {
            Ok(_) => {
                let next_state = if locking { "locked" } else { "deployed" };
                status_map.insert(site_name, next_state.to_string());
                let _ = config::save_string_map("demo_deploy_status.json", &status_map);
                emit_log(
                    &app,
                    if locking {
                        "✅ Đã khóa trang Demo thành công."
                    } else {
                        "✅ Đã mở khóa trang Demo thành công."
                    },
                    100,
                    true,
                    true,
                );
            }
            Err(e) => {
                emit_log(&app, &format!("❌ Lỗi FTP: {}", e), 100, true, false);
            }
        }
    });
}

pub fn delete_demo_project(app: AppHandle, site_name: String) {
    std::thread::spawn(move || {
        let demo_cfg = config::load_demo_config();
        let init = get_deploy_init_data(&site_name);
        emit_log(&app, "🗑️ Đang xóa dữ liệu Demo và Database trên Hosting...", 35, false, false);

        let tmp_dir = config::get_base_dir().join("tmp/deploy_work");
        let _ = fs::create_dir_all(&tmp_dir);
        let bridge_path = tmp_dir.join("bridge.php");
        let bridge_code = generate_bridge_php(&init.target_db_name, &demo_cfg.da_user, &demo_cfg.ftp_pass);
        let _ = fs::write(&bridge_path, bridge_code);

        if let Ok(_) = ftp_upload_file(&demo_cfg, &site_name, &bridge_path, "bridge.php") {
            let url = format!("{}bridge.php?action=destroyAll", init.target_url);
            if let Ok(client) = reqwest::blocking::Client::builder()
                .danger_accept_invalid_certs(true)
                .timeout(std::time::Duration::from_secs(25))
                .build()
            {
                let _ = client.get(&url).send();
            }
        }

        let mut status_map = config::load_string_map("demo_deploy_status.json");
        status_map.insert(site_name, "none".to_string());
        let _ = config::save_string_map("demo_deploy_status.json", &status_map);

        emit_log(&app, "✅ Đã gỡ bỏ hoàn toàn bản Demo khỏi Hosting.", 100, true, true);
    });
}

fn read_env_value(site_path: &Path, key: &str) -> String {
    let env_path = site_path.join(".env");
    if let Ok(content) = fs::read_to_string(env_path) {
        for line in content.lines() {
            let t = line.trim();
            if t.starts_with(&format!("{}=", key)) {
                return t[key.len() + 1..]
                    .trim()
                    .trim_matches('\'')
                    .trim_matches('"')
                    .to_string();
            }
        }
    }
    String::new()
}

fn dump_local_database(
    db_name: &str,
    out_sql: &Path,
    ssl: bool,
    web_domain: &str,
    site_name: &str,
) -> Result<(), String> {
    let settings = config::load_app_settings();
    let base = config::get_base_dir();
    let mysql_vers = services::list_installed_versions("mysql");
    let ver = if !settings.active_mysql_version.is_empty() {
        settings.active_mysql_version
    } else {
        mysql_vers.first().cloned().unwrap_or_default()
    };

    if ver.is_empty() {
        return Err("Không tìm thấy MySQL để chạy mysqldump.".to_string());
    }

    let mysql_dir = base.join("bin/mysql").join(ver);
    let dump_exe = services::find_executable_recursive(&mysql_dir, &["mysqldump.exe", "mariadb-dump.exe", "mysqldump", "mariadb-dump"])
        .ok_or_else(|| "Không tìm thấy công cụ mysqldump.".to_string())?;

    let output = create_hidden_command(&dump_exe.to_string_lossy())
        .args([
            "-h",
            "127.0.0.1",
            "-P",
            &settings.mysql_port.to_string(),
            "-u",
            "root",
            "--routines",
            "--triggers",
            db_name,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let mut sql = String::from_utf8_lossy(&output.stdout).to_string();
    sql = sql
        .replace("utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci")
        .replace("utf8mb4_0900_as_cs", "utf8mb4_unicode_ci");

    let scheme = if ssl { "https" } else { "http" };
    let clean_dom = web_domain
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/');
    let remote_base = format!("{}://{}/{}", scheme, clean_dom, site_name);
    sql = sql.replace(&format!("http://localhost/{}", site_name), &remote_base);

    fs::write(out_sql, sql).map_err(|e| e.to_string())
}

fn create_project_zip(
    site_path: &Path,
    zip_path: &Path,
    sql_path: &Path,
    target_url: &str,
    site_name: &str,
    target_db: &str,
) -> Result<(), String> {
    let demo_cfg = config::load_demo_config();
    let file = File::create(zip_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    add_dir_to_zip(
        &mut zip,
        site_path,
        site_path,
        options,
        target_url,
        site_name,
        target_db,
        &demo_cfg,
    )?;

    if sql_path.exists() {
        if let Ok(bytes) = fs::read(sql_path) {
            zip.start_file("database.sql", options).map_err(|e| e.to_string())?;
            zip.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    root: &Path,
    current: &Path,
    options: SimpleFileOptions,
    target_url: &str,
    site_name: &str,
    target_db: &str,
    demo_cfg: &config::DemoGlobalConfig,
) -> Result<(), String> {
    let entries = fs::read_dir(current).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if matches!(name.as_str(), ".git" | "node_modules" | ".vscode" | ".idea") {
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            add_dir_to_zip(zip, root, &path, options, target_url, site_name, target_db, demo_cfg)?;
        } else if name == ".env" {
            if let Ok(content) = fs::read_to_string(&path) {
                let mut modified = Vec::new();
                for line in content.lines() {
                    let t = line.trim();
                    if t.starts_with("APP_URL=") {
                        modified.push(format!("APP_URL={}", target_url.trim_end_matches('/')));
                    } else if t.starts_with("SITE_PATH=") {
                        modified.push(format!("SITE_PATH='/{}/'", site_name));
                    } else if t.starts_with("DB_DATABASE=") {
                        modified.push(format!("DB_DATABASE={}", target_db));
                    } else if t.starts_with("DB_USERNAME=") {
                        modified.push(format!("DB_USERNAME={}", target_db));
                    } else if t.starts_with("DB_PASSWORD=") {
                        modified.push(format!("DB_PASSWORD='{}'", demo_cfg.ftp_pass));
                    } else {
                        modified.push(line.to_string());
                    }
                }
                zip.start_file(&rel, options).map_err(|e| e.to_string())?;
                zip.write_all(modified.join("\n").as_bytes()).map_err(|e| e.to_string())?;
            }
        } else {
            let mut f = File::open(&path).map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            zip.start_file(&rel, options).map_err(|e| e.to_string())?;
            zip.write_all(&buf).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn ensure_directadmin_database(cfg: &config::DemoGlobalConfig, full_db_name: &str) -> Result<(), String> {
    let prefix = format!("{}_", cfg.da_user);
    let short_name = full_db_name.strip_prefix(&prefix).unwrap_or(full_db_name);

    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let mut params = std::collections::HashMap::new();
    params.insert("action", "create");
    params.insert("name", short_name);
    params.insert("user", short_name);
    params.insert("passwd", &cfg.ftp_pass);
    params.insert("passwd2", &cfg.ftp_pass);

    for scheme in ["https", "http"] {
        let url = format!("{}://{}:{}/CMD_API_DATABASES", scheme, cfg.ftp_host, cfg.da_port);
        if let Ok(resp) = client
            .post(&url)
            .basic_auth(&cfg.da_user, Some(&cfg.ftp_pass))
            .form(&params)
            .send()
        {
            if resp.status().is_success() {
                return Ok(());
            }
        }
    }
    Ok(())
}

pub fn ftp_upload_file(
    cfg: &config::DemoGlobalConfig,
    site_name: &str,
    local_file: &Path,
    remote_filename: &str,
) -> Result<(), String> {
    let clean_domain = cfg
        .web_domain
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/');
    let root_path = cfg.ftp_root_path.replace("{domain}", clean_domain);
    let remote_url = format!(
        "ftp://{}{}/{}/{}",
        cfg.ftp_host,
        root_path.trim_end_matches('/'),
        site_name,
        remote_filename
    );

    let output = create_hidden_command("curl")
        .args([
            "-s",
            "-S",
            "--ftp-create-dirs",
            "-u",
            &format!("{}:{}", cfg.ftp_user, cfg.ftp_pass),
            "-T",
            &local_file.to_string_lossy(),
            &remote_url,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

fn generate_bridge_php(db_name: &str, _da_user: &str, db_pass: &str) -> String {
    format!(
        r#"<?php
error_reporting(0);
set_time_limit(300);
$action = $_GET['action'] ?? 'deploy';
$dbHost = 'localhost';
$dbName = '{db_name}';
$dbUser = '{db_name}';
$dbPass = '{db_pass}';

if ($action === 'deploy' && file_exists('payload.zip')) {{
    $zip = new ZipArchive();
    if ($zip->open('payload.zip') === TRUE) {{
        $zip->extractTo(__DIR__);
        $zip->close();
        @unlink('payload.zip');
        echo "Unzipped OK. ";
    }}
}}

if (($action === 'deploy' || $action === 'deployDb') && file_exists('database.sql')) {{
    if ($action === 'deployDb' && file_exists('payload.zip')) {{
        $zip = new ZipArchive();
        if ($zip->open('payload.zip') === TRUE) {{
            $zip->extractTo(__DIR__);
            $zip->close();
            @unlink('payload.zip');
        }}
    }}
    $mysqli = @new mysqli($dbHost, $dbUser, $dbPass, $dbName);
    if (!$mysqli->connect_errno) {{
        $mysqli->set_charset("utf8mb4");
        $sql = file_get_contents('database.sql');
        $mysqli->multi_query($sql);
        do {{
            if ($res = $mysqli->store_result()) {{ $res->free(); }}
        }} while ($mysqli->more_results() && $mysqli->next_result());
        $mysqli->close();
        @unlink('database.sql');
        echo "DB Imported OK.";
    }} else {{
        echo "DB Connect Error: " . $mysqli->connect_error;
    }}
}}

if ($action === 'cleanup') {{
    @unlink('payload.zip');
    @unlink('database.sql');
    @unlink(__FILE__);
    echo "Cleaned.";
}}

if ($action === 'destroyAll') {{
    @unlink(__FILE__);
    echo "Removed.";
}}
"#
    )
}

