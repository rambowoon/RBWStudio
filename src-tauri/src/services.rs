use crate::config::{self, AppSettings};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatus {
    pub web_server_type: String,
    pub web_running: bool,
    pub php_running: bool,
    pub mysql_running: bool,
    pub mail_running: bool,
    pub active_php: String,
    pub active_apache: String,
    pub active_nginx: String,
    pub active_mysql: String,
    pub php_versions: Vec<String>,
    pub apache_versions: Vec<String>,
    pub nginx_versions: Vec<String>,
    pub mysql_versions: Vec<String>,
    pub node_versions: Vec<String>,
    pub phpmyadmin_installed: bool,
    pub cloudflared_installed: bool,
    pub www_root: String,
}

pub struct ProcessManager {
    pub web_child: Option<Child>,
    pub php_children: HashMap<u16, Child>,
    pub mysql_child: Option<Child>,
    pub node_children: HashMap<String, Child>,
    pub tunnel_children: HashMap<String, Child>,
    pub tunnel_urls: HashMap<String, String>,
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self {
            web_child: None,
            php_children: HashMap::new(),
            mysql_child: None,
            node_children: HashMap::new(),
            tunnel_children: HashMap::new(),
            tunnel_urls: HashMap::new(),
        }
    }
}

pub static PROCESS_MANAGER: Mutex<Option<ProcessManager>> = Mutex::new(None);

pub fn with_pm<F, R>(f: F) -> R
where
    F: FnOnce(&mut ProcessManager) -> R,
{
    let mut guard = PROCESS_MANAGER.lock().unwrap();
    if guard.is_none() {
        *guard = Some(ProcessManager::default());
    }
    f(guard.as_mut().unwrap())
}

pub fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

pub fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(25),
    )
    .is_ok()
}

pub fn list_installed_versions(category: &str) -> Vec<String> {
    let dir = config::get_base_dir().join("bin").join(category);
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    list.push(name.to_string());
                }
            }
        }
    }
    list.sort();
    list
}

pub fn is_phpmyadmin_installed() -> bool {
    let pma = config::get_base_dir().join("phpmyadmin").join("index.php");
    pma.exists()
}

pub fn is_cloudflared_installed() -> bool {
    let base = config::get_base_dir().join("bin").join("cloudflared");
    #[cfg(target_os = "windows")]
    let bin = base.join("cloudflared.exe");
    #[cfg(not(target_os = "windows"))]
    let bin = base.join("cloudflared");
    bin.exists()
}

pub fn get_service_status() -> ServiceStatus {
    let mut settings = config::load_app_settings();
    let php_versions = list_installed_versions("php");
    let apache_versions = list_installed_versions("apache");
    let nginx_versions = list_installed_versions("nginx");
    let mysql_versions = list_installed_versions("mysql");
    let node_versions = list_installed_versions("nodejs");

    if settings.active_php_version.is_empty() && !php_versions.is_empty() {
        settings.active_php_version = php_versions.last().unwrap().clone();
    }
    if settings.active_apache_version.is_empty() && !apache_versions.is_empty() {
        settings.active_apache_version = apache_versions.last().unwrap().clone();
    }
    if settings.active_nginx_version.is_empty() && !nginx_versions.is_empty() {
        settings.active_nginx_version = nginx_versions.last().unwrap().clone();
    }
    if settings.active_mysql_version.is_empty() && !mysql_versions.is_empty() {
        settings.active_mysql_version = mysql_versions.last().unwrap().clone();
    }

    let port_web = settings.web_port;
    let port_php = settings.php_cgi_port;
    let port_mysql = settings.mysql_port;
    let (web_running, php_running, mysql_running, mail_running) = std::thread::scope(|s| {
        let h_web = s.spawn(move || is_port_in_use(port_web));
        let h_php = s.spawn(move || is_port_in_use(port_php));
        let h_mysql = s.spawn(move || is_port_in_use(port_mysql));
        let h_mail = s.spawn(|| is_port_in_use(1025));
        (
            h_web.join().unwrap_or(false),
            h_php.join().unwrap_or(false),
            h_mysql.join().unwrap_or(false),
            h_mail.join().unwrap_or(false),
        )
    });

    ServiceStatus {
        web_server_type: settings.default_web_server.clone(),
        web_running,
        php_running,
        mysql_running,
        mail_running,
        active_php: settings.active_php_version,
        active_apache: settings.active_apache_version,
        active_nginx: settings.active_nginx_version,
        active_mysql: settings.active_mysql_version,
        php_versions,
        apache_versions,
        nginx_versions,
        mysql_versions,
        node_versions,
        phpmyadmin_installed: is_phpmyadmin_installed(),
        cloudflared_installed: is_cloudflared_installed(),
        www_root: config::get_www_base_dir().to_string_lossy().to_string(),
    }
}

pub fn find_executable_recursive(dir: &Path, exe_names: &[&str]) -> Option<PathBuf> {
    if !dir.exists() {
        return None;
    }
    for name in exe_names {
        let direct = dir.join(name);
        if direct.exists() {
            return Some(direct);
        }
        let bin_sub = dir.join("bin").join(name);
        if bin_sub.exists() {
            return Some(bin_sub);
        }
        let sbin_sub = dir.join("sbin").join(name);
        if sbin_sub.exists() {
            return Some(sbin_sub);
        }
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                if let Some(found) = find_executable_recursive(&p, exe_names) {
                    return Some(found);
                }
            }
        }
    }
    None
}

pub fn get_site_php_port(php_version: &str, settings: &AppSettings) -> u16 {
    let versions = list_installed_versions("php");
    if php_version.is_empty()
        || php_version == "Mặc định (Default)"
        || php_version.eq_ignore_ascii_case(&settings.active_php_version)
    {
        return settings.php_cgi_port;
    }
    if let Some(idx) = versions.iter().position(|v| v == php_version) {
        return settings.php_cgi_port + 1 + (idx as u16);
    }
    settings.php_cgi_port
}

