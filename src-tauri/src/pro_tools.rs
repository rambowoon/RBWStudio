use crate::config;
use crate::services::create_hidden_command;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub fn ensure_rbwmanager_server() -> String {
    let addr: SocketAddr = "127.0.0.1:19820".parse().unwrap();
    if TcpStream::connect_timeout(&addr, Duration::from_millis(80)).is_ok() {
        return "http://127.0.0.1:19820/?embed=1".to_string();
    }

    let manager_dir = {
        let d1 = config::get_base_dir().join("www/RBWManager");
        if d1.exists() {
            d1
        } else {
            config::get_sites_root_dir().join("RBWManager")
        }
    };

    if let Some(php_exe) = find_php_exe() {
        if manager_dir.exists() {
            let mut cmd = create_hidden_command(&php_exe.to_string_lossy());
            cmd.current_dir(&manager_dir).args([
                "-d",
                "memory_limit=512M",
                "-d",
                "max_execution_time=0",
                "-d",
                "post_max_size=128M",
                "-d",
                "upload_max_filesize=128M",
                "-S",
                "127.0.0.1:19820",
                "-t",
                &manager_dir.to_string_lossy(),
            ]);
            let _ = cmd.spawn();

            for _ in 0..20 {
                if TcpStream::connect_timeout(&addr, Duration::from_millis(60)).is_ok() {
                    break;
                }
                std::thread::sleep(Duration::from_millis(60));
            }
        }
    }

    "http://127.0.0.1:19820/?embed=1".to_string()
}

// ============================================================================
// 1. HOSTS MANAGER
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostEntry {
    pub line_index: usize,
    pub ip: String,
    pub domain: String,
    pub comment: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostsData {
    pub path: String,
    pub entries: Vec<HostEntry>,
    pub raw_content: String,
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

pub fn load_hosts_data() -> HostsData {
    let path = get_hosts_file_path();
    let raw_content = fs::read_to_string(&path).unwrap_or_default();
    let mut entries = Vec::new();

    for (idx, line) in raw_content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let (enabled, body) = if let Some(stripped) = trimmed.strip_prefix('#') {
            (false, stripped.trim())
        } else {
            (true, trimmed)
        };

        if body.is_empty() {
            continue;
        }

        let (main_part, comment) = match body.split_once('#') {
            Some((m, c)) => (m.trim(), c.trim().to_string()),
            None => (body, String::new()),
        };

        let parts: Vec<&str> = main_part.split_whitespace().collect();
        if parts.len() >= 2 {
            let ip = parts[0];
            let valid_ip = ip.chars().all(|c| c.is_ascii_hexdigit() || c == '.' || c == ':');
            if valid_ip && (ip.contains('.') || ip.contains(':')) {
                let domain = parts[1..].join(" ");
                entries.push(HostEntry {
                    line_index: idx,
                    ip: ip.to_string(),
                    domain,
                    comment,
                    enabled,
                });
            }
        }
    }

    HostsData {
        path: path.to_string_lossy().to_string(),
        entries,
        raw_content,
    }
}

pub fn write_hosts_content(new_content: &str) -> Result<HostsData, String> {
    let hosts_path = get_hosts_file_path();
    if fs::write(&hosts_path, new_content).is_ok() {
        flush_dns_cache();
        return Ok(load_hosts_data());
    }

    let temp_hosts = config::get_base_dir().join("tmp/hosts_tmp");
    let _ = fs::create_dir_all(config::get_base_dir().join("tmp"));
    fs::write(&temp_hosts, new_content).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        let status = create_hidden_command("powershell")
            .args([
                "-Command",
                &format!(
                    "Start-Process cmd -ArgumentList '/c copy /Y \"{}\" \"{}\" && ipconfig /flushdns' -Verb RunAs -WindowStyle Hidden -Wait",
                    temp_hosts.to_string_lossy(),
                    hosts_path.to_string_lossy()
                ),
            ])
            .status();
        if status.map(|s| s.success()).unwrap_or(false) {
            return Ok(load_hosts_data());
        }
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "do shell script \"cp '{}' '/etc/hosts' && dscacheutil -flushcache\" with administrator privileges",
            temp_hosts.to_string_lossy()
        );
        let status = std::process::Command::new("osascript").args(["-e", &script]).status();
        if status.map(|s| s.success()).unwrap_or(false) {
            return Ok(load_hosts_data());
        }
    }

    Err("Không thể ghi file hosts (cần cấp quyền Administrator).".to_string())
}

pub fn flush_dns_cache() {
    #[cfg(target_os = "windows")]
    {
        let _ = create_hidden_command("ipconfig").arg("/flushdns").status();
    }
}

pub fn add_host_line(ip: &str, domain: &str, comment: &str) -> Result<HostsData, String> {
    let ip = ip.trim();
    let domain = domain.trim();
    if ip.is_empty() || domain.is_empty() {
        return Err("Vui lòng nhập đầy đủ IP và tên miền.".to_string());
    }
    let data = load_hosts_data();
    let mut content = data.raw_content;
    if !content.ends_with('\n') && !content.is_empty() {
        content.push('\n');
    }
    if comment.trim().is_empty() {
        content.push_str(&format!("{}\t{}\n", ip, domain));
    } else {
        content.push_str(&format!("{}\t{}\t# {}\n", ip, domain, comment.trim()));
    }
    write_hosts_content(&content)
}

