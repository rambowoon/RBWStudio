use crate::config;
use crate::services::{self, create_hidden_command, with_pm};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteInfo {
    pub name: String,
    pub path: String,
    pub is_node: bool,
    pub php_version: String,
    pub ssl_enabled: bool,
    pub vhost_domain: String,
    pub vhost_active: bool,
    pub is_root_project: bool,
    pub node_running: bool,
    pub node_autostart: bool,
    pub node_cmd: String,
    pub deploy_status: String, // "none" | "deployed" | "locked"
    pub tunnel_running: bool,
    pub tunnel_url: String,
    pub url: String,
}

pub fn get_sites_list() -> Vec<SiteInfo> {
    let settings = config::load_app_settings();
    let sites_root = config::get_sites_root_dir();
    let www_base = config::get_www_base_dir();
    let sites_php = config::load_string_map("sites.json");
    let ssl_map = config::load_bool_map("ssl.json");
    let vhosts_map = config::load_string_map("sites_vhosts.json");
    let node_autostart_map = config::load_bool_map("sites_node_autostart.json");
    let node_cmd_map = config::load_string_map("sites_node_cmd.json");
    let deploy_status_map = config::load_string_map("demo_deploy_status.json");
    let root_project = config::load_text_file("root_project.txt");

    let php_versions = services::list_installed_versions("php");
    let default_php = if !settings.active_php_version.is_empty() {
        settings.active_php_version.clone()
    } else {
        php_versions.first().cloned().unwrap_or_else(|| "PHP Default".to_string())
    };

    let mut list = Vec::new();
    let re_month = regex::Regex::new(r"^\d{4}_\d{2}$|^(?i)thang\d{1,2}$").unwrap();
    let mut raw_entries = Vec::new();
    if let Ok(entries) = fs::read_dir(&sites_root) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name.eq_ignore_ascii_case("RBWManager") {
                continue;
            }
            if re_month.is_match(&name) {
                if let Ok(subs) = fs::read_dir(&p) {
                    for sub in subs.flatten() {
                        let sp = sub.path();
                        if sp.is_dir() {
                            let sname = sub.file_name().to_string_lossy().to_string();
                            if !sname.starts_with('.') {
                                raw_entries.push((sname, sp));
                            }
                        }
                    }
                }
            } else {
                raw_entries.push((name, p));
            }
        }
    }

    let (running_nodes, running_tunnels, tunnel_urls_map) = with_pm(|pm| {
        let rn: std::collections::HashSet<String> = pm.node_children.keys().cloned().collect();
        let rt: std::collections::HashSet<String> = pm.tunnel_children.keys().cloned().collect();
        let tu = pm.tunnel_urls.clone();
        (rn, rt, tu)
    });

    for (name, p) in raw_entries {
        let rel_path = p
            .strip_prefix(&www_base)
            .or_else(|_| p.strip_prefix(&sites_root))
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| name.clone());

        let saved_engine = sites_php
            .get(&rel_path)
            .or_else(|| sites_php.get(&name))
            .cloned()
            .unwrap_or_default();

        let is_node = if !saved_engine.is_empty() {
            saved_engine == "Node.js"
        } else {
            p.join("package.json").is_file()
                && !p.join("index.php").is_file()
                && !p.join("public/index.php").is_file()
        };
        let php_version = if is_node {
            "Node.js".to_string()
        } else if !saved_engine.is_empty() {
            saved_engine
        } else {
            default_php.clone()
        };

        let ssl_enabled = *ssl_map.get(&rel_path).or_else(|| ssl_map.get(&name)).unwrap_or(&false);
        let vhost_domain = vhosts_map.get(&rel_path).or_else(|| vhosts_map.get(&name)).cloned().unwrap_or_default();
        let vhost_active = !vhost_domain.is_empty();
        let is_root_project = !root_project.is_empty() && (root_project.eq_ignore_ascii_case(&name) || root_project.eq_ignore_ascii_case(&rel_path));
        let node_autostart = *node_autostart_map.get(&rel_path).or_else(|| node_autostart_map.get(&name)).unwrap_or(&false);
        let node_cmd = node_cmd_map
            .get(&rel_path)
            .or_else(|| node_cmd_map.get(&name))
            .cloned()
            .unwrap_or_else(|| "npm start".to_string());
        let deploy_status = deploy_status_map
            .get(&rel_path)
            .or_else(|| deploy_status_map.get(&name))
            .cloned()
            .unwrap_or_else(|| "none".to_string());

        let node_running = running_nodes.contains(&name) || running_nodes.contains(&rel_path);
        let tunnel_running = running_tunnels.contains(&name) || running_tunnels.contains(&rel_path);
        let tunnel_url = tunnel_urls_map
            .get(&rel_path)
            .or_else(|| tunnel_urls_map.get(&name))
            .cloned()
            .unwrap_or_default();

        let scheme = if ssl_enabled { "https" } else { "http" };
        let port_suffix = if (ssl_enabled && settings.web_port == 443) || (!ssl_enabled && settings.web_port == 80) {
            String::new()
        } else {
            format!(":{}", settings.web_port)
        };

        let url = if !tunnel_url.is_empty() {
            tunnel_url.clone()
        } else if vhost_active {
            format!("{}://{}{}", scheme, vhost_domain, port_suffix)
        } else if is_root_project {
            format!("{}://localhost{}", scheme, port_suffix)
        } else {
            format!("{}://localhost{}/{}", scheme, port_suffix, rel_path.trim_matches('/'))
        };

        list.push(SiteInfo {
            name,
            path: p.to_string_lossy().to_string(),
            is_node,
            php_version,
            ssl_enabled,
            vhost_domain,
            vhost_active,
            is_root_project,
            node_running,
            node_autostart,
            node_cmd,
            deploy_status,
            tunnel_running,
            tunnel_url,
            url,
        });
    }

    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    list
}