fn extract_php_major_minor(php_dir: &Path) -> Option<(String, String)> {
    let dir_name = php_dir.file_name()?.to_string_lossy();
    let rest = dir_name.strip_prefix("php-").unwrap_or(&dir_name);
    let mut parts = rest.split('.');
    let major = parts.next()?.trim();
    let minor = parts.next()?.trim();
    if major.chars().all(|c| c.is_ascii_digit()) && minor.chars().all(|c| c.is_ascii_digit()) {
        Some((major.to_string(), minor.to_string()))
    } else {
        None
    }
}

fn ioncube_zip_name_for_php(major: &str, minor: &str) -> Option<&'static str> {
    #[cfg(target_os = "windows")]
    {
        match (major, minor) {
            ("5", "6") => Some("ioncube_loaders_win_vc11_x86-64.zip"),
            ("7", "0") | ("7", "1") => Some("ioncube_loaders_win_vc14_x86-64.zip"),
            ("7", "2") | ("7", "3") | ("7", "4") => Some("ioncube_loaders_win_vc15_x86-64.zip"),
            ("8", "1") | ("8", "2") | ("8", "3") => Some("ioncube_loaders_win_vc16_x86-64.zip"),
            ("8", "4") | ("8", "5") | ("8", "6") => Some("ioncube_loaders_win_vc17_x86-64.zip"),
            _ => None,
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = (major, minor);
        if cfg!(target_arch = "aarch64") {
            Some("ioncube_loaders_mac_arm64.zip")
        } else {
            Some("ioncube_loaders_mac_x86-64.zip")
        }
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let _ = (major, minor);
        Some("ioncube_loaders_lin_x86-64.zip")
    }
}

fn ensure_ioncube_binary(php_dir: &Path, base: &Path) -> Option<PathBuf> {
    let (major, minor) = extract_php_major_minor(php_dir)?;
    #[cfg(target_os = "windows")]
    let loader_name = format!("ioncube_loader_win_{}.{}.dll", major, minor);
    #[cfg(target_os = "macos")]
    let loader_name = format!("ioncube_loader_dar_{}.{}.so", major, minor);
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let loader_name = format!("ioncube_loader_lin_{}.{}.so", major, minor);

    let ext_dir = php_dir.join("ext");
    let _ = fs::create_dir_all(&ext_dir);
    let target_loader = ext_dir.join(&loader_name);
    if target_loader.exists() {
        return Some(target_loader);
    }

    let zip_name = ioncube_zip_name_for_php(&major, &minor)?;
    let dl_dir = base.join("downloads");
    let _ = fs::create_dir_all(&dl_dir);
    let zip_path = dl_dir.join(zip_name);

    if !zip_path.exists() {
        let url = format!("https://downloads.ioncube.com/loader_downloads/{}", zip_name);
        if let Ok(client) = reqwest::blocking::Client::builder()
            .user_agent("RBWStudio/1.0")
            .timeout(Duration::from_secs(20))
            .build()
        {
            if let Ok(mut resp) = client.get(&url).send() {
                if resp.status().is_success() {
                    let tmp_part = dl_dir.join(format!("{}.part", zip_name));
                    if let Ok(mut f) = fs::File::create(&tmp_part) {
                        if std::io::copy(&mut resp, &mut f).is_ok() {
                            let _ = fs::rename(&tmp_part, &zip_path);
                        } else {
                            let _ = fs::remove_file(&tmp_part);
                        }
                    }
                }
            }
        }
    }

    if !zip_path.exists() {
        return None;
    }

    let file = fs::File::open(&zip_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).ok()?;
        let entry_name = entry.name().replace('\\', "/");
        if entry_name.ends_with(&format!("/{}", loader_name)) || entry_name == loader_name {
            let mut out = fs::File::create(&target_loader).ok()?;
            std::io::copy(&mut entry, &mut out).ok()?;
            return Some(target_loader);
        }
    }
    None
}

fn ensure_ioncube_in_php_ini(php_dir: &Path, base: &Path, content: &mut String) -> bool {
    let has_ioncube = content.lines().any(|line| {
        let trimmed = line.trim();
        !trimmed.starts_with(';')
            && trimmed.to_ascii_lowercase().contains("zend_extension")
            && trimmed.to_ascii_lowercase().contains("ioncube")
    });
    if has_ioncube {
        return false;
    }

    let loader_path = match ensure_ioncube_binary(php_dir, base) {
        Some(p) => p,
        None => return false,
    };

    let loader_fwd = loader_path.to_string_lossy().replace('\\', "/");
    let zend_line = format!("zend_extension = \"{}\"", loader_fwd);

    if let Some(pos) = content.find("[PHP]") {
        let after_section = pos + "[PHP]".len();
        let rest = &content[after_section..];
        let newline = if rest.starts_with("\r\n") {
            "\r\n"
        } else {
            "\n"
        };
        let insert_pos = if rest.starts_with("\r\n") {
            after_section + 2
        } else if rest.starts_with('\n') {
            after_section + 1
        } else {
            after_section
        };
        content.insert_str(insert_pos, &format!("{}{}", zend_line, newline));
    } else {
        *content = format!("{}\n{}", zend_line, content);
    }
    true
}