pub fn toggle_host_line(line_index: usize) -> Result<HostsData, String> {
    let data = load_hosts_data();
    let mut lines: Vec<String> = data.raw_content.lines().map(|s| s.to_string()).collect();
    if line_index >= lines.len() {
        return Err("Dòng không hợp lệ.".to_string());
    }
    let line = lines[line_index].trim().to_string();
    if let Some(stripped) = line.strip_prefix('#') {
        lines[line_index] = stripped.trim_start().to_string();
    } else {
        lines[line_index] = format!("# {}", line);
    }
    let new_content = lines.join("\n") + "\n";
    write_hosts_content(&new_content)
}

pub fn delete_host_line(line_index: usize) -> Result<HostsData, String> {
    let data = load_hosts_data();
    let mut lines: Vec<String> = data.raw_content.lines().map(|s| s.to_string()).collect();
    if line_index >= lines.len() {
        return Err("Dòng không hợp lệ.".to_string());
    }
    lines.remove(line_index);
    let new_content = lines.join("\n") + "\n";
    write_hosts_content(&new_content)
}

// ============================================================================
// 2. IMAGE OPTIMIZER (WEBP CONVERTER & IMAGE TRIM)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectImageItem {
    pub rel_path: String,
    pub ext: String,
    pub size_kb: f64,
    pub width: u32,
    pub height: u32,
    pub has_backup: bool,
    pub has_webp: bool,
}

fn read_image_dimensions_fast(path: &Path) -> (u32, u32) {
    let mut f = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return (0, 0),
    };
    let mut buf = [0u8; 64];
    let n = f.read(&mut buf).unwrap_or(0);
    if n < 24 {
        return (0, 0);
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR
    if &buf[0..8] == b"\x89PNG\r\n\x1a\n" {
        let w = u32::from_be_bytes([buf[16], buf[17], buf[18], buf[19]]);
        let h = u32::from_be_bytes([buf[20], buf[21], buf[22], buf[23]]);
        return (w, h);
    }

    // GIF: GIF87a or GIF89a
    if &buf[0..3] == b"GIF" {
        let w = u16::from_le_bytes([buf[6], buf[7]]) as u32;
        let h = u16::from_le_bytes([buf[8], buf[9]]) as u32;
        return (w, h);
    }

    // WEBP: RIFF....WEBPVP8
    if &buf[0..4] == b"RIFF" && &buf[8..12] == b"WEBP" {
        if &buf[12..16] == b"VP8 " && n >= 30 {
            let w = (u16::from_le_bytes([buf[26], buf[27]]) & 0x3fff) as u32;
            let h = (u16::from_le_bytes([buf[28], buf[29]]) & 0x3fff) as u32;
            return (w, h);
        } else if &buf[12..16] == b"VP8L" && n >= 25 {
            let b0 = buf[21] as u32;
            let b1 = buf[22] as u32;
            let b2 = buf[23] as u32;
            let b3 = buf[24] as u32;
            let w = (b0 | ((b1 & 0x3F) << 8)) + 1;
            let h = (((b1 & 0xC0) >> 6) | (b2 << 2) | ((b3 & 0x0F) << 10)) + 1;
            return (w, h);
        } else if &buf[12..16] == b"VP8X" && n >= 30 {
            let w = (buf[24] as u32 | ((buf[25] as u32) << 8) | ((buf[26] as u32) << 16)) + 1;
            let h = (buf[27] as u32 | ((buf[28] as u32) << 8) | ((buf[29] as u32) << 16)) + 1;
            return (w, h);
        }
    }

    // JPEG: scan SOF0/SOF2 marker
    if buf[0] == 0xFF && buf[1] == 0xD8 {
        if let Ok(full) = fs::read(path) {
            let mut i = 2;
            while i + 9 < full.len() {
                if full[i] != 0xFF {
                    i += 1;
                    continue;
                }
                let marker = full[i + 1];
                if marker == 0xFF {
                    i += 1;
                    continue;
                }
                if marker == 0xD8 || marker == 0xD9 || (0xD0..=0xD7).contains(&marker) {
                    i += 2;
                    continue;
                }
                let len = u16::from_be_bytes([full[i + 2], full[i + 3]]) as usize;
                if (0xC0..=0xC3).contains(&marker) && i + 8 < full.len() {
                    let h = u16::from_be_bytes([full[i + 5], full[i + 6]]) as u32;
                    let w = u16::from_be_bytes([full[i + 7], full[i + 8]]) as u32;
                    return (w, h);
                }
                if len < 2 {
                    break;
                }
                i += 2 + len;
            }
        }
    }

    (0, 0)
}

pub fn scan_project_images(site_name: &str) -> Result<Vec<ProjectImageItem>, String> {
    let site_dir = config::get_sites_root_dir().join(site_name);
    if !site_dir.exists() {
        return Err(format!("Không tìm thấy thư mục dự án: {}", site_name));
    }

    let backup_root = config::get_base_dir()
        .join("tmp/img_backups")
        .join(site_name);
    let mut items = Vec::new();
    collect_images_recursive(&site_dir, &site_dir, &backup_root, &mut items);
    items.sort_by(|a, b| b.size_kb.partial_cmp(&a.size_kb).unwrap_or(std::cmp::Ordering::Equal));
    Ok(items)
}

