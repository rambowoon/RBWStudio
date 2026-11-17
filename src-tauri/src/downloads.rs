use crate::config;
use crate::services;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
    pub id: String,
    pub category: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub url: String,
    pub installed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressEvent {
    pub id: String,
    pub progress: u8,
    pub status: String,
    pub done: bool,
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreSyncedEvent {
    pub items: Vec<DownloadItem>,
    pub online: bool,
}

static CACHED_ONLINE_ITEMS: Mutex<Option<Vec<DownloadItem>>> = Mutex::new(None);

fn parse_ver_tuple(ver: &str) -> (u32, u32, u32) {
    let clean = ver
        .trim_start_matches("php-")
        .trim_start_matches("httpd-")
        .trim_start_matches("nginx-")
        .trim_start_matches("mariadb-")
        .trim_start_matches("mysql-")
        .trim_start_matches("node-v")
        .trim_start_matches('v');
    let parts: Vec<u32> = clean
        .split('.')
        .map(|s| s.parse::<u32>().unwrap_or(0))
        .collect();
    (
        *parts.first().unwrap_or(&0),
        *parts.get(1).unwrap_or(&0),
        *parts.get(2).unwrap_or(&0),
    )
}

fn is_vc_runtime_installed() -> bool {
    #[cfg(target_os = "windows")]
    {
        let sys_dll = Path::new(r"C:\Windows\System32\vcruntime140.dll");
        sys_dll.exists()
    }
    #[cfg(not(target_os = "windows"))]
    {
        true
    }
}

pub fn refresh_installed_flags(items: &mut [DownloadItem]) {
    let base = config::get_base_dir();
    let pma_installed = services::is_phpmyadmin_installed();
    let cf_installed = services::is_cloudflared_installed();
    let vc_installed = is_vc_runtime_installed();
    let installed_php = services::list_installed_versions("php");
    let installed_apache = services::list_installed_versions("apache");
    let installed_nginx = services::list_installed_versions("nginx");
    let installed_mysql = services::list_installed_versions("mysql");
    let installed_nodejs = services::list_installed_versions("nodejs");

    for item in items.iter_mut() {
        item.installed = match item.category.as_str() {
            "phpmyadmin" => {
                if item.version.starts_with('4') {
                    base.join("phpmyadmin-old/index.php").exists()
                } else {
                    pma_installed
                }
            }
            "vcredist" => {
                if item.id.contains("cloudflared") {
                    cf_installed
                } else if item.id.contains("nasani-extension") {
                    base.join("extensions").join("nasani-sync").join("manifest.json").exists()
                } else {
                    vc_installed
                }
            }
            cat => {
                let list_for_cat = match cat {
                    "php" => &installed_php,
                    "apache" => &installed_apache,
                    "nginx" => &installed_nginx,
                    "mysql" => &installed_mysql,
                    "nodejs" => &installed_nodejs,
                    _ => &installed_php,
                };
                base.join("bin").join(cat).join(&item.version).exists()
                    || (cat != "_" && list_for_cat.iter().any(|v| v == &item.version))
            }
        };
    }
}

pub fn get_store_items() -> Vec<DownloadItem> {
    if let Ok(guard) = CACHED_ONLINE_ITEMS.lock() {
        if let Some(ref cached) = *guard {
            let mut cloned = cached.clone();
            refresh_installed_flags(&mut cloned);
            return cloned;
        }
    }

    let mut fallback = get_offline_fallback_items();
    refresh_installed_flags(&mut fallback);
    fallback
}

pub fn get_offline_fallback_items() -> Vec<DownloadItem> {
    let is_mac = cfg!(target_os = "macos");
    let is_arm64 = cfg!(target_arch = "aarch64");
    let node_arch = if is_arm64 { "darwin-arm64" } else { "darwin-x64" };
    let cf_arch = if is_arm64 { "darwin-arm64" } else { "darwin-amd64" };
    let mut items = Vec::new();

    if is_mac {
        items.extend([
            DownloadItem {
                id: "php-latest-mac".to_string(),
                category: "php".to_string(),
                name: "PHP Mới nhất (Homebrew)".to_string(),
                version: "brew-php".to_string(),
                description: "Cài qua Homebrew (brew install php)".to_string(),
                url: "brew://php".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-8.4-mac".to_string(),
                category: "php".to_string(),
                name: "PHP 8.4 (Homebrew)".to_string(),
                version: "brew-php@8.4".to_string(),
                description: "Cài qua Homebrew (brew install php@8.4)".to_string(),
                url: "brew://php@8.4".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-8.3-mac".to_string(),
                category: "php".to_string(),
                name: "PHP 8.3 (Homebrew)".to_string(),
                version: "brew-php@8.3".to_string(),
                description: "Cài qua Homebrew (brew install php@8.3)".to_string(),
                url: "brew://php@8.3".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-8.2-mac".to_string(),
                category: "php".to_string(),
                name: "PHP 8.2 (Homebrew)".to_string(),
                version: "brew-php@8.2".to_string(),
                description: "Cài qua Homebrew (brew install php@8.2)".to_string(),
                url: "brew://php@8.2".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-8.1-mac".to_string(),
                category: "php".to_string(),
                name: "PHP 8.1 (Homebrew)".to_string(),
                version: "brew-php@8.1".to_string(),
                description: "Cài qua Homebrew (brew install php@8.1)".to_string(),
                url: "brew://php@8.1".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-7.4-mac".to_string(),
                category: "php".to_string(),
                name: "PHP 7.4 (shivammathur/php)".to_string(),
                version: "brew-php@7.4".to_string(),
                description: "Cài qua tap shivammathur/php (php@7.4)".to_string(),
                url: "brew://shivammathur/php/php@7.4".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "httpd-brew-mac".to_string(),
                category: "apache".to_string(),
                name: "Apache HTTP Server (Homebrew)".to_string(),
                version: "brew-httpd".to_string(),
                description: "Cài qua Homebrew (brew install httpd)".to_string(),
                url: "brew://httpd".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "nginx-brew-mac".to_string(),
                category: "nginx".to_string(),
                name: "Nginx Server (Homebrew)".to_string(),
                version: "brew-nginx".to_string(),
                description: "Cài qua Homebrew (brew install nginx)".to_string(),
                url: "brew://nginx".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "mariadb-brew-mac".to_string(),
                category: "mysql".to_string(),
                name: "MariaDB (Homebrew - Khuyên dùng)".to_string(),
                version: "brew-mariadb".to_string(),
                description: "Cài qua Homebrew (brew install mariadb)".to_string(),
                url: "brew://mariadb".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "mysql-brew-mac".to_string(),
                category: "mysql".to_string(),
                name: "MySQL Community (Homebrew)".to_string(),
                version: "brew-mysql".to_string(),
                description: "Cài qua Homebrew (brew install mysql)".to_string(),
                url: "brew://mysql".to_string(),
                installed: false,
            },
        ]);
    } else {
        items.extend([
            DownloadItem {
                id: "php-8.3.6".to_string(),
                category: "php".to_string(),
                name: "PHP 8.3.6 (Mới nhất - Thread Safe x64)".to_string(),
                version: "php-8.3.6".to_string(),
                description: "Lưu tại: .\\bin\\php\\php-8.3.6".to_string(),
                url: "https://windows.php.net/downloads/releases/archives/php-8.3.6-Win32-vs16-x64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-8.2.12".to_string(),
                category: "php".to_string(),
                name: "PHP 8.2.12 (Ổn định - Thread Safe x64)".to_string(),
                version: "php-8.2.12".to_string(),
                description: "Lưu tại: .\\bin\\php\\php-8.2.12".to_string(),
                installed: false,
                url: "https://windows.php.net/downloads/releases/archives/php-8.2.12-Win32-vs16-x64.zip".to_string(),
            },
            DownloadItem {
                id: "php-8.1.28".to_string(),
                category: "php".to_string(),
                name: "PHP 8.1.28 (Tương thích - Thread Safe x64)".to_string(),
                version: "php-8.1.28".to_string(),
                description: "Lưu tại: .\\bin\\php\\php-8.1.28".to_string(),
                url: "https://windows.php.net/downloads/releases/archives/php-8.1.28-Win32-vs16-x64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-7.4.33".to_string(),
                category: "php".to_string(),
                name: "PHP 7.4.33 (Kế thừa cũ)".to_string(),
                version: "php-7.4.33".to_string(),
                description: "Lưu tại: .\\bin\\php\\php-7.4.33".to_string(),
                url: "https://windows.php.net/downloads/releases/archives/php-7.4.33-Win32-vc15-x64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "php-5.6.40".to_string(),
                category: "php".to_string(),
                name: "PHP 5.6.40 (Kế thừa rất cũ)".to_string(),
                version: "php-5.6.40".to_string(),
                description: "Lưu tại: .\\bin\\php\\php-5.6.40".to_string(),
                url: "https://windows.php.net/downloads/releases/archives/php-5.6.40-Win32-VC11-x64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "httpd-2.4.67".to_string(),
                category: "apache".to_string(),
                name: "Apache 2.4.67 (VS18 Mới nhất)".to_string(),
                version: "httpd-2.4.67".to_string(),
                description: "Lưu tại: .\\bin\\apache\\httpd-2.4.67".to_string(),
                url: "https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.67-260504-Win64-VS18.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "httpd-2.4.63".to_string(),
                category: "apache".to_string(),
                name: "Apache 2.4.63 (VS17)".to_string(),
                version: "httpd-2.4.63".to_string(),
                description: "Lưu tại: .\\bin\\apache\\httpd-2.4.63".to_string(),
                url: "https://www.apachelounge.com/download/VS17/binaries/httpd-2.4.63-250207-win64-VS17.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "nginx-1.26.0".to_string(),
                category: "nginx".to_string(),
                name: "Nginx 1.26.0 (Stable)".to_string(),
                version: "nginx-1.26.0".to_string(),
                description: "Lưu tại: .\\bin\\nginx\\nginx-1.26.0".to_string(),
                url: "https://nginx.org/download/nginx-1.26.0.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "nginx-1.24.0".to_string(),
                category: "nginx".to_string(),
                name: "Nginx 1.24.0 (Legacy)".to_string(),
                version: "nginx-1.24.0".to_string(),
                description: "Lưu tại: .\\bin\\nginx\\nginx-1.24.0".to_string(),
                url: "https://nginx.org/download/nginx-1.24.0.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "mariadb-11.3.2".to_string(),
                category: "mysql".to_string(),
                name: "MariaDB 11.3.2 (Stable x64)".to_string(),
                version: "mariadb-11.3.2".to_string(),
                description: "Lưu tại: .\\bin\\mysql\\mariadb-11.3.2".to_string(),
                url: "https://archive.mariadb.org/mariadb-11.3.2/winx64-packages/mariadb-11.3.2-winx64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "mariadb-10.11.2".to_string(),
                category: "mysql".to_string(),
                name: "MariaDB 10.11.2 (LTS x64)".to_string(),
                version: "mariadb-10.11.2".to_string(),
                description: "Lưu tại: .\\bin\\mysql\\mariadb-10.11.2".to_string(),
                url: "https://archive.mariadb.org/mariadb-10.11.2/winx64-packages/mariadb-10.11.2-winx64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "mysql-8.0.36".to_string(),
                category: "mysql".to_string(),
                name: "MySQL 8.0.36 (Oracle Community)".to_string(),
                version: "mysql-8.0.36".to_string(),
                description: "Lưu tại: .\\bin\\mysql\\mysql-8.0.36".to_string(),
                url: "https://downloads.mysql.com/archives/get/p/23/file/mysql-8.0.36-winx64.zip".to_string(),
                installed: false,
            },
            DownloadItem {
                id: "mysql-5.7.44".to_string(),
                category: "mysql".to_string(),
                name: "MySQL 5.7.44 (Oracle Classic)".to_string(),
                version: "mysql-5.7.44".to_string(),
                description: "Lưu tại: .\\bin\\mysql\\mysql-5.7.44".to_string(),
                url: "https://downloads.mysql.com/archives/get/p/23/file/mysql-5.7.44-winx64.zip".to_string(),
                installed: false,
            },
        ]);
    }

    // Node.js Engine (cross-platform)
    items.extend([
        DownloadItem {
            id: "node-v22.14.0".to_string(),
            category: "nodejs".to_string(),
            name: "Node.js v22.14.0 (LTS Mới nhất)".to_string(),
            version: "node-v22.14.0".to_string(),
            description: "Lưu tại: bin/nodejs/node-v22.14.0".to_string(),
            url: if is_mac {
                format!("https://nodejs.org/dist/v22.14.0/node-v22.14.0-{}.tar.gz", node_arch)
            } else {
                "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip".to_string()
            },
            installed: false,
        },
        DownloadItem {
            id: "node-v20.12.2".to_string(),
            category: "nodejs".to_string(),
            name: "Node.js v20.12.2 (LTS Ổn định)".to_string(),
            version: "node-v20.12.2".to_string(),
            description: "Lưu tại: bin/nodejs/node-v20.12.2".to_string(),
            url: if is_mac {
                format!("https://nodejs.org/dist/v20.12.2/node-v20.12.2-{}.tar.gz", node_arch)
            } else {
                "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip".to_string()
            },
            installed: false,
        },
        DownloadItem {
            id: "node-v18.20.2".to_string(),
            category: "nodejs".to_string(),
            name: "Node.js v18.20.2 (LTS cũ)".to_string(),
            version: "node-v18.20.2".to_string(),
            description: "Lưu tại: bin/nodejs/node-v18.20.2".to_string(),
            url: if is_mac {
                format!("https://nodejs.org/dist/v18.20.2/node-v18.20.2-{}.tar.gz", node_arch)
            } else {
                "https://nodejs.org/dist/v18.20.2/node-v18.20.2-win-x64.zip".to_string()
            },
            installed: false,
        },
        // phpMyAdmin (cross-platform PHP app)
        DownloadItem {
            id: "phpmyadmin-5.2.1".to_string(),
            category: "phpmyadmin".to_string(),
            name: "phpMyAdmin 5.2.1".to_string(),
            version: "5.2.1".to_string(),
            description: "Lưu tại: phpmyadmin".to_string(),
            url: "https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.zip".to_string(),
            installed: false,
        },
        DownloadItem {
            id: "phpmyadmin-4.9.11".to_string(),
            category: "phpmyadmin".to_string(),
            name: "phpMyAdmin 4.9.11 (Cho PHP cũ)".to_string(),
            version: "4.9.11".to_string(),
            description: "Lưu tại: phpmyadmin-old".to_string(),
            url: "https://files.phpmyadmin.net/phpMyAdmin/4.9.11/phpMyAdmin-4.9.11-all-languages.zip".to_string(),
            installed: false,
        },
        DownloadItem {
            id: "cloudflared-latest".to_string(),
            category: "vcredist".to_string(),
            name: "Cloudflared Tunnel (Stable)".to_string(),
            version: "latest".to_string(),
            description: "Lưu tại: bin/cloudflared".to_string(),
            url: if is_mac {
                format!(
                    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-{}.tgz",
                    cf_arch
                )
            } else {
                "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe".to_string()
            },
            installed: false,
        },
        DownloadItem {
            id: "nasani-extension".to_string(),
            category: "vcredist".to_string(),
            name: "Tiện ích Chrome Nasani Sync".to_string(),
            version: "1.0.0".to_string(),
            description: "Extension đồng bộ deadline, nhận việc & auto report".to_string(),
            url: "local://extensions/nasani-sync".to_string(),
            installed: false,
        },
    ]);

    if !is_mac {
        items.push(DownloadItem {
            id: "vcredist-2022".to_string(),
            category: "vcredist".to_string(),
            name: "Visual C++ 2015-2022 (x64)".to_string(),
            version: "14.42".to_string(),
            description: "Thư viện runtime cho Windows PHP/Apache".to_string(),
            url: "https://aka.ms/vs/17/release/vc_redist.x64.exe".to_string(),
            installed: false,
        });
    }

    items
}

pub fn sync_online_versions_background(app: AppHandle) {
    std::thread::spawn(move || {
        let client = match reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(10))
            .build()
        {
            Ok(c) => c,
            Err(_) => return,
        };

        let fallback = get_offline_fallback_items();
        let mut combined: Vec<DownloadItem> = Vec::new();
        let mut any_online = false;

        if cfg!(target_os = "macos") {
            // On macOS, core stacks install natively via Homebrew / macOS builds
            combined.extend(
                fallback
                    .iter()
                    .filter(|i| i.category != "phpmyadmin")
                    .cloned(),
            );
            let pma_online = scrape_pma(&client);
            if !pma_online.is_empty() {
                any_online = true;
                combined.extend(pma_online);
            } else {
                combined.extend(fallback.iter().filter(|i| i.category == "phpmyadmin").cloned());
            }
        } else {
            // 1. Scrape PHP
            let php_online = scrape_php(&client);
            if !php_online.is_empty() {
                any_online = true;
                combined.extend(php_online);
            } else {
                combined.extend(fallback.iter().filter(|i| i.category == "php").cloned());
            }

            // 2. Node.js (keep fallback + scrape if needed)
            combined.extend(fallback.iter().filter(|i| i.category == "nodejs").cloned());

            // 3. Scrape Apache
            let apache_online = scrape_apache(&client);
            if !apache_online.is_empty() {
                any_online = true;
                combined.extend(apache_online);
            } else {
                combined.extend(fallback.iter().filter(|i| i.category == "apache").cloned());
            }

            // 4. Scrape Nginx
            let nginx_online = scrape_nginx(&client);
            if !nginx_online.is_empty() {
                any_online = true;
                combined.extend(nginx_online);
            } else {
                combined.extend(fallback.iter().filter(|i| i.category == "nginx").cloned());
            }

            // 5. Scrape MariaDB + append Oracle MySQL 8.0 & 5.7
            let mut maria_online = scrape_mariadb(&client);
            if !maria_online.is_empty() {
                any_online = true;
                maria_online.push(DownloadItem {
                    id: "mysql-8.0.36".to_string(),
                    category: "mysql".to_string(),
                    name: "MySQL 8.0.36 (Oracle Community)".to_string(),
                    version: "mysql-8.0.36".to_string(),
                    description: "Lưu tại: .\\bin\\mysql\\mysql-8.0.36".to_string(),
                    url: "https://downloads.mysql.com/archives/get/p/23/file/mysql-8.0.36-winx64.zip".to_string(),
                    installed: false,
                });
                maria_online.push(DownloadItem {
                    id: "mysql-5.7.44".to_string(),
                    category: "mysql".to_string(),
                    name: "MySQL 5.7.44 (Oracle Classic)".to_string(),
                    version: "mysql-5.7.44".to_string(),
                    description: "Lưu tại: .\\bin\\mysql\\mysql-5.7.44".to_string(),
                    url: "https://downloads.mysql.com/archives/get/p/23/file/mysql-5.7.44-winx64.zip".to_string(),
                    installed: false,
                });
                combined.extend(maria_online);
            } else {
                combined.extend(fallback.iter().filter(|i| i.category == "mysql").cloned());
            }

            // 6. Scrape phpMyAdmin
            let pma_online = scrape_pma(&client);
            if !pma_online.is_empty() {
                any_online = true;
                combined.extend(pma_online);
            } else {
                combined.extend(fallback.iter().filter(|i| i.category == "phpmyadmin").cloned());
            }

            // 7. VC++ & Cloudflared
            combined.extend(fallback.iter().filter(|i| i.category == "vcredist").cloned());
        }

        refresh_installed_flags(&mut combined);

        if let Ok(mut guard) = CACHED_ONLINE_ITEMS.lock() {
            *guard = Some(combined.clone());
        }

        let _ = app.emit(
            "store-synced",
            StoreSyncedEvent {
                items: combined,
                online: any_online,
            },
        );
    });
}

