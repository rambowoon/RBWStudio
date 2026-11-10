use crate::config;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFontFamily {
    pub family_name: String,
    pub variants: Vec<LocalFontVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFontVariant {
    pub file_name: String,
    pub file_path: String,
    pub weight: u16,
    pub style: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleFontItem {
    pub family: String,
    pub category: String,
    pub variants: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledFontInfo {
    pub family_name: String,
    pub source_type: String, // "local" | "google-import" | "google-selfhost"
    pub folder_name: String,
}

pub fn scan_local_fonts(folder_path: &str) -> Vec<LocalFontFamily> {
    let dir = if folder_path.trim().is_empty() {
        let cfg = config::load_demo_config();
        cfg.font_folder_path
    } else {
        folder_path.to_string()
    };

    let p = Path::new(&dir);
    if !p.exists() || !p.is_dir() {
        return Vec::new();
    }

    let mut families: HashMap<String, Vec<LocalFontVariant>> = HashMap::new();
    let mut files: Vec<PathBuf> = Vec::new();
    collect_font_files_recursive(p, &mut files);

    for file in files {
        let file_name = file.file_name().unwrap_or_default().to_string_lossy().to_string();
        let stem = file.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let (family, weight, style, label) = parse_font_stem(&stem);

        families.entry(family).or_default().push(LocalFontVariant {
            file_name,
            file_path: file.to_string_lossy().to_string(),
            weight,
            style,
            label,
        });
    }

    let mut result: Vec<LocalFontFamily> = families
        .into_iter()
        .map(|(family_name, mut variants)| {
            variants.sort_by_key(|v| v.weight);
            LocalFontFamily { family_name, variants }
        })
        .collect();

    result.sort_by(|a, b| a.family_name.to_lowercase().cmp(&b.family_name.to_lowercase()));
    result
}

fn collect_font_files_recursive(dir: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                collect_font_files_recursive(&p, out);
            } else if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                let lower = ext.to_lowercase();
                if matches!(lower.as_str(), "ttf" | "otf" | "woff" | "woff2") {
                    out.push(p);
                }
            }
        }
    }
}

fn parse_font_stem(stem: &str) -> (String, u16, String, String) {
    let lower = stem.to_lowercase();
    let style = if lower.contains("italic") || lower.ends_with("it") {
        "italic".to_string()
    } else {
        "normal".to_string()
    };

    let (weight, weight_name) = if lower.contains("thin") || lower.contains("hairline") {
        (100, "Thin")
    } else if lower.contains("extralight") || lower.contains("ultralight") {
        (200, "ExtraLight")
    } else if lower.contains("light") {
        (300, "Light")
    } else if lower.contains("medium") {
        (500, "Medium")
    } else if lower.contains("semibold") || lower.contains("demibold") {
        (600, "SemiBold")
    } else if lower.contains("extrabold") || lower.contains("ultrabold") {
        (800, "ExtraBold")
    } else if lower.contains("black") || lower.contains("heavy") {
        (900, "Black")
    } else if lower.contains("bold") {
        (700, "Bold")
    } else {
        (400, "Regular")
    };

    let family = if let Some(idx) = stem.rfind('-') {
        stem[..idx].replace('_', " ").trim().to_string()
    } else {
        stem.replace('_', " ").trim().to_string()
    };

    let label = if style == "italic" && weight != 400 {
        format!("{} Italic ({})", weight_name, weight)
    } else if style == "italic" {
        "Italic (400)".to_string()
    } else {
        format!("{} ({})", weight_name, weight)
    };

    (family, weight, style, label)
}