fn collect_images_recursive(
    base: &Path,
    dir: &Path,
    backup_root: &Path,
    out: &mut Vec<ProjectImageItem>,
) {
    if out.len() >= 1500 {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if p.is_dir() {
            let lower = name.to_lowercase();
            if matches!(
                lower.as_str(),
                "vendor" | "node_modules" | "storage" | "compiled" | "cache" | "backups" | "logs"
            ) {
                continue;
            }
            collect_images_recursive(base, &p, backup_root, out);
        } else if let Some(ext_os) = p.extension() {
            let ext = ext_os.to_string_lossy().to_lowercase();
            if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
                if let Ok(rel) = p.strip_prefix(base) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    let size_kb = entry
                        .metadata()
                        .map(|m| (m.len() as f64 / 1024.0 * 10.0).round() / 10.0)
                        .unwrap_or(0.0);
                    let (width, height) = read_image_dimensions_fast(&p);
                    let has_backup = backup_root.join(&rel_str).exists();
                    let webp_path = p.with_extension("webp");
                    let has_webp = ext == "webp" || webp_path.exists();
                    out.push(ProjectImageItem {
                        rel_path: rel_str,
                        ext,
                        size_kb,
                        width,
                        height,
                        has_backup,
                        has_webp,
                    });
                }
            }
        }
    }
}