pub fn configure_php(php_dir: &Path) {
    let base = config::get_base_dir();
    let ini_path = php_dir.join("php.ini");
    if !ini_path.exists() {
        let dev = php_dir.join("php.ini-development");
        let prod = php_dir.join("php.ini-production");
        if dev.exists() {
            let _ = fs::copy(&dev, &ini_path);
        } else if prod.exists() {
            let _ = fs::copy(&prod, &ini_path);
        } else {
            let _ = fs::write(&ini_path, "[PHP]\n");
        }
    }

    if let Ok(mut content) = fs::read_to_string(&ini_path) {
        let mut ini_changed = false;
        let ext_dir = php_dir.join("ext").to_string_lossy().replace('\\', "/");
        let tmp_sessions = base.join("tmp/sessions").to_string_lossy().replace('\\', "/");
        let tmp_uploads = base.join("tmp/uploads").to_string_lossy().replace('\\', "/");

        if !content.contains("; RBWStack Auto Config") {
            content = content.replace(";extension_dir = \"ext\"", &format!("extension_dir = \"{}\"", ext_dir));
            let exts = [
                "curl", "fileinfo", "gd", "gd2", "intl", "mbstring", "exif", "mysqli", "openssl",
                "pdo_mysql", "pdo_sqlite", "soap", "sockets", "sodium", "sqlite3", "tidy", "xsl", "zip",
            ];
            for ext in exts {
                content = content.replace(&format!(";extension={}", ext), &format!("extension={}", ext));
                content = content.replace(&format!(";extension=php_{}.dll", ext), &format!("extension=php_{}.dll", ext));
            }

            let settings = config::load_app_settings();
            let mut custom_block = format!(
                "\n; RBWStack Auto Config\nextension_dir = \"{}\"\nsession.save_path = \"{}\"\nupload_tmp_dir = \"{}\"\nsendmail_from = \"admin@rbwstack.local\"\nSMTP = 127.0.0.1\nsmtp_port = 1025\ndisplay_errors = Off\nlog_errors = On\ndate.timezone = Asia/Ho_Chi_Minh\n",
                ext_dir, tmp_sessions, tmp_uploads
            );

            if settings.auto_optimize_php {
                custom_block.push_str(
                    "upload_max_filesize = 2048M\npost_max_size = 2048M\nmemory_limit = 1024M\nmax_execution_time = 0\nmax_input_time = -1\nmax_input_vars = 5000\nsession.gc_maxlifetime = 2592000\nsession.cookie_lifetime = 2592000\n",
                );
            }

            content.push_str(&custom_block);
            ini_changed = true;
        }

        if ensure_ioncube_in_php_ini(php_dir, &base, &mut content) {
            ini_changed = true;
        }

        if ini_changed {
            let _ = fs::write(&ini_path, content);
        }
    }
}

pub fn configure_mysql(mysql_dir: &Path, mysql_port: u16) {
    let my_ini_path = mysql_dir.join("my.ini");
    let mysql_dir_fwd = mysql_dir.to_string_lossy().replace('\\', "/");
    let raw_ini = format!(
        r#"[mysqld]
port = {port}
basedir = "{dir}"
datadir = "{dir}/data"
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
default-storage-engine = INNODB
max_allowed_packet = 64M
innodb_log_file_size = 50M

[mysql]
default-character-set = utf8mb4

[client]
port = {port}
default-character-set = utf8mb4
"#,
        port = mysql_port,
        dir = mysql_dir_fwd
    );

    let _ = fs::write(&my_ini_path, raw_ini);

    let data_dir = mysql_dir.join("data");
    if !data_dir.exists() {
        let _ = fs::create_dir_all(&data_dir);
        if let Some(init_exe) = find_executable_recursive(
            mysql_dir,
            &["mysql_install_db.exe", "mariadb-install-db.exe", "mysql_install_db"],
        ) {
            let _ = create_hidden_command(&init_exe.to_string_lossy())
                .arg(format!("--datadir={}", data_dir.to_string_lossy()))
                .output();
        }
    }
}

pub fn configure_phpmyadmin(mysql_port: u16) {
    let pma_dir = config::get_base_dir().join("phpmyadmin");
    if !pma_dir.exists() {
        let _ = fs::create_dir_all(&pma_dir);
    }
    let config_real = pma_dir.join("config.inc.php");
    let content = format!(
        r#"<?php
declare(strict_types=1);

$cfg['blowfish_secret'] = 'RBWStack@LocalDev#2024!SecureK32';

$i = 0;
$i++;

$cfg['Servers'][$i]['auth_type']       = 'config';
$cfg['Servers'][$i]['user']            = 'root';
$cfg['Servers'][$i]['password']        = '';
$cfg['Servers'][$i]['host']            = '127.0.0.1';
$cfg['Servers'][$i]['port']            = '{port}';
$cfg['Servers'][$i]['compress']        = false;
$cfg['Servers'][$i]['AllowNoPassword'] = true;
$cfg['Servers'][$i]['AllowRoot']       = true;

$cfg['ForceSSL'] = false;

ini_set('session.cookie_secure', '0');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.cookie_lifetime', '2592000');
ini_set('session.gc_maxlifetime', '2592000');

$cfg['LoginCookieValidity'] = 2592000;
$cfg['LoginCookieStore'] = 2592000;

$sessionPath = __DIR__ . '/../tmp/sessions';
if (!is_dir($sessionPath)) {{
    @mkdir($sessionPath, 0777, true);
}}
ini_set('session.save_path', $sessionPath);

$cfg['UploadDir'] = '';
$cfg['SaveDir']   = '';
$cfg['CheckConfigurationPermissions'] = false;
$cfg['DefaultLang']                   = 'en';
$cfg['SendErrorReports']              = 'never';
"#,
        port = mysql_port
    );
    let _ = fs::write(config_real, content);
}