pub fn convert_ttf_to_woff(font_bytes: &[u8]) -> Result<Vec<u8>, String> {
    if font_bytes.len() < 12 {
        return Err("File font không hợp lệ (quá ngắn).".to_string());
    }

    let flavor = u32::from_be_bytes([font_bytes[0], font_bytes[1], font_bytes[2], font_bytes[3]]);
    let num_tables = u16::from_be_bytes([font_bytes[4], font_bytes[5]]) as usize;

    if font_bytes.len() < 12 + num_tables * 16 {
        return Err("Bảng SFNT trong font không hợp lệ.".to_string());
    }

    struct TableRecord {
        tag: [u8; 4],
        orig_checksum: u32,
        offset: usize,
        orig_length: usize,
        comp_data: Vec<u8>,
    }

    let mut records: Vec<TableRecord> = Vec::with_capacity(num_tables);
    for i in 0..num_tables {
        let pos = 12 + i * 16;
        let tag = [
            font_bytes[pos],
            font_bytes[pos + 1],
            font_bytes[pos + 2],
            font_bytes[pos + 3],
        ];
        let orig_checksum = u32::from_be_bytes([
            font_bytes[pos + 4],
            font_bytes[pos + 5],
            font_bytes[pos + 6],
            font_bytes[pos + 7],
        ]);
        let offset = u32::from_be_bytes([
            font_bytes[pos + 8],
            font_bytes[pos + 9],
            font_bytes[pos + 10],
            font_bytes[pos + 11],
        ]) as usize;
        let orig_length = u32::from_be_bytes([
            font_bytes[pos + 12],
            font_bytes[pos + 13],
            font_bytes[pos + 14],
            font_bytes[pos + 15],
        ]) as usize;

        if offset + orig_length > font_bytes.len() {
            return Err("Dữ liệu bảng SFNT vượt quá kích thước file.".to_string());
        }

        let raw_slice = &font_bytes[offset..offset + orig_length];
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        let _ = encoder.write_all(raw_slice);
        let compressed = encoder.finish().unwrap_or_default();

        let comp_data = if !compressed.is_empty() && compressed.len() < orig_length {
            compressed
        } else {
            raw_slice.to_vec()
        };

        records.push(TableRecord {
            tag,
            orig_checksum,
            offset,
            orig_length,
            comp_data,
        });
    }

    // Sort by original offset to preserve SFNT order
    records.sort_by_key(|r| r.offset);

    let header_size = 44;
    let dir_size = num_tables * 20;
    let mut current_data_offset = header_size + dir_size;

    let mut total_sfnt_size = 12 + num_tables * 16;
    for r in &records {
        total_sfnt_size += (r.orig_length + 3) & !3;
        current_data_offset += (r.comp_data.len() + 3) & !3;
    }

    let total_woff_len = current_data_offset as u32;
    let mut out: Vec<u8> = Vec::with_capacity(current_data_offset);

    // WOFF Header (44 bytes)
    out.extend_from_slice(b"wOFF");
    out.extend_from_slice(&flavor.to_be_bytes());
    out.extend_from_slice(&total_woff_len.to_be_bytes());
    out.extend_from_slice(&(num_tables as u16).to_be_bytes());
    out.extend_from_slice(&0u16.to_be_bytes()); // reserved
    out.extend_from_slice(&(total_sfnt_size as u32).to_be_bytes());
    out.extend_from_slice(&1u16.to_be_bytes()); // majorVersion
    out.extend_from_slice(&0u16.to_be_bytes()); // minorVersion
    out.extend_from_slice(&0u32.to_be_bytes()); // metaOffset
    out.extend_from_slice(&0u32.to_be_bytes()); // metaLength
    out.extend_from_slice(&0u32.to_be_bytes()); // metaOrigLength
    out.extend_from_slice(&0u32.to_be_bytes()); // privOffset
    out.extend_from_slice(&0u32.to_be_bytes()); // privLength

    // Restore tag sort order for TableDirectory
    let mut running_offset = (header_size + dir_size) as u32;
    let mut offsets: Vec<u32> = Vec::with_capacity(num_tables);
    for r in &records {
        offsets.push(running_offset);
        running_offset += ((r.comp_data.len() + 3) & !3) as u32;
    }

    for (idx, r) in records.iter().enumerate() {
        out.extend_from_slice(&r.tag);
        out.extend_from_slice(&offsets[idx].to_be_bytes());
        out.extend_from_slice(&(r.comp_data.len() as u32).to_be_bytes());
        out.extend_from_slice(&(r.orig_length as u32).to_be_bytes());
        out.extend_from_slice(&r.orig_checksum.to_be_bytes());
    }

    for r in &records {
        out.extend_from_slice(&r.comp_data);
        let pad = ((r.comp_data.len() + 3) & !3) - r.comp_data.len();
        for _ in 0..pad {
            out.push(0);
        }
    }

    Ok(out)
}