fn find_php_exe() -> Option<PathBuf> {
    let settings = config::load_app_settings();
    let php_root = config::get_base_dir().join("bin/php");
    if !settings.active_php_version.is_empty() {
        let candidate = php_root.join(&settings.active_php_version).join("php.exe");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    if let Ok(entries) = fs::read_dir(&php_root) {
        for entry in entries.flatten() {
            let candidate = entry.path().join("php.exe");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

pub fn convert_project_images_webp(
    site_name: &str,
    rel_paths: Vec<String>,
    quality: u8,
    replace_original: bool,
) -> Result<String, String> {
    let php_exe = find_php_exe().ok_or("Không tìm thấy PHP CLI trong bin/php để xử lý GD.")?;
    let site_dir = config::get_sites_root_dir().join(site_name);
    let backup_root = config::get_base_dir()
        .join("tmp/img_backups")
        .join(site_name);

    let mut converted_count = 0;
    let mut saved_bytes: i64 = 0;

    for rel in &rel_paths {
        let src_path = site_dir.join(rel);
        if !src_path.exists() {
            continue;
        }
        let bak_path = backup_root.join(rel);
        if !bak_path.exists() {
            if let Some(parent) = bak_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::copy(&src_path, &bak_path);
        }

        let old_size = fs::metadata(&src_path).map(|m| m.len() as i64).unwrap_or(0);
        let dst_path = if replace_original {
            src_path.clone()
        } else {
            src_path.with_extension("webp")
        };

        let php_code = format!(
            r#"$src = '{}'; $dst = '{}'; $q = {};
            $info = @getimagesize($src);
            if (!$info) exit(1);
            $mime = $info['mime'];
            if ($mime === 'image/jpeg') $im = @imagecreatefromjpeg($src);
            elseif ($mime === 'image/png') {{
                $im = @imagecreatefrompng($src);
                if ($im) {{ imagepalettetotruecolor($im); imagealphablending($im, true); imagesavealpha($im, true); }}
            }} elseif ($mime === 'image/webp') $im = @imagecreatefromwebp($src);
            else exit(1);
            if (!$im) exit(1);
            $ok = @imagewebp($im, $dst, $q);
            imagedestroy($im);
            exit($ok ? 0 : 1);"#,
            src_path.to_string_lossy().replace('\\', "/").replace('\'', "\\'"),
            dst_path.to_string_lossy().replace('\\', "/").replace('\'', "\\'"),
            quality.clamp(10, 100)
        );

        let status = create_hidden_command(&php_exe.to_string_lossy())
            .args(["-r", &php_code])
            .status();

        if status.map(|s| s.success()).unwrap_or(false) {
            converted_count += 1;
            let new_size = fs::metadata(&dst_path).map(|m| m.len() as i64).unwrap_or(old_size);
            if old_size > new_size {
                saved_bytes += old_size - new_size;
            }
        }
    }

    let saved_kb = (saved_bytes as f64 / 1024.0 * 10.0).round() / 10.0;
    Ok(format!(
        "Đã chuyển đổi {}/{} ảnh sang WebP (Tiết kiệm ~{} KB).",
        converted_count,
        rel_paths.len(),
        saved_kb
    ))
}

pub fn trim_project_images(
    site_name: &str,
    rel_paths: Vec<String>,
    tolerance: u8,
) -> Result<String, String> {
    let php_exe = find_php_exe().ok_or("Không tìm thấy PHP CLI trong bin/php để cắt viền ảnh.")?;
    let site_dir = config::get_sites_root_dir().join(site_name);
    let backup_root = config::get_base_dir()
        .join("tmp/img_backups")
        .join(site_name);

    let mut trimmed_count = 0;

    for rel in &rel_paths {
        let src_path = site_dir.join(rel);
        if !src_path.exists() {
            continue;
        }
        let bak_path = backup_root.join(rel);
        if !bak_path.exists() {
            if let Some(parent) = bak_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::copy(&src_path, &bak_path);
        }

        let php_code = format!(
            r#"$file = '{}'; $tol = {};
            $info = @getimagesize($file);
            if (!$info) exit(1);
            $mime = $info['mime'];
            if ($mime === 'image/png') $img = @imagecreatefrompng($file);
            elseif ($mime === 'image/jpeg') $img = @imagecreatefromjpeg($file);
            elseif ($mime === 'image/webp') $img = @imagecreatefromwebp($file);
            else exit(1);
            if (!$img) exit(1);
            $w = imagesx($img); $h = imagesy($img);
            $bg = imagecolorat($img, 0, 0);
            $bgR = ($bg >> 16) & 0xFF; $bgG = ($bg >> 8) & 0xFF; $bgB = $bg & 0xFF; $bgA = ($bg >> 24) & 0x7F;
            $isBg = function($c) use ($bgR, $bgG, $bgB, $bgA, $tol) {{
                $a = ($c >> 24) & 0x7F;
                if ($bgA > 115 && $a > 115) return true;
                if (abs($a - $bgA) > 15) return false;
                $r = ($c >> 16) & 0xFF; $g = ($c >> 8) & 0xFF; $b = $c & 0xFF;
                return (abs($r - $bgR) <= $tol && abs($g - $bgG) <= $tol && abs($b - $bgB) <= $tol);
            }};
            $top = 0; $bottom = $h - 1; $left = 0; $right = $w - 1;
            for (; $top < $h; $top++) {{ for ($x = 0; $x < $w; $x++) if (!$isBg(imagecolorat($img, $x, $top))) break 2; }}
            if ($top >= $h) {{ imagedestroy($img); exit(1); }}
            for (; $bottom > $top; $bottom--) {{ for ($x = 0; $x < $w; $x++) if (!$isBg(imagecolorat($img, $x, $bottom))) break 2; }}
            for (; $left < $w; $left++) {{ for ($y = $top; $y <= $bottom; $y++) if (!$isBg(imagecolorat($img, $left, $y))) break 2; }}
            for (; $right > $left; $right--) {{ for ($y = $top; $y <= $bottom; $y++) if (!$isBg(imagecolorat($img, $right, $y))) break 2; }}
            $nw = $right - $left + 1; $nh = $bottom - $top + 1;
            if ($nw >= $w && $nh >= $h) {{ imagedestroy($img); exit(0); }}
            $dst = imagecreatetruecolor($nw, $nh);
            imagealphablending($dst, false); imagesavealpha($dst, true);
            $trans = imagecolorallocatealpha($dst, 255, 255, 255, 127);
            imagefilledrectangle($dst, 0, 0, $nw, $nh, $trans);
            imagecopy($dst, $img, 0, 0, $left, $top, $nw, $nh);
            if ($mime === 'image/png') imagepng($dst, $file, 6);
            elseif ($mime === 'image/jpeg') imagejpeg($dst, $file, 90);
            elseif ($mime === 'image/webp') imagewebp($dst, $file, 90);
            imagedestroy($img); imagedestroy($dst);
            exit(0);"#,
            src_path.to_string_lossy().replace('\\', "/").replace('\'', "\\'"),
            tolerance.clamp(1, 100)
        );

        let status = create_hidden_command(&php_exe.to_string_lossy())
            .args(["-r", &php_code])
            .status();

        if status.map(|s| s.success()).unwrap_or(false) {
            trimmed_count += 1;
        }
    }

    Ok(format!(
        "Đã cắt viền thừa thành công {}/{} hình ảnh.",
        trimmed_count,
        rel_paths.len()
    ))
}

pub fn undo_project_images(site_name: &str, rel_paths: Vec<String>) -> Result<String, String> {
    let site_dir = config::get_sites_root_dir().join(site_name);
    let backup_root = config::get_base_dir()
        .join("tmp/img_backups")
        .join(site_name);

    let mut restored = 0;
    for rel in &rel_paths {
        let bak_path = backup_root.join(rel);
        let dst_path = site_dir.join(rel);
        if bak_path.exists() {
            if fs::copy(&bak_path, &dst_path).is_ok() {
                let _ = fs::remove_file(&bak_path);
                restored += 1;
            }
        }
    }
    Ok(format!("Đã khôi phục {} ảnh về bản gốc.", restored))
}

// ============================================================================
// 3. AUTO MEDIA RATIO SCANNER & DB SEEDER
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRatioRule {
    pub config_file: String,
    pub type_key: String,
    pub expected_w: u32,
    pub expected_h: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRatioMismatch {
    pub rel_path: String,
    pub matched_type: String,
    pub actual_w: u32,
    pub actual_h: u32,
    pub expected_w: u32,
    pub expected_h: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaScanReport {
    pub rules: Vec<MediaRatioRule>,
    pub mismatches: Vec<MediaRatioMismatch>,
    pub total_scanned: usize,
}

pub fn scan_media_ratios(site_name: &str) -> Result<MediaScanReport, String> {
    let site_dir = config::get_sites_root_dir().join(site_name);
    if !site_dir.exists() {
        return Err(format!("Không tìm thấy dự án: {}", site_name));
    }

    let mut rules = Vec::new();
    let cfg_dir = site_dir.join("config");
    let re_dim = Regex::new(r"['\x22]([a-zA-Z0-9_-]+)['\x22][\s\S]{0,600}?(\d{2,4})\s*x\s*(\d{2,4})").unwrap();

    if cfg_dir.exists() {
        if let Ok(entries) = fs::read_dir(&cfg_dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if fname.starts_with("type") && fname.ends_with(".php") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        for cap in re_dim.captures_iter(&content) {
                            let key = cap[1].to_string();
                            let w: u32 = cap[2].parse().unwrap_or(0);
                            let h: u32 = cap[3].parse().unwrap_or(0);
                            if w > 0 && h > 0 && !matches!(key.as_str(), "width" | "height" | "thumb" | "ratio") {
                                rules.push(MediaRatioRule {
                                    config_file: fname.clone(),
                                    type_key: key,
                                    expected_w: w,
                                    expected_h: h,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    let all_images = scan_project_images(site_name)?;
    let mut mismatches = Vec::new();

    for img in &all_images {
        if img.width == 0 || img.height == 0 {
            continue;
        }
        let lower_path = img.rel_path.to_lowercase();
        for rule in &rules {
            let key_lower = rule.type_key.to_lowercase();
            if lower_path.contains(&key_lower) {
                let exp_ratio = rule.expected_w as f64 / rule.expected_h as f64;
                let act_ratio = img.width as f64 / img.height as f64;
                if (exp_ratio - act_ratio).abs() > 0.08 {
                    mismatches.push(MediaRatioMismatch {
                        rel_path: img.rel_path.clone(),
                        matched_type: rule.type_key.clone(),
                        actual_w: img.width,
                        actual_h: img.height,
                        expected_w: rule.expected_w,
                        expected_h: rule.expected_h,
                    });
                }
                break;
            }
        }
    }

    Ok(MediaScanReport {
        rules,
        mismatches,
        total_scanned: all_images.len(),
    })
}

pub fn seed_project_sample_data(
    site_name: &str,
    type_key: &str,
    count: usize,
) -> Result<String, String> {
    let php_exe = find_php_exe().ok_or("Không tìm thấy PHP CLI để chạy Seeder.")?;
    let site_dir = config::get_sites_root_dir().join(site_name);
    if !site_dir.exists() {
        return Err("Thư mục dự án không tồn tại.".to_string());
    }

    let env_path = site_dir.join(".env");
    let env_content = fs::read_to_string(&env_path).unwrap_or_default();
    let mut db_name = String::new();
    let mut db_user = "root".to_string();
    let mut db_pass = String::new();
    let mut db_prefix = "table_".to_string();

    for line in env_content.lines() {
        let t = line.trim();
        if t.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = t.split_once('=') {
            let k = k.trim();
            let v = v.trim().trim_matches('"').trim_matches('\'');
            match k {
                "DB_DATABASE" | "DATABASE_NAME" => db_name = v.to_string(),
                "DB_USERNAME" | "DATABASE_USER" => db_user = v.to_string(),
                "DB_PASSWORD" | "DATABASE_PASS" => db_pass = v.to_string(),
                "DB_PREFIX" => db_prefix = v.to_string(),
                _ => {}
            }
        }
    }

    if db_name.is_empty() {
        return Err("Không tìm thấy cấu hình DB_DATABASE trong file .env của dự án.".to_string());
    }

    let settings = config::load_app_settings();
    let mysql_port = settings.mysql_port;
    let count = count.clamp(1, 50);

    let php_code = format!(
        r#"
        try {{
            $pdo = new PDO('mysql:host=127.0.0.1;port={port};dbname={db};charset=utf8mb4', '{user}', '{pass}', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ]);
            $prefix = '{prefix}';
            $type = '{type_key}';
            $count = {count};
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            $targetTable = '';
            foreach ([$prefix.'product', $prefix.'news', 'product', 'news'] as $cand) {{
                if (in_array($cand, $tables)) {{ $targetTable = $cand; break; }}
            }}
            if (!$targetTable) {{ echo "Không tìm thấy bảng product/news trong DB."; exit(1); }}
            $cols = $pdo->query("SHOW COLUMNS FROM `$targetTable`")->fetchAll(PDO::FETCH_COLUMN);
            $now = time();
            $inserted = 0;
            for ($i = 1; $i <= $count; $i++) {{
                $nameVi = ucfirst(str_replace('-', ' ', $type)) . " mẫu số " . $i . " (" . rand(100,999) . ")";
                $slugVi = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $type)) . "-mau-so-" . $i . "-" . rand(1000,9999);
                $data = [];
                if (in_array('namevi', $cols)) $data['namevi'] = $nameVi;
                if (in_array('slugvi', $cols)) $data['slugvi'] = $slugVi;
                if (in_array('descvi', $cols)) $data['descvi'] = "Mô tả tóm tắt tự động cho " . $nameVi . " phục vụ kiểm thử giao diện chuẩn SEO.";
                if (in_array('contentvi', $cols)) $data['contentvi'] = "<p>Nội dung chi tiết của <strong>$nameVi</strong> được tạo tự động bởi RBW Pro Seeder.</p>";
                if (in_array('type', $cols)) $data['type'] = $type;
                if (in_array('status', $cols)) $data['status'] = 'hienthi,noibat';
                if (in_array('numb', $cols)) $data['numb'] = $i;
                if (in_array('regular_price', $cols)) $data['regular_price'] = rand(15, 95) * 10000;
                if (in_array('date_created', $cols)) $data['date_created'] = $now;
                $fields = implode(',', array_map(fn($k) => "`$k`", array_keys($data)));
                $placeholders = implode(',', array_fill(0, count($data), '?'));
                $stmt = $pdo->prepare("INSERT INTO `$targetTable` ($fields) VALUES ($placeholders)");
                $stmt->execute(array_values($data));
                $inserted++;
            }}
            echo "Đã tạo thành công $inserted bản ghi mẫu (type: $type) vào bảng $targetTable.";
            exit(0);
        }} catch (Exception $e) {{
            echo "Lỗi DB Seeder: " . $e->getMessage();
            exit(1);
        }}
        "#,
        port = mysql_port,
        db = db_name,
        user = db_user,
        pass = db_pass,
        prefix = db_prefix,
        type_key = type_key.replace('\'', ""),
        count = count
    );

    let out = create_hidden_command(&php_exe.to_string_lossy())
        .args(["-r", &php_code])
        .output()
        .map_err(|e| e.to_string())?;

    let msg = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() {
        Ok(msg)
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if !msg.is_empty() { msg } else { err })
    }
}

// ============================================================================
// 4. SCHEMA BUILDER (CONFIG/TYPE-*.PHP)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaFileInfo {
    pub file_name: String,
    pub rel_path: String,
    pub size_bytes: u64,
}

pub fn list_project_schema_files(site_name: &str) -> Result<Vec<SchemaFileInfo>, String> {
    let site_dir = config::get_sites_root_dir().join(site_name);
    if !site_dir.exists() {
        return Err("Dự án không tồn tại.".to_string());
    }

    let mut list = Vec::new();
    let dirs_to_check = ["config", "libraries/type"];

    for sub in &dirs_to_check {
        let d = site_dir.join(sub);
        if d.exists() && d.is_dir() {
            if let Ok(entries) = fs::read_dir(&d) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        if fname.ends_with(".php") && (fname.contains("type") || *sub == "libraries/type") {
                            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            list.push(SchemaFileInfo {
                                file_name: fname.clone(),
                                rel_path: format!("{}/{}", sub, fname),
                                size_bytes,
                            });
                        }
                    }
                }
            }
        }
    }

    list.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(list)
}

pub fn read_project_schema_file(site_name: &str, rel_path: &str) -> Result<String, String> {
    let clean_rel = rel_path.trim_start_matches('/').replace("..", "");
    let full = config::get_sites_root_dir().join(site_name).join(clean_rel);
    fs::read_to_string(&full).map_err(|e| format!("Không thể đọc file {}: {}", rel_path, e))
}

pub fn save_project_schema_file(
    site_name: &str,
    rel_path: &str,
    content: &str,
) -> Result<String, String> {
    let clean_rel = rel_path.trim_start_matches('/').replace("..", "");
    let full = config::get_sites_root_dir().join(site_name).join(&clean_rel);
    if let Some(parent) = full.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&full, content).map_err(|e| format!("Lỗi lưu file {}: {}", clean_rel, e))?;
    Ok(format!("Đã lưu cấu hình Schema: {}", clean_rel))
}

// ============================================================================
// 5. CACHE CLEANER & AI KEY CHECKER
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStatItem {
    pub site_name: String,
    pub compiled_files: usize,
    pub log_files: usize,
    pub total_kb: f64,
}

pub fn scan_projects_cache() -> Vec<CacheStatItem> {
    let sites_root = config::get_sites_root_dir();
    let mut results = Vec::new();

    if let Ok(entries) = fs::read_dir(&sites_root) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }

            let mut compiled_files = 0;
            let mut log_files = 0;
            let mut total_bytes: u64 = 0;

            let cache_dirs = [
                "compiled",
                "caches",
                "storage/framework/views",
                "storage/framework/cache/data",
                "bootstrap/cache",
            ];
            for cd in &cache_dirs {
                let d = p.join(cd);
                if d.exists() {
                    count_dir_files(&d, &mut compiled_files, &mut total_bytes);
                }
            }

            let log_dirs = ["logs", "storage/logs"];
            for ld in &log_dirs {
                let d = p.join(ld);
                if d.exists() {
                    count_dir_files(&d, &mut log_files, &mut total_bytes);
                }
            }

            results.push(CacheStatItem {
                site_name: name,
                compiled_files,
                log_files,
                total_kb: (total_bytes as f64 / 1024.0 * 10.0).round() / 10.0,
            });
        }
    }

    results.sort_by(|a, b| b.total_kb.partial_cmp(&a.total_kb).unwrap_or(std::cmp::Ordering::Equal));
    results
}