pub fn start_all_services_fast(settings: &AppSettings) {
    let settings_clone = settings.clone();
    let php_handle = std::thread::spawn(move || {
        let _ = start_php_service(&settings_clone);
    });

    let settings_clone2 = settings.clone();
    let mysql_handle = std::thread::spawn(move || {
        let _ = start_mysql_service(&settings_clone2);
    });

    let settings_clone3 = settings.clone();
    let web_handle = std::thread::spawn(move || {
        let _ = start_web_service(&settings_clone3);
    });

    let _ = php_handle.join();
    let _ = mysql_handle.join();
    let _ = web_handle.join();
}

pub fn ensure_ssl_cert(domain: &str) -> (PathBuf, PathBuf) {
    let ssl_dir = if domain == "localhost" {
        config::get_base_dir().join("ssl")
    } else {
        config::get_base_dir().join("ssl/domains")
    };
    let _ = fs::create_dir_all(&ssl_dir);
    let crt_path = ssl_dir.join(format!("{}.crt", domain));
    let key_path = ssl_dir.join(format!("{}.key", domain));

    if !crt_path.exists() || !key_path.exists() {
        let subject_alt_names = vec![
            domain.to_string(),
            format!("*.{}", domain),
            "localhost".to_string(),
            "127.0.0.1".to_string(),
        ];
        if let Ok(cert) = rcgen::generate_simple_self_signed(subject_alt_names) {
            let _ = fs::write(&crt_path, cert.cert.pem());
            let _ = fs::write(&key_path, cert.key_pair.serialize_pem());
            trust_ssl_certificate(&crt_path);
        }
    }
    (crt_path, key_path)
}

pub fn trust_ssl_certificate(crt_path: &Path) {
    #[cfg(target_os = "windows")]
    {
        let _ = create_hidden_command("certutil")
            .args(["-user", "-addstore", "Root", &crt_path.to_string_lossy()])
            .output();
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let login_keychain = home.join("Library/Keychains/login.keychain-db");
            let _ = Command::new("security")
                .args([
                    "add-trusted-cert",
                    "-r",
                    "trustRoot",
                    "-k",
                    &login_keychain.to_string_lossy(),
                    &crt_path.to_string_lossy(),
                ])
                .output();
        }
    }
}

