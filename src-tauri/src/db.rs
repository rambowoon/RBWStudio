use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use rusqlite::{params, Connection, Result};
use serde_json::Value;

use crate::config;

static DB_MUTEX: Mutex<()> = Mutex::new(());

pub fn get_db_path() -> PathBuf {
    let data_dir = config::get_base_dir().join("data");
    if !data_dir.is_dir() {
        let _ = fs::create_dir_all(&data_dir);
    }
    data_dir.join("rbw.db")
}

pub fn get_connection() -> Result<Connection> {
    let path = get_db_path();
    let conn = Connection::open(&path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;"
    )?;
    Ok(conn)
}

pub fn init_database() -> Result<()> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection()?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            path TEXT NOT NULL DEFAULT '',
            php_version TEXT NOT NULL DEFAULT '',
            vhost_domain TEXT NOT NULL DEFAULT '',
            ssl_enabled INTEGER NOT NULL DEFAULT 0,
            is_root INTEGER NOT NULL DEFAULT 0,
            configured_local INTEGER NOT NULL DEFAULT 0,
            db_host TEXT NOT NULL DEFAULT '',
            db_name TEXT NOT NULL DEFAULT '',
            db_user TEXT NOT NULL DEFAULT '',
            db_pass TEXT NOT NULL DEFAULT '',
            demo_server_id TEXT NOT NULL DEFAULT '',
            demo_url TEXT NOT NULL DEFAULT '',
            demo_path TEXT NOT NULL DEFAULT '',
            has_demo INTEGER NOT NULL DEFAULT 0,
            lock_demo INTEGER NOT NULL DEFAULT 0,
            lock_production INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
        CREATE INDEX IF NOT EXISTS idx_projects_cat ON projects(category);

        CREATE TABLE IF NOT EXISTS demo_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            ftp_host TEXT NOT NULL DEFAULT '',
            web_domain TEXT NOT NULL DEFAULT '',
            ftp_user TEXT NOT NULL DEFAULT '',
            ftp_pass TEXT NOT NULL DEFAULT '',
            ftp_root TEXT NOT NULL DEFAULT '',
            da_user TEXT NOT NULL DEFAULT '',
            da_port TEXT NOT NULL DEFAULT '2222',
            is_default INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sync_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            action TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL
        );"
    )?;

    // Run one-time migration from existing JSON files
    migrate_existing_data(&conn)?;

    Ok(())
}