pub fn install_local_font_to_project(
    project_path: &str,
    family_name: &str,
    selected_files: &[LocalFontVariant],
    convert_woff: bool,
) -> Result<String, String> {
    let proj = Path::new(project_path);
    if !proj.exists() {
        return Err("Thư mục dự án không tồn tại.".to_string());
    }

    let safe_folder: String = family_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();

    let fonts_dir = proj.join("assets/fonts").join(&safe_folder);
    let css_dir = proj.join("assets/css");
    fs::create_dir_all(&fonts_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&css_dir).map_err(|e| e.to_string())?;

    let mut css_block = format!("/* === Font: {} (Local) === */\n", family_name);

    for v in selected_files {
        let src = Path::new(&v.file_path);
        if !src.exists() {
            continue;
        }
        let ext = src
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("ttf")
            .to_lowercase();

        let (dest_filename, format_str) = if convert_woff && (ext == "ttf" || ext == "otf") {
            let stem = src.file_stem().unwrap_or_default().to_string_lossy();
            let woff_name = format!("{}.woff", stem);
            let raw = fs::read(src).map_err(|e| e.to_string())?;
            if let Ok(woff_bytes) = convert_ttf_to_woff(&raw) {
                fs::write(fonts_dir.join(&woff_name), woff_bytes).map_err(|e| e.to_string())?;
                (woff_name, "woff")
            } else {
                fs::copy(src, fonts_dir.join(&v.file_name)).map_err(|e| e.to_string())?;
                (v.file_name.clone(), if ext == "otf" { "opentype" } else { "truetype" })
            }
        } else {
            fs::copy(src, fonts_dir.join(&v.file_name)).map_err(|e| e.to_string())?;
            let fmt = match ext.as_str() {
                "woff2" => "woff2",
                "woff" => "woff",
                "otf" => "opentype",
                _ => "truetype",
            };
            (v.file_name.clone(), fmt)
        };

        css_block.push_str(&format!(
            "@font-face {{\n  font-family: '{}';\n  src: url('../fonts/{}/{}') format('{}');\n  font-weight: {};\n  font-style: {};\n  font-display: swap;\n}}\n",
            family_name, safe_folder, dest_filename, format_str, v.weight, v.style
        ));
    }
    css_block.push_str(&format!("/* === End Font: {} === */\n\n", family_name));

    let css_path = css_dir.join("fonts.css");
    let mut existing = fs::read_to_string(&css_path).unwrap_or_default();
    existing = remove_font_block_from_css(&existing, family_name);
    existing.push_str(&css_block);
    fs::write(&css_path, &existing).map_err(|e| e.to_string())?;

    Ok(existing)
}