pub fn generate_vhosts_configs(settings: &AppSettings) {
    let base = config::get_base_dir();
    let sites_root = config::get_sites_root_dir();
    let www_base = config::get_www_base_dir();
    let root_project = config::load_text_file("root_project.txt");
    let doc_root = if !root_project.is_empty() && sites_root.join(&root_project).exists() {
        sites_root.join(&root_project)
    } else if !root_project.is_empty() && www_base.join(&root_project).exists() {
        www_base.join(&root_project)
    } else {
        www_base.clone()
    };

    let (localhost_crt, localhost_key) = ensure_ssl_cert("localhost");
    let ssl_crt_str = localhost_crt.to_string_lossy().replace('\\', "/");
    let ssl_key_str = localhost_key.to_string_lossy().replace('\\', "/");

    let vhosts_map = config::load_string_map("sites_vhosts.json");
    let ssl_map = config::load_bool_map("ssl.json");
    let site_php_map = config::load_string_map("sites.json");
    let pma_dir = base.join("phpmyadmin").to_string_lossy().replace('\\', "/");
    let doc_root_str = doc_root.to_string_lossy().replace('\\', "/");
    let sites_root_str = www_base.to_string_lossy().replace('\\', "/");

    let php_versions = list_installed_versions("php");
    let active_php_ver = if !settings.active_php_version.is_empty() {
        settings.active_php_version.clone()
    } else {
        php_versions.last().cloned().unwrap_or_default()
    };
    let active_php_dir = base
        .join("bin/php")
        .join(&active_php_ver)
        .to_string_lossy()
        .replace('\\', "/");

    let root_php_port = if !root_project.is_empty() {
        if let Some(ver) = site_php_map.get(&root_project) {
            get_site_php_port(ver, settings)
        } else {
            settings.php_cgi_port
        }
    } else {
        settings.php_cgi_port
    };

    // 1. Configure Nginx
    for ver in list_installed_versions("nginx") {
        let nginx_dir = base.join("bin/nginx").join(&ver);
        let conf_dir = nginx_dir.join("conf");
        let _ = fs::create_dir_all(&conf_dir);

        let mut custom_locations = String::new();
        for (site_name, php_ver) in &site_php_map {
            if php_ver == "Node.js" {
                continue;
            }
            let php_port = get_site_php_port(php_ver, settings);
            let mut paths_to_add = Vec::new();
            let direct_dir = www_base.join(site_name);
            if direct_dir.is_dir() {
                paths_to_add.push((site_name.clone(), direct_dir.to_string_lossy().replace('\\', "/")));
            }
            if let Ok(entries) = fs::read_dir(&www_base) {
                for entry in entries.flatten() {
                    let ep = entry.path();
                    if ep.is_dir() {
                        let sub_p = ep.join(site_name);
                        if sub_p.is_dir() {
                            let month_name = entry.file_name().to_string_lossy().to_string();
                            let loc_uri = format!("{}/{}", month_name, site_name);
                            let fs_dir = sub_p.to_string_lossy().replace('\\', "/");
                            if !paths_to_add.iter().any(|(l, _)| l == &loc_uri) {
                                paths_to_add.push((loc_uri, fs_dir));
                            }
                        }
                    }
                }
            }
            if paths_to_add.is_empty() {
                paths_to_add.push((site_name.clone(), format!("{}/{}", sites_root_str, site_name)));
            }

            for (loc, fs_dir) in paths_to_add {
                custom_locations.push_str(&format!(
                    r#"
        location ^~ /{loc}/ {{
            alias "{fs_dir}/";
            index index.php index.html index.htm;
            try_files $uri $uri/ /{loc}/index.php?$query_string;

            location ~ \.php$ {{
                fastcgi_pass   127.0.0.1:{php_port};
                fastcgi_index  index.php;
                fastcgi_param  SCRIPT_FILENAME  $request_filename;
                include        fastcgi_params;
            }}
        }}"#,
                    loc = loc,
                    fs_dir = fs_dir,
                    php_port = php_port
                ));
            }
        }

        let mut vhost_blocks = String::new();
        if let Ok(entries) = fs::read_dir(&sites_root) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }
                let site_name = entry.file_name().to_string_lossy().to_string();
                let domain = match vhosts_map.get(&site_name) {
                    Some(d) if !d.is_empty() => d.clone(),
                    _ => continue,
                };
                let site_path = entry.path().to_string_lossy().replace('\\', "/");
                let php_ver = site_php_map.get(&site_name).cloned().unwrap_or_default();
                let php_port = get_site_php_port(&php_ver, settings);
                let has_ssl = *ssl_map.get(&site_name).unwrap_or(&false);

                vhost_blocks.push_str(&format!(
                    r#"
    server {{
        listen       {port};
        server_name  {domain} www.{domain};
        root         "{site_path}";
        index        index.php index.html index.htm;
        client_max_body_size 200M;

        location / {{
            try_files $uri $uri/ /index.php?$query_string;
        }}

        location ~ \.php$ {{
            fastcgi_pass   127.0.0.1:{php_port};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }}
    }}"#,
                    port = settings.web_port,
                    domain = domain,
                    site_path = site_path,
                    php_port = php_port
                ));

                if has_ssl {
                    let (crt, key) = ensure_ssl_cert(&domain);
                    vhost_blocks.push_str(&format!(
                        r#"
    server {{
        listen       443 ssl;
        server_name  {domain} www.{domain};
        root         "{site_path}";
        index        index.php index.html index.htm;
        client_max_body_size 200M;

        ssl_certificate      "{crt}";
        ssl_certificate_key  "{key}";

        location / {{
            try_files $uri $uri/ /index.php?$query_string;
        }}

        location ~ \.php$ {{
            fastcgi_pass   127.0.0.1:{php_port};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }}
    }}"#,
                        domain = domain,
                        site_path = site_path,
                        crt = crt.to_string_lossy().replace('\\', "/"),
                        key = key.to_string_lossy().replace('\\', "/"),
                        php_port = php_port
                    ));
                }
            }
        }

        let main_conf = format!(
            r#"worker_processes  1;
events {{
    worker_connections  1024;
}}
http {{
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  3600;
    fastcgi_read_timeout 3600s;
    fastcgi_send_timeout 3600s;
    fastcgi_connect_timeout 3600s;
    fastcgi_buffer_size 128k;
    fastcgi_buffers 4 256k;
    fastcgi_busy_buffers_size 256k;
    fastcgi_temp_file_write_size 256k;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    server {{
        listen       {port};
        server_name  localhost 127.0.0.1;
        root         "{doc_root}";
        index        index.php index.html index.htm;
        client_max_body_size 200M;

        location / {{
            try_files $uri $uri/ /index.php?$query_string;
        }}

        location /phpmyadmin {{
            alias "{pma_dir}/";
            index index.php index.html index.htm;

            location ~ \.php$ {{
                fastcgi_pass   127.0.0.1:{php_port};
                fastcgi_index  index.php;
                fastcgi_param  SCRIPT_FILENAME  $request_filename;
                include        fastcgi_params;
            }}
        }}
{custom_locations}
        location ~ \.php$ {{
            fastcgi_pass   127.0.0.1:{root_php_port};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }}
    }}

    server {{
        listen       443 ssl;
        server_name  localhost 127.0.0.1;
        root         "{doc_root}";
        index        index.php index.html index.htm;
        client_max_body_size 200M;

        ssl_certificate      "{ssl_crt}";
        ssl_certificate_key  "{ssl_key}";

        location / {{
            try_files $uri $uri/ /index.php?$query_string;
        }}

        location /phpmyadmin {{
            alias "{pma_dir}/";
            index index.php index.html index.htm;

            location ~ \.php$ {{
                fastcgi_pass   127.0.0.1:{php_port};
                fastcgi_index  index.php;
                fastcgi_param  SCRIPT_FILENAME  $request_filename;
                include        fastcgi_params;
            }}
        }}
{custom_locations}
        location ~ \.php$ {{
            fastcgi_pass   127.0.0.1:{root_php_port};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }}
    }}
{vhost_blocks}
}}
"#,
            port = settings.web_port,
            doc_root = doc_root_str,
            pma_dir = pma_dir,
            php_port = settings.php_cgi_port,
            root_php_port = root_php_port,
            custom_locations = custom_locations,
            ssl_crt = ssl_crt_str,
            ssl_key = ssl_key_str,
            vhost_blocks = vhost_blocks
        );
        let _ = fs::write(conf_dir.join("nginx.conf"), main_conf);
    }

    // 2. Configure Apache httpd.conf (Full Rewrite matching DownloadCenterForm.ConfigureApache)
    for ver in list_installed_versions("apache") {
        let apache_dir = base.join("bin/apache").join(&ver);
        // If extracted as nested Apache24
        let srv_root = if apache_dir.join("Apache24").exists() {
            apache_dir.join("Apache24")
        } else {
            apache_dir.clone()
        };
        let conf_dir = srv_root.join("conf");
        let _ = fs::create_dir_all(&conf_dir);
        let httpd_conf_path = conf_dir.join("httpd.conf");
        let apache_dir_str = srv_root.to_string_lossy().replace('\\', "/");

        let mut custom_directories = String::new();
        for (site_name, php_ver) in &site_php_map {
            if php_ver == "Node.js" {
                continue;
            }
            let php_port = get_site_php_port(php_ver, settings);
            let mut dirs_to_add = Vec::new();
            let direct_dir = www_base.join(site_name);
            if direct_dir.is_dir() {
                dirs_to_add.push(direct_dir.to_string_lossy().replace('\\', "/"));
            }
            // Check if site exists inside any month subfolder (e.g. www/2026_05/source_nasani_2026)
            if let Ok(entries) = fs::read_dir(&www_base) {
                for entry in entries.flatten() {
                    let ep = entry.path();
                    if ep.is_dir() {
                        let sub_p = ep.join(site_name);
                        if sub_p.is_dir() {
                            let s = sub_p.to_string_lossy().replace('\\', "/");
                            if !dirs_to_add.contains(&s) {
                                dirs_to_add.push(s);
                            }
                        }
                    }
                }
            }
            if dirs_to_add.is_empty() {
                dirs_to_add.push(format!("{}/{}", sites_root_str, site_name));
            }

            for site_dir in dirs_to_add {
                custom_directories.push_str(&format!(
                    r#"<Directory "{site_dir}">
    <FilesMatch \.php$>
        SetHandler "proxy:fcgi://127.0.0.1:{php_port}//./"
    </FilesMatch>
    AllowOverride All
    Require all granted
</Directory>
"#,
                    site_dir = site_dir,
                    php_port = php_port
                ));
            }
        }

        let mut vhost_entries = String::new();
        if let Ok(entries) = fs::read_dir(&sites_root) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }
                let site_name = entry.file_name().to_string_lossy().to_string();
                let domain = match vhosts_map.get(&site_name) {
                    Some(d) if !d.is_empty() => d.clone(),
                    _ => continue,
                };
                let site_path = entry.path().to_string_lossy().replace('\\', "/");
                let php_ver = site_php_map.get(&site_name).cloned().unwrap_or_default();
                let php_port = get_site_php_port(&php_ver, settings);
                let has_ssl = *ssl_map.get(&site_name).unwrap_or(&false);

                vhost_entries.push_str(&format!(
                    r#"
<VirtualHost *:{port}>
    ServerName {domain}
    ServerAlias www.{domain}
    DocumentRoot "{site_path}"
    <Directory "{site_path}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        <FilesMatch \.php$>
            SetHandler "proxy:fcgi://127.0.0.1:{php_port}//./"
        </FilesMatch>
    </Directory>
</VirtualHost>
"#,
                    port = settings.web_port,
                    domain = domain,
                    site_path = site_path,
                    php_port = php_port
                ));

                if has_ssl {
                    let (crt, key) = ensure_ssl_cert(&domain);
                    vhost_entries.push_str(&format!(
                        r#"
<VirtualHost *:443>
    ServerName {domain}
    ServerAlias www.{domain}
    DocumentRoot "{site_path}"
    SSLEngine on
    SSLCertificateFile "{crt}"
    SSLCertificateKeyFile "{key}"
    <Directory "{site_path}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        <FilesMatch \.php$>
            SetHandler "proxy:fcgi://127.0.0.1:{php_port}//./"
        </FilesMatch>
    </Directory>
</VirtualHost>
"#,
                        domain = domain,
                        site_path = site_path,
                        crt = crt.to_string_lossy().replace('\\', "/"),
                        key = key.to_string_lossy().replace('\\', "/"),
                        php_port = php_port
                    ));
                }
            }
        }

        let httpd_conf = format!(
            r#"ServerRoot "{apache_dir}"
Listen {port}
Listen 443
SSLSessionCache "shmcb:logs/ssl_scache(512000)"
SetEnv PHPRC "{php_dir}"
LoadModule authn_file_module modules/mod_authn_file.so
LoadModule authn_core_module modules/mod_authn_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule authz_groupfile_module modules/mod_authz_groupfile.so
LoadModule authz_user_module modules/mod_authz_user.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule access_compat_module modules/mod_access_compat.so
LoadModule auth_basic_module modules/mod_auth_basic.so
LoadModule reqtimeout_module modules/mod_reqtimeout.so
LoadModule filter_module modules/mod_filter.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule env_module modules/mod_env.so
LoadModule headers_module modules/mod_headers.so
LoadModule setenvif_module modules/mod_setenvif.so
LoadModule version_module modules/mod_version.so
LoadModule status_module modules/mod_status.so
LoadModule autoindex_module modules/mod_autoindex.so
LoadModule dir_module modules/mod_dir.so
LoadModule alias_module modules/mod_alias.so
LoadModule actions_module modules/mod_actions.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule cgi_module modules/mod_cgi.so
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_fcgi_module modules/mod_proxy_fcgi.so
ProxyFCGIBackendType GENERIC
LoadModule ssl_module modules/mod_ssl.so
LoadModule socache_shmcb_module modules/mod_socache_shmcb.so

<FilesMatch \.php$>
    SetHandler "proxy:fcgi://127.0.0.1:{root_php_port}//./"
</FilesMatch>

ServerAdmin admin@localhost
ServerName localhost:{port}
Timeout 3600
ProxyTimeout 3600

DocumentRoot "{doc_root}"
<Directory "{doc_root}">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

Alias /phpmyadmin "{pma_dir}"
<Directory "{pma_dir}">
    Options Indexes FollowSymLinks MultiViews
    AllowOverride All
    Require all granted
    <FilesMatch \.php$>
        SetHandler "proxy:fcgi://127.0.0.1:{php_port}//./"
    </FilesMatch>
</Directory>

{custom_directories}

DirectoryIndex index.php index.html

ErrorLog "logs/error.log"
LogLevel warn

<IfModule log_config_module>
    LogFormat "%h %l %u %t \"%r\" %>s %b" common
    CustomLog "logs/access.log" common
</IfModule>

<VirtualHost *:{port}>
    ServerName localhost
    DocumentRoot "{doc_root}"
    <Directory "{doc_root}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
{vhost_entries}
<VirtualHost *:443>
    DocumentRoot "{doc_root}"
    ServerName localhost
    SSLEngine on
    SSLCertificateFile "{ssl_crt}"
    SSLCertificateKeyFile "{ssl_key}"
    <FilesMatch \.php$>
        SetHandler "proxy:fcgi://127.0.0.1:{root_php_port}//./"
    </FilesMatch>
</VirtualHost>
"#,
            apache_dir = apache_dir_str,
            port = settings.web_port,
            php_dir = active_php_dir,
            root_php_port = root_php_port,
            php_port = settings.php_cgi_port,
            doc_root = doc_root_str,
            pma_dir = pma_dir,
            custom_directories = custom_directories,
            vhost_entries = vhost_entries,
            ssl_crt = ssl_crt_str,
            ssl_key = ssl_key_str
        );

        let _ = fs::write(httpd_conf_path, httpd_conf);
    }
}