pub fn set_site_engine(site_name: &str, engine: &str) -> Result<(), String> {
    let sites_root = config::get_sites_root_dir();
    let _ = crate::db::set_project_php(site_name, engine);
    let mut map = config::load_string_map("sites.json");
    map.insert(site_name.to_string(), engine.to_string());

    if let Ok(entries) = fs::read_dir(&sites_root) {
        let re_month = regex::Regex::new(r"^\d{4}_\d{2}$|^(?i)thang\d{1,2}$").unwrap();
        for entry in entries.flatten() {
            let mpath = entry.path();
            if mpath.is_dir() {
                let mname = entry.file_name().to_string_lossy().to_string();
                if re_month.is_match(&mname) && mpath.join(site_name).is_dir() {
                    let rel = format!("{}/{}", mname, site_name);
                    map.insert(rel.clone(), engine.to_string());
                    let _ = crate::db::set_project_php(&rel, engine);
                }
            }
        }
    }

    config::save_string_map("sites.json", &map)?;
    let settings = config::load_app_settings();
    services::generate_vhosts_configs(&settings);
    let _ = services::start_php_service(&settings);
    if services::is_port_in_use(settings.web_port) {
        let _ = services::start_web_service(&settings);
    }
    Ok(())
}

pub fn toggle_site_ssl(site_name: &str, enabled: bool) -> Result<(), String> {
    let _ = crate::db::set_project_ssl(site_name, enabled);
    let mut map = config::load_bool_map("ssl.json");
    map.insert(site_name.to_string(), enabled);
    config::save_bool_map("ssl.json", &map)?;
    let settings = config::load_app_settings();
    services::generate_vhosts_configs(&settings);
    Ok(())
}

pub fn set_root_project(site_name: &str) -> Result<String, String> {
    let current = config::load_text_file("root_project.txt");
    let next = if current.eq_ignore_ascii_case(site_name) {
        String::new()
    } else {
        site_name.to_string()
    };
    config::save_text_file("root_project.txt", &next)?;

    if !next.is_empty() {
        let sites_root = config::get_sites_root_dir();
        let www_base = config::get_www_base_dir();
        let site_path = if sites_root.join(&next).exists() {
            sites_root.join(&next)
        } else {
            www_base.join(&next)
        };
        let settings = config::load_app_settings();
        let port_str = if settings.web_port == 80 {
            String::new()
        } else {
            format!(":{}", settings.web_port)
        };
        update_project_env_file(&site_path, &format!("http://localhost{}", port_str), "/");
    }

    let settings = config::load_app_settings();
    services::generate_vhosts_configs(&settings);
    Ok(next)
}