pub fn fetch_google_fonts_list() -> Vec<GoogleFontItem> {
    let cache_path = config::get_data_file_path("google_fonts_cache.json");
    if cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&cache_path) {
            if let Ok(list) = serde_json::from_str::<Vec<GoogleFontItem>>(&content) {
                if !list.is_empty() {
                    return list;
                }
            }
        }
    }

    if let Ok(client) = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
    {
        if let Ok(resp) = client.get("https://fonts.google.com/metadata/fonts").send() {
            if let Ok(text) = resp.text() {
                let clean = text.trim_start_matches(")]}'").trim();
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(clean) {
                    if let Some(arr) = val.get("familyMetadataList").and_then(|v| v.as_array()) {
                        let mut out = Vec::new();
                        for item in arr.iter().take(350) {
                            let family = item
                                .get("family")
                                .and_then(|v| v.as_str())
                                .unwrap_or_default()
                                .to_string();
                            let category = item
                                .get("category")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Sans Serif")
                                .to_string();
                            let mut variants = Vec::new();
                            if let Some(fonts_obj) = item.get("fonts").and_then(|v| v.as_object()) {
                                for k in fonts_obj.keys() {
                                    variants.push(k.clone());
                                }
                            }
                            if variants.is_empty() {
                                variants = vec![
                                    "300".to_string(),
                                    "400".to_string(),
                                    "500".to_string(),
                                    "600".to_string(),
                                    "700".to_string(),
                                ];
                            }
                            if !family.is_empty() {
                                out.push(GoogleFontItem {
                                    family,
                                    category,
                                    variants,
                                });
                            }
                        }
                        if !out.is_empty() {
                            if let Ok(json) = serde_json::to_string(&out) {
                                let _ = fs::write(&cache_path, json);
                            }
                            return out;
                        }
                    }
                }
            }
        }
    }

    // Fallback popular Vietnamese & Web Google Fonts
    let popular = [
        ("Inter", "Sans Serif"),
        ("Roboto", "Sans Serif"),
        ("Montserrat", "Sans Serif"),
        ("Be Vietnam Pro", "Sans Serif"),
        ("Plus Jakarta Sans", "Sans Serif"),
        ("Open Sans", "Sans Serif"),
        ("Poppins", "Sans Serif"),
        ("Nunito", "Sans Serif"),
        ("Mulish", "Sans Serif"),
        ("Playfair Display", "Serif"),
        ("Lora", "Serif"),
        ("Merriweather", "Serif"),
        ("Oswald", "Display"),
        ("Lexend", "Sans Serif"),
        ("Manrope", "Sans Serif"),
        ("Quicksand", "Sans Serif"),
        ("Work Sans", "Sans Serif"),
        ("Source Sans 3", "Sans Serif"),
        ("Noto Sans", "Sans Serif"),
        ("Cormorant Garamond", "Serif"),
    ];

    popular
        .iter()
        .map(|(f, c)| GoogleFontItem {
            family: f.to_string(),
            category: c.to_string(),
            variants: vec![
                "300".to_string(),
                "400".to_string(),
                "400i".to_string(),
                "500".to_string(),
                "600".to_string(),
                "700".to_string(),
                "800".to_string(),
            ],
        })
        .collect()
}