pub fn start_php_service(settings: &AppSettings) -> Result<(), String> {
    let base = config::get_base_dir();
    let php_versions = list_installed_versions("php");
    if php_versions.is_empty() {
        return Err("Chưa cài đặt PHP Engine. Vui lòng tải trong mục PHP Engine.".to_string());
    }
    let active_ver = if settings.active_php_version.is_empty() {
        php_versions.last().unwrap().clone()
    } else {
        settings.active_php_version.clone()
    };

    let mut versions_to_start = vec![(active_ver.clone(), settings.php_cgi_port)];
    let site_php_map = config::load_string_map("sites.json");
    for (_, ver) in site_php_map {
        if ver != "Node.js" && !ver.is_empty() && ver != "Mặc định (Default)" {
            let port = get_site_php_port(&ver, settings);
            if !versions_to_start.iter().any(|(_, p)| *p == port) {
                versions_to_start.push((ver, port));
            }
        }
    }

    with_pm(|pm| {
        for (ver, port) in versions_to_start {
            if is_port_in_use(port) {
                continue;
            }
            let php_dir = base.join("bin/php").join(&ver);
            configure_php(&php_dir);
            if let Some(exe) = find_executable_recursive(&php_dir, &["php-cgi.exe", "php-cgi", "php-fpm"]) {
                let mut cmd = create_hidden_command(&exe.to_string_lossy());
                cmd.current_dir(&php_dir)
                    .env("PHP_FCGI_MAX_REQUESTS", "0")
                    .args([
                        "-b",
                        &format!("127.0.0.1:{}", port),
                        "-c",
                        &php_dir.join("php.ini").to_string_lossy(),
                    ])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                if let Ok(child) = cmd.spawn() {
                    pm.php_children.insert(port, child);
                }
            }
        }
    });
    Ok(())
}