pub fn save_vhost(site_name: &str, domain: &str, enable: bool) -> Result<(), String> {
    let mut vhosts = config::load_string_map("sites_vhosts.json");
    let old_domain = vhosts.get(site_name).cloned().unwrap_or_default();

    if !old_domain.is_empty() {
        let _ = update_os_hosts_file(&old_domain, false);
    }

    if enable && !domain.trim().is_empty() {
        let clean_domain = domain.trim().to_lowercase();
        let _ = crate::db::set_project_vhost(site_name, &clean_domain);
        update_os_hosts_file(&clean_domain, true)?;
        vhosts.insert(site_name.to_string(), clean_domain.clone());
        config::save_string_map("sites_vhosts.json", &vhosts)?;

        let site_path = config::get_sites_root_dir().join(site_name);
        let settings = config::load_app_settings();
        let ssl_map = config::load_bool_map("ssl.json");
        let is_ssl = *ssl_map.get(site_name).unwrap_or(&false);
        let scheme = if is_ssl { "https" } else { "http" };
        let port_str = if (is_ssl && settings.web_port == 443) || (!is_ssl && settings.web_port == 80) {
            String::new()
        } else {
            format!(":{}", settings.web_port)
        };
        update_project_env_file(&site_path, &format!("{}://{}{}", scheme, clean_domain, port_str), "/");
    } else {
        let _ = crate::db::set_project_vhost(site_name, "");
        vhosts.remove(site_name);
        config::save_string_map("sites_vhosts.json", &vhosts)?;

        let site_path = config::get_sites_root_dir().join(site_name);
        let www_base = config::get_www_base_dir();
        let rel_site = site_path
            .strip_prefix(&www_base)
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| site_name.to_string());
        let settings = config::load_app_settings();
        let port_str = if settings.web_port == 80 {
            String::new()
        } else {
            format!(":{}", settings.web_port)
        };
        update_project_env_file(
            &site_path,
            &format!("http://localhost{}/{}", port_str, rel_site),
            &format!("/{}/", rel_site),
        );
    }

    let settings = config::load_app_settings();
    services::generate_vhosts_configs(&settings);
    Ok(())
}

pub fn update_project_env_file(site_path: &Path, app_url: &str, site_path_val: &str) {
    let env_file = site_path.join(".env");
    if !env_file.exists() {
        return;
    }
    if let Ok(content) = fs::read_to_string(&env_file) {
        let mut lines: Vec<String> = Vec::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("APP_URL=") {
                lines.push(format!("APP_URL={}", app_url));
            } else if trimmed.starts_with("SITE_PATH=") {
                lines.push(format!("SITE_PATH='{}'", site_path_val));
            } else {
                lines.push(line.to_string());
            }
        }
        let _ = fs::write(&env_file, lines.join("\n"));
    }
}

pub fn get_hosts_file_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
    }
    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("/etc/hosts")
    }
}

pub fn update_os_hosts_file(domain: &str, add: bool) -> Result<(), String> {
    let hosts_path = get_hosts_file_path();
    let content = fs::read_to_string(&hosts_path).unwrap_or_default();
    let mut lines: Vec<String> = content
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.ends_with(&format!(" {}", domain)) && !t.ends_with(&format!("\t{}", domain))
        })
        .map(|s| s.to_string())
        .collect();

    if add {
        lines.push(format!("127.0.0.1 {} www.{}", domain, domain));
    }

    let new_content = lines.join("\n") + "\n";
    if fs::write(&hosts_path, &new_content).is_ok() {
        return Ok(());
    }

    // Elevated write fallback for macOS / Windows
    let temp_hosts = config::get_base_dir().join("tmp/hosts_tmp");
    let _ = fs::write(&temp_hosts, &new_content);

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "do shell script \"cp '{}' '/etc/hosts'\" with administrator privileges",
            temp_hosts.to_string_lossy()
        );
        let status = Command::new("osascript").args(["-e", &script]).status();
        if status.map(|s| s.success()).unwrap_or(false) {
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let status = create_hidden_command("powershell")
            .args([
                "-Command",
                &format!(
                    "Start-Process cmd -ArgumentList '/c copy /Y \"{}\" \"{}\"' -Verb RunAs -WindowStyle Hidden -Wait",
                    temp_hosts.to_string_lossy(),
                    hosts_path.to_string_lossy()
                ),
            ])
            .status();
        if status.map(|s| s.success()).unwrap_or(false) {
            return Ok(());
        }
    }

    Err("Không thể ghi file hosts hệ thống (cần quyền Administrator/sudo).".to_string())
}