fn migrate_existing_data(conn: &Connection) -> Result<()> {
    // 1. Check if projects table is empty
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0)).unwrap_or(0);
    if count == 0 {
        let sites_map = config::load_string_map("sites.json");
        let ssl_map = config::load_bool_map("ssl.json");
        let vhosts_map = config::load_string_map("sites_vhosts.json");
        let root_proj = config::load_text_file("root_project.txt").trim().to_string();

        // Also check config/rbwmanager/data/projects.json if exists
        let manager_proj_file = config::get_base_dir().join("config").join("rbwmanager").join("data").join("projects.json");
        let mut manager_projects = serde_json::Map::new();
        if let Ok(content) = fs::read_to_string(&manager_proj_file) {
            if let Ok(Value::Object(map)) = serde_json::from_str(&content) {
                manager_projects = map;
            }
        }

        let now = chrono::Local::now().timestamp();

        for (site_key, php) in sites_map {
            let clean_name = site_key.trim();
            if clean_name.is_empty() {
                continue;
            }
            let is_root = if clean_name == root_proj { 1 } else { 0 };
            let ssl_val = if ssl_map.get(clean_name).copied().unwrap_or(false) { 1 } else { 0 };
            let vhost = vhosts_map.get(clean_name).cloned().unwrap_or_default();

            let mut db_name = String::new();
            let mut configured_local = 0;
            let mut demo_url = String::new();
            let mut has_demo = 0;

            if let Some(cfg_val) = manager_projects.get(clean_name) {
                if let Some(cfg) = cfg_val.as_object() {
                    if let Some(db) = cfg.get("db_name").and_then(|v| v.as_str()) {
                        db_name = db.to_string();
                    }
                    if cfg.get("configured_local").and_then(|v| v.as_bool()).unwrap_or(false) {
                        configured_local = 1;
                    }
                    if let Some(dep) = cfg.get("deployed").and_then(|v| v.as_object()) {
                        if let Some(demo) = dep.get("demo").and_then(|v| v.as_object()) {
                            has_demo = 1;
                            if let Some(u) = demo.get("url").and_then(|v| v.as_str()) {
                                demo_url = u.to_string();
                            }
                        }
                    }
                }
            }

            let id = clean_name.replace(['/', '\\'], "_");
            let _ = conn.execute(
                "INSERT OR REPLACE INTO projects (id, name, php_version, vhost_domain, ssl_enabled, is_root, configured_local, db_name, demo_url, has_demo, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![id, clean_name, php, vhost, ssl_val, is_root, configured_local, db_name, demo_url, has_demo, now],
            );
        }
    }

    // 2. Migrate demo servers if table is empty
    let srv_count: i64 = conn.query_row("SELECT COUNT(*) FROM demo_servers", [], |r| r.get(0)).unwrap_or(0);
    if srv_count == 0 {
        let servers_path = config::get_base_dir().join("data").join("demo_servers.json");
        if servers_path.is_file() {
            if let Ok(raw) = fs::read_to_string(&servers_path) {
                if let Ok(arr) = serde_json::from_str::<Vec<Value>>(&raw) {
                    for srv in arr {
                        let id = srv.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        if id.is_empty() {
                            continue;
                        }
                        let name = srv.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let ftp_host = srv.get("ftp_host").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let web_domain = srv.get("web_domain").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let ftp_user = srv.get("ftp_user").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let ftp_pass = srv.get("ftp_pass").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let ftp_root = srv.get("ftp_root").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let da_user = srv.get("da_user").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let da_port = srv.get("da_port").and_then(|v| v.as_str()).unwrap_or("2222").to_string();
                        let is_default = if srv.get("is_default").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };

                        let _ = conn.execute(
                            "INSERT OR REPLACE INTO demo_servers (id, name, ftp_host, web_domain, ftp_user, ftp_pass, ftp_root, da_user, da_port, is_default)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                            params![id, name, ftp_host, web_domain, ftp_user, ftp_pass, ftp_root, da_user, da_port, is_default],
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// SETTINGS API
// ============================================================================

pub fn get_setting(key: &str) -> Option<String> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection().ok()?;
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| r.get(0)).ok()
}

pub fn set_setting(key: &str, value: &str) -> Result<()> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection()?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

// ============================================================================
// PROJECT PHP & CONFIG API
// ============================================================================

pub fn get_project_php(name: &str) -> Option<String> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection().ok()?;
    let id = name.replace(['/', '\\'], "_");
    conn.query_row(
        "SELECT php_version FROM projects WHERE id = ?1 OR name = ?2",
        params![id, name],
        |r| r.get(0),
    ).ok().filter(|s: &String| !s.is_empty())
}

pub fn set_project_php(name: &str, php_version: &str) -> Result<()> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection()?;
    let id = name.replace(['/', '\\'], "_");
    let now = chrono::Local::now().timestamp();
    conn.execute(
        "INSERT INTO projects (id, name, php_version, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET php_version = ?3, updated_at = ?4",
        params![id, name, php_version, now],
    )?;
    Ok(())
}

pub fn get_all_projects_php_map() -> std::collections::HashMap<String, String> {
    let _lock = DB_MUTEX.lock().unwrap();
    let mut map = std::collections::HashMap::new();
    if let Ok(conn) = get_connection() {
        if let Ok(mut stmt) = conn.prepare("SELECT name, php_version FROM projects WHERE php_version != ''") {
            if let Ok(rows) = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))) {
                for item in rows.flatten() {
                    map.insert(item.0, item.1);
                }
            }
        }
    }
    map
}

pub fn set_project_vhost(name: &str, vhost: &str) -> Result<()> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection()?;
    let id = name.replace(['/', '\\'], "_");
    let now = chrono::Local::now().timestamp();
    conn.execute(
        "INSERT INTO projects (id, name, vhost_domain, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET vhost_domain = ?3, updated_at = ?4",
        params![id, name, vhost, now],
    )?;
    Ok(())
}

pub fn set_project_ssl(name: &str, ssl: bool) -> Result<()> {
    let _lock = DB_MUTEX.lock().unwrap();
    let conn = get_connection()?;
    let id = name.replace(['/', '\\'], "_");
    let ssl_val = if ssl { 1 } else { 0 };
    let now = chrono::Local::now().timestamp();
    conn.execute(
        "INSERT INTO projects (id, name, ssl_enabled, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET ssl_enabled = ?3, updated_at = ?4",
        params![id, name, ssl_val, now],
    )?;
    Ok(())
}

pub fn get_all_vhosts_map() -> std::collections::HashMap<String, String> {
    let _lock = DB_MUTEX.lock().unwrap();
    let mut map = std::collections::HashMap::new();
    if let Ok(conn) = get_connection() {
        if let Ok(mut stmt) = conn.prepare("SELECT name, vhost_domain FROM projects WHERE vhost_domain != ''") {
            if let Ok(rows) = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))) {
                for item in rows.flatten() {
                    map.insert(item.0, item.1);
                }
            }
        }
    }
    map
}

pub fn get_all_ssl_map() -> std::collections::HashMap<String, bool> {
    let _lock = DB_MUTEX.lock().unwrap();
    let mut map = std::collections::HashMap::new();
    if let Ok(conn) = get_connection() {
        if let Ok(mut stmt) = conn.prepare("SELECT name, ssl_enabled FROM projects") {
            if let Ok(rows) = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))) {
                for item in rows.flatten() {
                    let ssl_i: i64 = item.1;
                    map.insert(item.0, ssl_i != 0);
                }
            }
        }
    }
    map
}