pub fn stop_php_service() -> Result<(), String> {
    with_pm(|pm| {
        for (_, mut child) in pm.php_children.drain() {
            let _ = child.kill();
            let _ = child.wait();
        }
    });
    kill_process_by_name(&["php-cgi.exe", "php-cgi", "php-fpm"]);
    Ok(())
}

pub fn start_web_service(settings: &AppSettings) -> Result<(), String> {
    stop_web_service()?;
    generate_vhosts_configs(settings);
    configure_phpmyadmin(settings.mysql_port);

    // Ensure PHP-CGI is running so phpMyAdmin & PHP sites don't get 502/503
    if !is_port_in_use(settings.php_cgi_port) {
        let _ = start_php_service(settings);
    }

    let base = config::get_base_dir();

    if settings.default_web_server.eq_ignore_ascii_case("Nginx") {
        let versions = list_installed_versions("nginx");
        if versions.is_empty() {
            return Err("Chưa cài đặt Nginx Server. Vui lòng tải trong mục Nginx Server.".to_string());
        }
        let ver = if settings.active_nginx_version.is_empty() {
            versions.last().unwrap()
        } else {
            &settings.active_nginx_version
        };
        let nginx_dir = base.join("bin/nginx").join(ver);
        if let Some(exe) = find_executable_recursive(&nginx_dir, &["nginx.exe", "nginx"]) {
            let exe_parent = exe.parent().unwrap_or(&nginx_dir);
            let mut cmd = create_hidden_command(&exe.to_string_lossy());
            cmd.current_dir(exe_parent)
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            if let Ok(child) = cmd.spawn() {
                with_pm(|pm| pm.web_child = Some(child));
                return Ok(());
            }
        }
        Err("Không tìm thấy thực thi Nginx.".to_string())
    } else {
        let versions = list_installed_versions("apache");
        if versions.is_empty() {
            return Err("Chưa cài đặt Apache Server. Vui lòng tải trong mục Apache Server.".to_string());
        }
        let ver = if settings.active_apache_version.is_empty() {
            versions.last().unwrap()
        } else {
            &settings.active_apache_version
        };
        let apache_dir = base.join("bin/apache").join(ver);
        let srv_root = if apache_dir.join("Apache24").exists() {
            apache_dir.join("Apache24")
        } else {
            apache_dir.clone()
        };
        let conf_path = srv_root.join("conf/httpd.conf");
        if let Some(exe) = find_executable_recursive(&srv_root, &["httpd.exe", "httpd", "apachectl"]) {
            let exe_parent = exe.parent().unwrap_or(&srv_root);
            let mut cmd = create_hidden_command(&exe.to_string_lossy());
            cmd.current_dir(exe_parent)
                .args([
                    "-d",
                    &srv_root.to_string_lossy(),
                    "-f",
                    &conf_path.to_string_lossy(),
                ])
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            if let Ok(child) = cmd.spawn() {
                with_pm(|pm| pm.web_child = Some(child));
                return Ok(());
            }
        }
        Err("Không tìm thấy thực thi Apache httpd.".to_string())
    }
}