pub fn install_google_font_to_project(
    project_path: &str,
    family_name: &str,
    weights: &[String],
    mode: &str, // "import" | "selfhost"
) -> Result<String, String> {
    let proj = Path::new(project_path);
    let css_dir = proj.join("assets/css");
    fs::create_dir_all(&css_dir).map_err(|e| e.to_string())?;
    let css_path = css_dir.join("fonts.css");

    let family_encoded = family_name.replace(' ', "+");
    let mut normal_weights: Vec<String> = Vec::new();
    let mut italic_weights: Vec<String> = Vec::new();

    for w in weights {
        if w.ends_with('i') {
            italic_weights.push(w.trim_end_matches('i').to_string());
        } else {
            normal_weights.push(w.clone());
        }
    }
    if normal_weights.is_empty() && italic_weights.is_empty() {
        normal_weights = vec!["400".to_string(), "500".to_string(), "700".to_string()];
    }

    let google_url = if italic_weights.is_empty() {
        format!(
            "https://fonts.googleapis.com/css2?family={}:wght@{}&display=swap",
            family_encoded,
            normal_weights.join(";")
        )
    } else {
        let mut tuples = Vec::new();
        for w in &normal_weights {
            tuples.push(format!("0,{}", w));
        }
        for w in &italic_weights {
            tuples.push(format!("1,{}", w));
        }
        tuples.sort();
        format!(
            "https://fonts.googleapis.com/css2?family={}:ital,wght@{}&display=swap",
            family_encoded,
            tuples.join(";")
        )
    };

    let mut css_block = format!("/* === Font: {} (Google) === */\n", family_name);

    if mode == "import" {
        css_block.push_str(&format!("@import url('{}');\n", google_url));
    } else {
        // Self-host WOFF2
        let safe_folder: String = family_name
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
            .collect();
        let fonts_dir = proj.join("assets/fonts").join(&safe_folder);
        fs::create_dir_all(&fonts_dir).map_err(|e| e.to_string())?;

        let client = reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let raw_css = client
            .get(&google_url)
            .send()
            .map_err(|e| e.to_string())?
            .text()
            .map_err(|e| e.to_string())?;

        let re_url = Regex::new(r"url\((https://[^)]+\.woff2)\)").unwrap();
        let mut idx = 1;
        let mut localized_css = raw_css.clone();

        for caps in re_url.captures_iter(&raw_css) {
            let remote_url = &caps[1];
            let local_filename = format!("{}-{}.woff2", safe_folder.to_lowercase(), idx);
            idx += 1;

            if let Ok(resp) = client.get(remote_url).send() {
                if let Ok(bytes) = resp.bytes() {
                    let _ = fs::write(fonts_dir.join(&local_filename), &bytes);
                    localized_css = localized_css.replace(
                        remote_url,
                        &format!("'../fonts/{}/{}'", safe_folder, local_filename),
                    );
                }
            }
        }
        css_block.push_str(&localized_css);
        if !css_block.ends_with('\n') {
            css_block.push('\n');
        }
    }

    css_block.push_str(&format!("/* === End Font: {} === */\n\n", family_name));

    let mut existing = fs::read_to_string(&css_path).unwrap_or_default();
    existing = remove_font_block_from_css(&existing, family_name);
    existing.push_str(&css_block);
    fs::write(&css_path, &existing).map_err(|e| e.to_string())?;

    Ok(existing)
}

pub fn get_project_fonts_info(project_path: &str) -> (String, Vec<InstalledFontInfo>) {
    let proj = Path::new(project_path);
    let css_path = proj.join("assets/css/fonts.css");
    let css_content = fs::read_to_string(&css_path).unwrap_or_default();

    let mut installed = Vec::new();
    let re = Regex::new(r"/\* === Font: ([^(\n]+?)(?: \((Local|Google)\))? === \*/").unwrap();
    for caps in re.captures_iter(&css_content) {
        let family_name = caps[1].trim().to_string();
        let source_type = caps.get(2).map(|m| m.as_str()).unwrap_or("Local").to_string();
        let safe_folder: String = family_name
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
            .collect();
        installed.push(InstalledFontInfo {
            family_name,
            source_type,
            folder_name: safe_folder,
        });
    }

    (css_content, installed)
}

pub fn uninstall_font_from_project(project_path: &str, family_name: &str) -> Result<String, String> {
    let proj = Path::new(project_path);
    let css_path = proj.join("assets/css/fonts.css");
    let safe_folder: String = family_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();

    let font_dir = proj.join("assets/fonts").join(&safe_folder);
    if font_dir.exists() {
        let _ = fs::remove_dir_all(&font_dir);
    }

    if css_path.exists() {
        let content = fs::read_to_string(&css_path).unwrap_or_default();
        let updated = remove_font_block_from_css(&content, family_name);
        fs::write(&css_path, &updated).map_err(|e| e.to_string())?;
        return Ok(updated);
    }
    Ok(String::new())
}

fn remove_font_block_from_css(css: &str, family_name: &str) -> String {
    let start_marker = format!("/* === Font: {}", family_name);
    let end_marker = format!("/* === End Font: {} === */", family_name);
    if let Some(start_idx) = css.find(&start_marker) {
        if let Some(end_rel) = css[start_idx..].find(&end_marker) {
            let remove_end = start_idx + end_rel + end_marker.len();
            let mut result = String::new();
            result.push_str(&css[..start_idx]);
            result.push_str(css[remove_end..].trim_start_matches(&['\r', '\n'][..]));
            return result;
        }
    }
    css.to_string()
}