fn count_dir_files(dir: &Path, count: &mut usize, bytes: &mut u64) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with('.') {
                continue;
            }
            if p.is_dir() {
                count_dir_files(&p, count, bytes);
            } else if let Ok(m) = entry.metadata() {
                *count += 1;
                *bytes += m.len();
            }
        }
    }
}

pub fn clean_project_cache(site_name: &str) -> Result<String, String> {
    let sites_root = config::get_sites_root_dir();
    let targets: Vec<PathBuf> = if site_name == "__ALL__" {
        fs::read_dir(&sites_root)
            .map(|rd| rd.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect())
            .unwrap_or_default()
    } else {
        vec![sites_root.join(site_name)]
    };

    let mut deleted_count = 0;
    let mut freed_bytes: u64 = 0;

    let clean_subdirs = [
        "compiled",
        "caches",
        "storage/framework/views",
        "storage/framework/cache/data",
        "storage/logs",
        "logs",
    ];

    for proj in targets {
        for sub in &clean_subdirs {
            let d = proj.join(sub);
            if d.exists() {
                clean_dir_files(&d, &mut deleted_count, &mut freed_bytes);
            }
        }
    }

    let freed_kb = (freed_bytes as f64 / 1024.0 * 10.0).round() / 10.0;
    Ok(format!(
        "Đã dọn sạch {} file cache/log (Giải phóng {} KB).",
        deleted_count, freed_kb
    ))
}