pub fn stop_web_service() -> Result<(), String> {
    with_pm(|pm| {
        if let Some(mut child) = pm.web_child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    });
    kill_process_by_name(&["httpd.exe", "nginx.exe", "httpd", "nginx"]);
    Ok(())
}

pub fn start_mysql_service(settings: &AppSettings) -> Result<(), String> {
    stop_mysql_service()?;
    let base = config::get_base_dir();
    let versions = list_installed_versions("mysql");
    if versions.is_empty() {
        return Err("Chưa cài đặt MySQL/MariaDB. Vui lòng tải trong mục Cơ sở dữ liệu.".to_string());
    }
    let ver = if settings.active_mysql_version.is_empty() {
        versions.last().unwrap()
    } else {
        &settings.active_mysql_version
    };
    let mysql_dir = base.join("bin/mysql").join(ver);
    configure_mysql(&mysql_dir, settings.mysql_port);
    configure_phpmyadmin(settings.mysql_port);

    let my_ini_path = mysql_dir.join("my.ini");
    if let Some(exe) = find_executable_recursive(&mysql_dir, &["mysqld.exe", "mariadbd.exe", "mysqld", "mariadbd"]) {
        let exe_parent = exe.parent().unwrap_or(&mysql_dir);
        let mut cmd = create_hidden_command(&exe.to_string_lossy());
        cmd.current_dir(exe_parent)
            .args([
                &format!("--defaults-file={}", my_ini_path.to_string_lossy()),
                "--standalone",
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        if let Ok(child) = cmd.spawn() {
            with_pm(|pm| pm.mysql_child = Some(child));
            return Ok(());
        }
    }
    Err("Không tìm thấy thực thi MySQL/MariaDB.".to_string())
}

pub fn stop_mysql_service() -> Result<(), String> {
    with_pm(|pm| {
        if let Some(mut child) = pm.mysql_child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    });
    kill_process_by_name(&["mysqld.exe", "mariadbd.exe", "mysqld", "mariadbd"]);
    Ok(())
}

pub fn kill_process_by_name(names: &[&str]) {
    #[cfg(target_os = "windows")]
    {
        for name in names {
            if name.ends_with(".exe") {
                let _ = create_hidden_command("taskkill")
                    .args(["/F", "/IM", name, "/T"])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .output();
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        for name in names {
            if !name.ends_with(".exe") {
                let _ = Command::new("pkill")
                    .args(["-f", name])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .output();
            }
        }
    }
}

pub fn create_default_index_if_empty() {
    let www = config::get_base_dir().join("www");
    let index_php = www.join("index.php");
    if !index_php.exists() {
        let html = r#"<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>RBWStack - Portable Web Server</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F9FAFB; color: #111827; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
.card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px 48px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
h1 { margin: 0 0 8px; color: #2563EB; }
p { color: #6B7280; margin: 6px 0; }
.badge { display: inline-block; margin-top: 16px; padding: 6px 14px; background: #DCFCE7; color: #15803D; border-radius: 999px; font-weight: 600; font-size: 14px; }
</style>
</head>
<body>
<div class="card">
    <h1>RBWStack Portable Web Server</h1>
    <p>PHP Version: <strong><?php echo phpversion(); ?></strong></p>
    <p>Server Software: <strong><?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'RBWStack'; ?></strong></p>
    <div class="badge">● Hệ thống đang hoạt động ổn định</div>
</div>
</body>
</html>"#;
        let _ = fs::write(index_php, html);
    }
}

pub fn get_config_file_path(target: &str) -> Result<PathBuf, String> {
    let base = config::get_base_dir();
    let settings = config::load_app_settings();
    match target {
        "php" => {
            let ver = if settings.active_php_version.is_empty() {
                list_installed_versions("php").last().cloned().unwrap_or_default()
            } else {
                settings.active_php_version
            };
            if ver.is_empty() {
                return Err("Chưa cài đặt PHP.".to_string());
            }
            let php_dir = base.join("bin/php").join(ver);
            configure_php(&php_dir);
            Ok(php_dir.join("php.ini"))
        }
        "web" => {
            if settings.default_web_server.eq_ignore_ascii_case("Nginx") {
                let ver = if settings.active_nginx_version.is_empty() {
                    list_installed_versions("nginx").last().cloned().unwrap_or_default()
                } else {
                    settings.active_nginx_version
                };
                if ver.is_empty() {
                    return Err("Chưa cài đặt Nginx.".to_string());
                }
                Ok(base.join("bin/nginx").join(ver).join("conf/nginx.conf"))
            } else {
                let ver = if settings.active_apache_version.is_empty() {
                    list_installed_versions("apache").last().cloned().unwrap_or_default()
                } else {
                    settings.active_apache_version
                };
                if ver.is_empty() {
                    return Err("Chưa cài đặt Apache.".to_string());
                }
                Ok(base.join("bin/apache").join(ver).join("conf/httpd.conf"))
            }
        }
        "mysql" => {
            let ver = if settings.active_mysql_version.is_empty() {
                list_installed_versions("mysql").last().cloned().unwrap_or_default()
            } else {
                settings.active_mysql_version
            };
            if ver.is_empty() {
                return Err("Chưa cài đặt MySQL/MariaDB.".to_string());
            }
            let mysql_dir = base.join("bin/mysql").join(ver);
            configure_mysql(&mysql_dir, settings.mysql_port);
            Ok(mysql_dir.join("my.ini"))
        }
        _ => Err("Loại file cấu hình không hợp lệ.".to_string()),
    }
}