fn scrape_php(client: &reqwest::blocking::Client) -> Vec<DownloadItem> {
    let mut list = Vec::new();
    if let Ok(resp) = client.get("https://windows.php.net/downloads/releases/").send() {
        if let Ok(html) = resp.text() {
            let re = Regex::new(r#"(?i)href="(php-(\d+\.\d+\.\d+)(?:-\d+)?-Win32-(?:vs\d+|vc\d+)-x64\.zip)""#).unwrap();
            let mut added = HashSet::new();
            let mut temp = Vec::new();

            for caps in re.captures_iter(&html) {
                let filename = &caps[1];
                let version = caps[2].to_string();
                if added.insert(version.clone()) {
                    temp.push(DownloadItem {
                        id: format!("php-{}", version),
                        category: "php".to_string(),
                        name: format!("PHP {} (Thread Safe x64)", version),
                        version: format!("php-{}", version),
                        description: format!("Lưu tại: .\\bin\\php\\php-{}", version),
                        url: format!("https://windows.php.net/downloads/releases/{}", filename),
                        installed: false,
                    });
                }
            }

            temp.sort_by(|a, b| parse_ver_tuple(&b.version).cmp(&parse_ver_tuple(&a.version)));
            for item in temp.into_iter().take(8) {
                list.push(item);
            }

            if !list.is_empty() {
                list.push(DownloadItem {
                    id: "php-7.4.33".to_string(),
                    category: "php".to_string(),
                    name: "PHP 7.4.33 (Kế thừa cũ)".to_string(),
                    version: "php-7.4.33".to_string(),
                    description: "Lưu tại: .\\bin\\php\\php-7.4.33".to_string(),
                    url: "https://windows.php.net/downloads/releases/archives/php-7.4.33-Win32-vc15-x64.zip".to_string(),
                    installed: false,
                });
                list.push(DownloadItem {
                    id: "php-5.6.40".to_string(),
                    category: "php".to_string(),
                    name: "PHP 5.6.40 (Kế thừa rất cũ)".to_string(),
                    version: "php-5.6.40".to_string(),
                    description: "Lưu tại: .\\bin\\php\\php-5.6.40".to_string(),
                    url: "https://windows.php.net/downloads/releases/archives/php-5.6.40-Win32-VC11-x64.zip".to_string(),
                    installed: false,
                });
            }
        }
    }
    list
}

fn scrape_apache(client: &reqwest::blocking::Client) -> Vec<DownloadItem> {
    let mut list = Vec::new();
    if let Ok(resp) = client
        .get("https://www.apachelounge.com/download/")
        .header("Referer", "https://www.apachelounge.com/")
        .send()
    {
        if let Ok(html) = resp.text() {
            let re = Regex::new(r#"(?i)href="(/download/(?:VS\d+)/binaries/(httpd-([\d\.]+)[^"']*-Win64-VS\d+\.zip))""#).unwrap();
            let mut added = HashSet::new();
            for caps in re.captures_iter(&html) {
                let rel_url = &caps[1];
                let version = caps[3].to_string();
                if added.insert(version.clone()) {
                    list.push(DownloadItem {
                        id: format!("httpd-{}", version),
                        category: "apache".to_string(),
                        name: format!("Apache {} (Lounge x64)", version),
                        version: format!("httpd-{}", version),
                        description: format!("Lưu tại: .\\bin\\apache\\httpd-{}", version),
                        url: format!("https://www.apachelounge.com{}", rel_url),
                        installed: false,
                    });
                    if list.len() >= 3 {
                        break;
                    }
                }
            }
        }
    }
    list
}

fn scrape_nginx(client: &reqwest::blocking::Client) -> Vec<DownloadItem> {
    let mut list = Vec::new();
    if let Ok(resp) = client.get("https://nginx.org/en/download.html").send() {
        if let Ok(html) = resp.text() {
            let re = Regex::new(r#"href="(/download/(nginx-(\d+\.\d+\.\d+)\.zip))""#).unwrap();
            let mut added = HashSet::new();
            for caps in re.captures_iter(&html) {
                let rel_url = &caps[1];
                let version = caps[3].to_string();
                if added.insert(version.clone()) {
                    list.push(DownloadItem {
                        id: format!("nginx-{}", version),
                        category: "nginx".to_string(),
                        name: format!("Nginx {} (Stable/Mainline)", version),
                        version: format!("nginx-{}", version),
                        description: format!("Lưu tại: .\\bin\\nginx\\nginx-{}", version),
                        url: format!("https://nginx.org{}", rel_url),
                        installed: false,
                    });
                    if list.len() >= 4 {
                        break;
                    }
                }
            }
        }
    }
    list
}

fn scrape_mariadb(client: &reqwest::blocking::Client) -> Vec<DownloadItem> {
    let mut list = Vec::new();
    if let Ok(resp) = client.get("https://archive.mariadb.org/").send() {
        if let Ok(html) = resp.text() {
            let re = Regex::new(r#"href="mariadb-(\d+\.\d+\.\d+)/""#).unwrap();
            let mut versions: Vec<String> = re
                .captures_iter(&html)
                .map(|c| c[1].to_string())
                .collect();

            versions.sort_by(|a, b| parse_ver_tuple(b).cmp(&parse_ver_tuple(a)));

            let mut added = HashSet::new();
            for ver in versions {
                if added.contains(&ver) {
                    continue;
                }
                if ver.starts_with("11.4")
                    || ver.starts_with("11.3")
                    || ver.starts_with("11.2")
                    || ver.starts_with("10.11")
                    || ver.starts_with("10.6")
                {
                    added.insert(ver.clone());
                    list.push(DownloadItem {
                        id: format!("mariadb-{}", ver),
                        category: "mysql".to_string(),
                        name: format!("MariaDB {} (Stable x64)", ver),
                        version: format!("mariadb-{}", ver),
                        description: format!("Lưu tại: .\\bin\\mysql\\mariadb-{}", ver),
                        url: format!(
                            "https://archive.mariadb.org/mariadb-{0}/winx64-packages/mariadb-{0}-winx64.zip",
                            ver
                        ),
                        installed: false,
                    });
                    if list.len() >= 4 {
                        break;
                    }
                }
            }
        }
    }
    list
}

fn scrape_pma(client: &reqwest::blocking::Client) -> Vec<DownloadItem> {
    let mut list = Vec::new();
    if let Ok(resp) = client.get("https://www.phpmyadmin.net/downloads/").send() {
        if let Ok(html) = resp.text() {
            let re = Regex::new(r#"href="(https://files\.phpmyadmin\.net/phpMyAdmin/(\d+\.\d+\.\d+)/(phpMyAdmin-[^/"]+-all-languages\.zip))""#).unwrap();
            let mut added = HashSet::new();
            for caps in re.captures_iter(&html) {
                let url = caps[1].to_string();
                let version = caps[2].to_string();
                if added.insert(version.clone()) {
                    let folder = if version.starts_with('4') {
                        "phpmyadmin-old"
                    } else {
                        "phpmyadmin"
                    };
                    list.push(DownloadItem {
                        id: format!("phpmyadmin-{}", version),
                        category: "phpmyadmin".to_string(),
                        name: format!("phpMyAdmin {}", version),
                        version,
                        description: format!("Lưu tại: .\\{}", folder),
                        url,
                        installed: false,
                    });
                    if list.len() >= 2 {
                        break;
                    }
                }
            }
        }
    }
    list
}

fn find_macos_brew_bin() -> Option<PathBuf> {
    for candidate in ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] {
        let p = PathBuf::from(candidate);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn macos_brew_path_env() -> String {
    let base_paths = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin";
    match std::env::var("PATH") {
        Ok(existing) if !existing.is_empty() => format!("{}:{}", base_paths, existing),
        _ => base_paths.to_string(),
    }
}

fn run_brew_command<F>(brew_bin: &Path, args: &[&str], on_line: &F) -> Result<(), String>
where
    F: Fn(&str),
{
    let mut child = Command::new(brew_bin)
        .args(args)
        .env("PATH", macos_brew_path_env())
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("HOMEBREW_NO_INSTALL_CLEANUP", "1")
        .env("NONINTERACTIVE", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Không thể khởi chạy Homebrew: {}", e))?;

    let stderr_handle = child.stderr.take().map(|err| {
        std::thread::spawn(move || {
            let mut lines = Vec::new();
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                lines.push(line);
                if lines.len() > 15 {
                    lines.remove(0);
                }
            }
            lines
        })
    });

    let mut out_lines = Vec::new();
    if let Some(out) = child.stdout.take() {
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            on_line(&line);
            out_lines.push(line);
            if out_lines.len() > 15 {
                out_lines.remove(0);
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Lỗi chờ tiến trình Homebrew: {}", e))?;
    let err_lines = stderr_handle
        .and_then(|h| h.join().ok())
        .unwrap_or_default();

    if status.success() {
        Ok(())
    } else {
        let mut combined = err_lines;
        if combined.is_empty() {
            combined = out_lines;
        }
        let tail = combined.join(" | ");
        Err(if tail.is_empty() {
            format!("Homebrew thoát với mã {}", status)
        } else {
            tail
        })
    }
}

fn install_via_brew<F>(formula: &str, item: &DownloadItem, base: &Path, emit: &F)
where
    F: Fn(u8, &str, bool, &str),
{
    let Some(brew_bin) = find_macos_brew_bin() else {
        emit(
            0,
            "Chưa cài Homebrew trên macOS",
            true,
            "Không tìm thấy Homebrew (/opt/homebrew/bin/brew hoặc /usr/local/bin/brew). Mở Terminal cài Homebrew trước: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"",
        );
        return;
    };

    let parts: Vec<&str> = formula.split('/').collect();
    if parts.len() == 3 {
        let tap_name = format!("{}/{}", parts[0], parts[1]);
        emit(15, &format!("Đang thêm tap Homebrew {}...", tap_name), false, "");
        if let Err(e) = run_brew_command(&brew_bin, &["tap", &tap_name], &|_| {}) {
            emit(0, &format!("Lỗi tap {}", tap_name), true, &e);
            return;
        }
    }

    emit(25, &format!("Đang cài {} qua Homebrew (có thể mất vài phút)...", item.name), false, "");
    let line_count = std::sync::atomic::AtomicU8::new(28);
    let install_res = run_brew_command(&brew_bin, &["install", formula], &|line| {
        let cur = line_count.load(std::sync::atomic::Ordering::Relaxed);
        let next = if cur < 85 { cur + 2 } else { 85 };
        line_count.store(next, std::sync::atomic::Ordering::Relaxed);
        let short_line: String = line.chars().take(70).collect();
        if !short_line.trim().is_empty() {
            emit(next, &format!("Homebrew: {}", short_line), false, "");
        }
    });

    if let Err(e) = install_res {
        emit(0, &format!("Lỗi cài {} qua Homebrew", item.name), true, &e);
        return;
    }

    emit(90, "Đang tạo cấu hình RBWStudio cho dịch vụ...", false, "");
    let target_dir = base.join("bin").join(&item.category).join(&item.version);
    let _ = fs::create_dir_all(&target_dir);
    run_post_install_configure(&item.category, &target_dir);

    emit(100, &format!("Đã cài đặt {} qua Homebrew!", item.name), true, "");
}

fn extract_tar_gz(archive_path: &Path, target_dir: &Path, strip_top: bool) -> Result<(), String> {
    let _ = fs::create_dir_all(target_dir);
    let mut cmd = Command::new("tar");
    cmd.arg("-xzf").arg(archive_path);
    if strip_top {
        cmd.args(["--strip-components", "1"]);
    }
    cmd.arg("-C").arg(target_dir);
    let out = cmd
        .output()
        .map_err(|e| format!("Không thể chạy tar giải nén: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() {
            format!("Lỗi giải nén tar (mã {})", out.status)
        } else {
            err
        });
    }
    Ok(())
}

fn run_post_install_configure(category: &str, target_dir: &Path) {
    let settings = config::load_app_settings();
    if category == "php" {
        services::configure_php(target_dir);
    } else if category == "mysql" {
        services::configure_mysql(target_dir, settings.mysql_port);
    } else if category == "phpmyadmin" {
        services::configure_phpmyadmin(settings.mysql_port);
    } else if category == "apache" || category == "nginx" {
        services::generate_vhosts_configs(&settings);
    }
}

pub fn install_store_item(app: AppHandle, item_id: String) {
    std::thread::spawn(move || {
        let items = get_store_items();
        let item = match items.into_iter().find(|i| i.id == item_id) {
            Some(it) => it,
            None => return,
        };

        let emit = |progress: u8, status: &str, done: bool, error: &str| {
            let _ = app.emit(
                "download-progress",
                DownloadProgressEvent {
                    id: item_id.clone(),
                    progress,
                    status: status.to_string(),
                    done,
                    error: error.to_string(),
                },
            );
        };

        let base = config::get_base_dir();

        if item.id == "nasani-extension" {
            emit(50, "Đang mở Chrome & thư mục Extension...", false, "");
            let res = crate::sites::install_or_open_chrome_extension("install");
            match res {
                Ok(_) => {
                    emit(100, "Đã mở Chrome & thư mục Extension để cài đặt!", true, "");
                }
                Err(e) => {
                    emit(0, "Lỗi cài đặt tiện ích Chrome", true, &e);
                }
            }
            return;
        }

        if let Some(formula) = item.url.strip_prefix("brew://") {
            install_via_brew(formula, &item, &base, &emit);
            return;
        }

        emit(5, &format!("Đang kết nối để tải {}...", item.name), false, "");

        let dl_dir = base.join("downloads");
        let _ = fs::create_dir_all(&dl_dir);

        let filename = item.url.split('/').last().unwrap_or("package.zip");
        let archive_path = dl_dir.join(filename);

        let client = match reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(600))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                emit(0, "Lỗi khởi tạo HTTP", true, &e.to_string());
                return;
            }
        };

        let mut req = client.get(&item.url);
        if item.url.contains("apachelounge.com") {
            req = req.header("Referer", "https://www.apachelounge.com/download/");
        } else if item.url.contains("mysql.com") {
            req = req.header("Referer", "https://downloads.mysql.com/archives/community/");
        }

        let mut resp = match req.send() {
            Ok(r) => {
                if !r.status().is_success() {
                    emit(
                        0,
                        "Lỗi máy chủ tải gói cài đặt",
                        true,
                        &format!("HTTP {}", r.status()),
                    );
                    return;
                }
                r
            }
            Err(e) => {
                emit(0, "Lỗi kết nối tải file", true, &e.to_string());
                return;
            }
        };

        let total_size = resp.content_length().unwrap_or(0);
        let mut out_file = match File::create(&archive_path) {
            Ok(f) => f,
            Err(e) => {
                emit(0, "Lỗi tạo file tạm", true, &e.to_string());
                return;
            }
        };

        let mut downloaded: u64 = 0;
        let mut buffer = [0u8; 65536];
        loop {
            match resp.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    if let Err(e) = out_file.write_all(&buffer[..n]) {
                        emit(0, "Lỗi ghi đĩa", true, &e.to_string());
                        return;
                    }
                    downloaded += n as u64;
                    let mb_done = downloaded as f64 / 1024.0 / 1024.0;
                    if total_size > 0 {
                        let mb_total = total_size as f64 / 1024.0 / 1024.0;
                        let pct = ((downloaded as f64 / total_size as f64) * 75.0) as u8 + 5;
                        emit(
                            pct,
                            &format!(
                                "Đang tải {}... {}% ({:.2} MB / {:.2} MB)",
                                item.name, pct, mb_done, mb_total
                            ),
                            false,
                            "",
                        );
                    } else {
                        emit(
                            45,
                            &format!("Đang tải {}... ({:.2} MB)", item.name, mb_done),
                            false,
                            "",
                        );
                    }
                }
                Err(e) => {
                    emit(0, "Lỗi đọc dữ liệu mạng", true, &e.to_string());
                    return;
                }
            }
        }
        let _ = out_file.flush();
        drop(out_file);

        emit(82, "Đang tự động giải nén và cấu hình...", false, "");

        if item.id == "cloudflared-latest" {
            let cf_dir = base.join("bin/cloudflared");
            let _ = fs::create_dir_all(&cf_dir);
            #[cfg(target_os = "windows")]
            let target_bin = cf_dir.join("cloudflared.exe");
            #[cfg(not(target_os = "windows"))]
            let target_bin = cf_dir.join("cloudflared");

            if filename.ends_with(".tgz") || filename.ends_with(".tar.gz") {
                if let Err(e) = extract_tar_gz(&archive_path, &cf_dir, false) {
                    emit(0, "Lỗi giải nén Cloudflared", true, &e);
                    return;
                }
            } else if let Err(e) = fs::copy(&archive_path, &target_bin) {
                emit(0, "Lỗi sao chép Cloudflared", true, &e.to_string());
                return;
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(&target_bin, fs::Permissions::from_mode(0o755));
            }
            let _ = fs::remove_file(&archive_path);
            emit(100, "Đã cài đặt Cloudflared hoàn tất!", true, "");
            return;
        }

        if item.id == "vcredist-2022" {
            #[cfg(target_os = "windows")]
            {
                let _ = Command::new(&archive_path)
                    .args(["/install", "/passive", "/norestart"])
                    .spawn();
            }
            emit(100, "Đã khởi chạy trình cài đặt Visual C++!", true, "");
            return;
        }

        let target_dir: PathBuf = match item.category.as_str() {
            "phpmyadmin" => {
                if item.version.starts_with('4') {
                    base.join("phpmyadmin-old")
                } else {
                    base.join("phpmyadmin")
                }
            }
            cat => base.join("bin").join(cat).join(&item.version),
        };

        let extract_res = if filename.ends_with(".tar.gz") || filename.ends_with(".tgz") {
            extract_tar_gz(&archive_path, &target_dir, true)
        } else {
            extract_zip_flattened(&archive_path, &target_dir)
        };
        if let Err(e) = extract_res {
            emit(0, "Lỗi giải nén gói cài đặt", true, &e);
            return;
        }

        run_post_install_configure(&item.category, &target_dir);

        let _ = fs::remove_file(&archive_path);
        emit(100, "Đã cài đặt hoàn tất!", true, "");
    });
}

fn extract_zip_flattened(zip_path: &Path, target_dir: &Path) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    let _ = fs::create_dir_all(target_dir);

    let mut top_prefix: Option<String> = None;
    let mut single_top = true;

    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index(i) {
            let name = entry.name().replace('\\', "/");
            let parts: Vec<&str> = name.split('/').filter(|s| !s.is_empty()).collect();
            if parts.len() > 1 {
                let first = parts[0].to_string();
                if let Some(ref existing) = top_prefix {
                    if existing != &first {
                        single_top = false;
                        break;
                    }
                } else {
                    top_prefix = Some(first);
                }
            } else if !entry.is_dir() {
                single_top = false;
                break;
            }
        }
    }

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let raw_name = entry.name().replace('\\', "/");
        let rel_name = if single_top {
            if let Some(ref prefix) = top_prefix {
                raw_name
                    .strip_prefix(&format!("{}/", prefix))
                    .unwrap_or(&raw_name)
                    .to_string()
            } else {
                raw_name
            }
        } else {
            raw_name
        };

        if rel_name.is_empty() {
            continue;
        }

        let out_path = target_dir.join(&rel_name);
        if entry.is_dir() {
            let _ = fs::create_dir_all(&out_path);
        } else {
            if let Some(parent) = out_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let mut outfile = File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry.unix_mode() {
                    let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(mode));
                } else if out_path.extension().is_none() || out_path.extension().map_or(false, |ext| ext == "sh" || ext == "dylib" || ext == "so") {
                    let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(0o755));
                }
            }
        }
    }

    Ok(())
}