fn clean_dir_files(dir: &Path, deleted: &mut usize, bytes: &mut u64) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with('.') {
                continue;
            }
            if p.is_dir() {
                clean_dir_files(&p, deleted, bytes);
            } else {
                let len = entry.metadata().map(|m| m.len()).unwrap_or(0);
                if fs::remove_file(&p).is_ok() {
                    *deleted += 1;
                    *bytes += len;
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckResult {
    pub provider: String,
    pub valid: bool,
    pub status_code: u16,
    pub latency_ms: u64,
    pub message: String,
    pub models: Vec<String>,
}

pub fn check_ai_api_key(provider: &str, api_key: &str) -> Result<AiCheckResult, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Vui lòng nhập API Key để kiểm tra.".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let start = Instant::now();

    if provider.eq_ignore_ascii_case("claude") || provider.eq_ignore_ascii_case("anthropic") {
        let res = client
            .get("https://api.anthropic.com/v1/models")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .map_err(|e| format!("Lỗi kết nối Anthropic API: {}", e))?;

        let latency_ms = start.elapsed().as_millis() as u64;
        let status_code = res.status().as_u16();
        let body: serde_json::Value = res.json().unwrap_or(serde_json::Value::Null);

        if status_code == 200 {
            let mut models = Vec::new();
            if let Some(arr) = body.get("data").and_then(|d| d.as_array()) {
                for m in arr {
                    if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                        models.push(id.to_string());
                    }
                }
            }
            Ok(AiCheckResult {
                provider: "Anthropic Claude".to_string(),
                valid: true,
                status_code,
                latency_ms,
                message: format!("API Key hợp lệ ({} models khả dụng)", models.len()),
                models,
            })
        } else {
            let err_msg = body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("API Key không hợp lệ hoặc hết hạn mức.");
            Ok(AiCheckResult {
                provider: "Anthropic Claude".to_string(),
                valid: false,
                status_code,
                latency_ms,
                message: err_msg.to_string(),
                models: vec![],
            })
        }
    } else {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            key
        );
        let res = client
            .get(&url)
            .send()
            .map_err(|e| format!("Lỗi kết nối Google Gemini API: {}", e))?;

        let latency_ms = start.elapsed().as_millis() as u64;
        let status_code = res.status().as_u16();
        let body: serde_json::Value = res.json().unwrap_or(serde_json::Value::Null);

        if status_code == 200 {
            let mut models = Vec::new();
            if let Some(arr) = body.get("models").and_then(|d| d.as_array()) {
                for m in arr {
                    if let Some(name) = m.get("name").and_then(|i| i.as_str()) {
                        let short = name.strip_prefix("models/").unwrap_or(name);
                        if short.contains("gemini") {
                            models.push(short.to_string());
                        }
                    }
                }
            }
            Ok(AiCheckResult {
                provider: "Google Gemini".to_string(),
                valid: true,
                status_code,
                latency_ms,
                message: format!("API Key hoạt động tốt ({} Gemini models)", models.len()),
                models,
            })
        } else {
            let err_msg = body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Gemini API Key không hợp lệ.");
            Ok(AiCheckResult {
                provider: "Google Gemini".to_string(),
                valid: false,
                status_code,
                latency_ms,
                message: err_msg.to_string(),
                models: vec![],
            })
        }
    }
}