pub fn toggle_node_app(site_name: &str) -> Result<bool, String> {
    let is_running = with_pm(|pm| pm.node_children.contains_key(site_name));
    if is_running {
        with_pm(|pm| {
            if let Some(mut child) = pm.node_children.remove(site_name) {
                let _ = child.kill();
            }
        });
        return Ok(false);
    }

    let site_path = config::get_sites_root_dir().join(site_name);
    let cmd_map = config::load_string_map("sites_node_cmd.json");
    let start_cmd = cmd_map
        .get(site_name)
        .cloned()
        .unwrap_or_else(|| "npm start".to_string());

    #[cfg(target_os = "windows")]
    let mut cmd = create_hidden_command("cmd");
    #[cfg(target_os = "windows")]
    cmd.args(["/C", &start_cmd]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("sh");
    #[cfg(not(target_os = "windows"))]
    cmd.args(["-c", &start_cmd]);

    // Prepend portable nodejs bin if installed
    let node_versions = services::list_installed_versions("nodejs");
    if let Some(first_node) = node_versions.first() {
        let node_dir = config::get_base_dir().join("bin/nodejs").join(first_node);
        if let Ok(current_path) = std::env::var("PATH") {
            #[cfg(target_os = "windows")]
            let sep = ";";
            #[cfg(not(target_os = "windows"))]
            let sep = ":";
            cmd.env("PATH", format!("{}{}{}", node_dir.to_string_lossy(), sep, current_path));
        }
    }

    cmd.current_dir(&site_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = cmd.spawn().map_err(|e| format!("Lỗi khởi chạy Node.js: {}", e))?;
    with_pm(|pm| {
        pm.node_children.insert(site_name.to_string(), child);
    });
    Ok(true)
}

pub fn set_node_config(site_name: &str, autostart: bool, start_cmd: &str) -> Result<(), String> {
    let mut auto_map = config::load_bool_map("sites_node_autostart.json");
    auto_map.insert(site_name.to_string(), autostart);
    config::save_bool_map("sites_node_autostart.json", &auto_map)?;

    let mut cmd_map = config::load_string_map("sites_node_cmd.json");
    cmd_map.insert(site_name.to_string(), start_cmd.trim().to_string());
    config::save_string_map("sites_node_cmd.json", &cmd_map)?;
    Ok(())
}

pub fn toggle_cloudflare_tunnel(site_name: &str) -> Result<String, String> {
    let is_running = with_pm(|pm| pm.tunnel_children.contains_key(site_name));
    if is_running {
        with_pm(|pm| {
            if let Some(mut child) = pm.tunnel_children.remove(site_name) {
                let _ = child.kill();
            }
            pm.tunnel_urls.remove(site_name);
        });
        return Ok(String::new());
    }

    let base = config::get_base_dir().join("bin/cloudflared");
    #[cfg(target_os = "windows")]
    let bin = base.join("cloudflared.exe");
    #[cfg(not(target_os = "windows"))]
    let bin = base.join("cloudflared");

    if !bin.exists() {
        return Err("Chưa cài đặt Cloudflare Tunnel (cloudflared).".to_string());
    }

    let settings = config::load_app_settings();
    let vhosts = config::load_string_map("sites_vhosts.json");
    let host_header = vhosts
        .get(site_name)
        .cloned()
        .unwrap_or_else(|| "localhost".to_string());

    let target_url = format!("http://127.0.0.1:{}", settings.web_port);
    let mut cmd = create_hidden_command(&bin.to_string_lossy());
    cmd.args([
        "tunnel",
        "--url",
        &target_url,
        "--http-host-header",
        &host_header,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stderr = child.stderr.take();
    let site_key = site_name.to_string();

    with_pm(|pm| {
        pm.tunnel_children.insert(site_key.clone(), child);
    });

    if let Some(err_stream) = stderr {
        thread::spawn(move || {
            let reader = BufReader::new(err_stream);
            let re = Regex::new(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com").unwrap();
            for line in reader.lines().flatten() {
                if let Some(m) = re.find(&line) {
                    let found_url = m.as_str().to_string();
                    with_pm(|pm| {
                        pm.tunnel_urls.insert(site_key.clone(), found_url);
                    });
                    break;
                }
            }
        });
    }

    Ok("starting".to_string())
}

pub fn open_in_file_manager(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path.replace('/', "\\"))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn open_in_vscode(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        create_hidden_command("cmd")
            .args(["/C", "code", path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("code").arg(path).spawn();
        if status.is_err() {
            Command::new("open")
                .args(["-a", "Visual Studio Code", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn open_in_terminal(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "cmd.exe", "/K", &format!("cd /d \"{}\"", path)])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal", path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn open_url_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        create_hidden_command("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