// ============================================================================
// 6. SYNC CENTER & SNAPSHOT BACKUPS (LOCAL ⇄ DEMO)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFileItem {
    pub rel_path: String,
    pub status: String, // "modified" | "added" | "remote_newer"
    pub local_size: u64,
    pub modified_at: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncBackupItem {
    pub backup_id: String,
    pub rel_path: String,
    pub created_at: String,
    pub size_kb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncCenterReport {
    pub site_name: String,
    pub demo_url: String,
    pub files: Vec<SyncFileItem>,
    pub backups: Vec<SyncBackupItem>,
}

pub fn scan_sync_center(site_name: &str) -> Result<SyncCenterReport, String> {
    let site_dir = config::get_sites_root_dir().join(site_name);
    if !site_dir.exists() {
        return Err("Dự án không tồn tại.".to_string());
    }

    let init = crate::deploy::get_deploy_init_data(site_name);
    let mut files = Vec::new();
    let sync_state_file = config::get_base_dir()
        .join("config")
        .join(format!("sync_manifest_{}.json", site_name));
    let last_manifest: HashMap<String, u64> = fs::read_to_string(&sync_state_file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let watch_dirs = [
        "app",
        "config",
        "resources/views",
        "routes",
        "assets/css",
        "assets/js",
        "sources",
        "templates",
        "libraries",
    ];

    for wd in &watch_dirs {
        let d = site_dir.join(wd);
        if d.exists() {
            collect_sync_files(&site_dir, &d, wd, &last_manifest, &mut files);
        }
    }

    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    let backups = list_sync_backups(site_name);

    Ok(SyncCenterReport {
        site_name: site_name.to_string(),
        demo_url: init.target_url,
        files,
        backups,
    })
}

fn collect_sync_files(
    base: &Path,
    dir: &Path,
    category: &str,
    manifest: &HashMap<String, u64>,
    out: &mut Vec<SyncFileItem>,
) {
    if out.len() >= 500 {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let p = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        if fname.starts_with('.') {
            continue;
        }
        if p.is_dir() {
            collect_sync_files(base, &p, category, manifest, out);
        } else if let Ok(meta) = entry.metadata() {
            let mtime_secs = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let size = meta.len();
            let sig = mtime_secs ^ (size << 16);
            if let Ok(rel) = p.strip_prefix(base) {
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                let status = match manifest.get(&rel_str) {
                    None => "added",
                    Some(&old_sig) if old_sig != sig => "modified",
                    _ => continue,
                };
                let dt = chrono::DateTime::from_timestamp(mtime_secs as i64, 0)
                    .map(|d| d.format("%d/%m/%Y %H:%M").to_string())
                    .unwrap_or_default();
                out.push(SyncFileItem {
                    rel_path: rel_str,
                    status: status.to_string(),
                    local_size: size,
                    modified_at: dt,
                    category: category.to_string(),
                });
            }
        }
    }
}

pub fn create_sync_snapshot(site_name: &str, rel_paths: Vec<String>) -> Result<String, String> {
    let site_dir = config::get_sites_root_dir().join(site_name);
    let snap_root = config::get_base_dir()
        .join("tmp/sync_snapshots")
        .join(site_name);
    let _ = fs::create_dir_all(&snap_root);

    let ts = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let mut count = 0;

    let sync_state_file = config::get_base_dir()
        .join("config")
        .join(format!("sync_manifest_{}.json", site_name));
    let mut manifest: HashMap<String, u64> = fs::read_to_string(&sync_state_file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let demo_cfg = config::load_demo_config();
    let has_ftp = !demo_cfg.ftp_host.trim().is_empty() && !demo_cfg.ftp_user.trim().is_empty();
    let mut remote_uploaded = 0;

    for rel in &rel_paths {
        let clean = rel.trim_start_matches('/').replace("..", "");
        let src = site_dir.join(&clean);
        if !src.exists() {
            continue;
        }
        let encoded_name = format!("{}__{}", ts, clean.replace('/', "__"));
        let dst = snap_root.join(encoded_name);
        if fs::copy(&src, &dst).is_ok() {
            count += 1;
            if has_ftp {
                if crate::deploy::ftp_upload_file(&demo_cfg, site_name, &src, &clean).is_ok() {
                    remote_uploaded += 1;
                }
            }
            if let Ok(meta) = fs::metadata(&src) {
                let mtime_secs = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                manifest.insert(clean, mtime_secs ^ (meta.len() << 16));
            }
        }
    }

    if let Ok(json) = serde_json::to_string_pretty(&manifest) {
        let _ = fs::write(&sync_state_file, json);
    }

    if has_ftp {
        Ok(format!(
            "Đã tạo Snapshot ({} file) & đẩy {} file lên Demo FTP thành công.",
            count, remote_uploaded
        ))
    } else {
        Ok(format!(
            "Đã đồng bộ & lưu Snapshot an toàn cho {} file.",
            count
        ))
    }
}

pub fn list_sync_backups(site_name: &str) -> Vec<SyncBackupItem> {
    let snap_root = config::get_base_dir()
        .join("tmp/sync_snapshots")
        .join(site_name);
    let mut items = Vec::new();
    if let Ok(entries) = fs::read_dir(&snap_root) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if let Some((ts, rest)) = fname.split_once("__") {
                let rel_path = rest.replace("__", "/");
                let created_at = ts.replace('_', " ");
                let size_kb = entry
                    .metadata()
                    .map(|m| (m.len() as f64 / 1024.0 * 10.0).round() / 10.0)
                    .unwrap_or(0.0);
                items.push(SyncBackupItem {
                    backup_id: fname,
                    rel_path,
                    created_at,
                    size_kb,
                });
            }
        }
    }
    items.sort_by(|a, b| b.backup_id.cmp(&a.backup_id));
    items
}

pub fn restore_sync_snapshot(site_name: &str, backup_id: &str) -> Result<String, String> {
    let snap_file = config::get_base_dir()
        .join("tmp/sync_snapshots")
        .join(site_name)
        .join(backup_id);
    if !snap_file.exists() {
        return Err("Bản sao lưu không tồn tại.".to_string());
    }
    let (_, rest) = backup_id
        .split_once("__")
        .ok_or("Định dạng tên snapshot không hợp lệ.")?;
    let rel_path = rest.replace("__", "/");
    let dst = config::get_sites_root_dir().join(site_name).join(&rel_path);
    if let Some(p) = dst.parent() {
        let _ = fs::create_dir_all(p);
    }
    fs::copy(&snap_file, &dst).map_err(|e| e.to_string())?;
    Ok(format!("Đã khôi phục file {} từ Snapshot.", rel_path))
}

pub fn delete_sync_snapshot(site_name: &str, backup_id: &str) -> Result<String, String> {
    let snap_file = config::get_base_dir()
        .join("tmp/sync_snapshots")
        .join(site_name)
        .join(backup_id);
    if snap_file.exists() {
        let _ = fs::remove_file(snap_file);
    }
    Ok("Đã xóa bản Snapshot.".to_string())
}
