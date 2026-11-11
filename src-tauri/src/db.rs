use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection, Result};
use serde_json::{json, Value};

use crate::config;
use crate::mail::CaughtEmail;

static DB_CONN: Mutex<Option<Connection>> = Mutex::new(None);

pub fn get_db_path() -> PathBuf {
    let data_dir = config::get_base_dir().join("data");
    if !data_dir.is_dir() {
        let _ = fs::create_dir_all(&data_dir);
    }
    data_dir.join("rbw.db")
}

fn open_configured_connection() -> Result<Connection> {
    let path = get_db_path();
    let conn = Connection::open(&path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA temp_store = MEMORY;
         PRAGMA cache_size = -8000;
         PRAGMA foreign_keys = ON;",
    )?;
    Ok(conn)
}

pub fn with_db<F, R>(f: F) -> Result<R>
where
    F: FnOnce(&Connection) -> Result<R>,
{
    let mut guard = DB_CONN.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(open_configured_connection()?);
    }
    let conn = guard.as_ref().unwrap();
    f(conn)
}

pub fn init_database() -> Result<()> {
    with_db(|conn| {
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
                config_json TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
            CREATE INDEX IF NOT EXISTS idx_projects_cat ON projects(category);

            CREATE TABLE IF NOT EXISTS dir_sizes_cache (
                key TEXT PRIMARY KEY,
                path TEXT NOT NULL DEFAULT '',
                mtime INTEGER NOT NULL DEFAULT 0,
                size REAL NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS caught_emails (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL DEFAULT '',
                sender TEXT NOT NULL DEFAULT '',
                recipients TEXT NOT NULL DEFAULT '',
                received_at TEXT NOT NULL DEFAULT '',
                raw_data TEXT NOT NULL DEFAULT '',
                html_body TEXT NOT NULL DEFAULT '',
                text_body TEXT NOT NULL DEFAULT '',
                is_read INTEGER NOT NULL DEFAULT 0
            );

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
            );",
        )?;

        // Ensure config_json column exists for older rbw.db schemas
        let _ = conn.execute(
            "ALTER TABLE projects ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}'",
            [],
        );

        Ok(())
    })
}

pub fn make_project_db_id(project_name: &str, category: &str) -> String {
    let clean_name = project_name.trim().trim_matches(|c| c == '/' || c == '\\');
    let clean_cat = category.trim().trim_matches(|c| c == '/' || c == '\\');
    if !clean_cat.is_empty() && !clean_name.contains('/') && !clean_name.contains('\\') {
        format!("{}__{}", clean_cat.replace(['/', '\\'], "_"), clean_name.replace(['/', '\\'], "_"))
    } else {
        clean_name.replace(['/', '\\'], "_")
    }
}

fn upsert_project_config_conn(
    conn: &Connection,
    project_name: &str,
    category: &str,
    cfg: &Value,
    now: i64,
) {
    let id = make_project_db_id(project_name, category);
    let cfg_str = serde_json::to_string(cfg).unwrap_or_else(|_| "{}".to_string());
    let db_name = cfg.get("db_name").and_then(|v| v.as_str()).unwrap_or("");
    let demo_url = cfg.get("demo_url").and_then(|v| v.as_str()).unwrap_or("");
    let demo_srv = cfg.get("demo_server_id").and_then(|v| v.as_str()).unwrap_or("");
    let has_demo = if cfg.get("has_demo").and_then(|v| v.as_bool()).unwrap_or(false) || !demo_url.is_empty() {
        1
    } else {
        0
    };
    let lock_demo = if cfg.get("lock_demo").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
    let lock_prod = if cfg.get("lock_production").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };

    let _ = conn.execute(
        "INSERT INTO projects (id, name, category, db_name, demo_server_id, demo_url, has_demo, lock_demo, lock_production, config_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = CASE WHEN excluded.category != '' THEN excluded.category ELSE projects.category END,
            db_name = CASE WHEN excluded.db_name != '' THEN excluded.db_name ELSE projects.db_name END,
            demo_server_id = excluded.demo_server_id,
            demo_url = excluded.demo_url,
            has_demo = excluded.has_demo,
            lock_demo = excluded.lock_demo,
            lock_production = excluded.lock_production,
            config_json = excluded.config_json,
            updated_at = excluded.updated_at",
        params![
            id,
            project_name,
            category,
            db_name,
            demo_srv,
            demo_url,
            has_demo,
            lock_demo,
            lock_prod,
            cfg_str,
            now
        ],
    );
}

// ============================================================================
// SETTINGS & KEY-VALUE API (SINGLE PERSISTENT CONNECTION)
// ============================================================================

pub fn get_setting(key: &str) -> Option<String> {
    with_db(|conn| {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
    })
    .ok()
}

pub fn set_setting(key: &str, value: &str) -> Result<()> {
    with_db(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    })
}

pub fn get_json_setting(key: &str) -> Option<Value> {
    let raw = get_setting(key)?;
    serde_json::from_str::<Value>(&raw).ok()
}

pub fn set_json_setting(key: &str, val: &Value) -> Result<()> {
    let raw = serde_json::to_string(val).unwrap_or_else(|_| "{}".to_string());
    set_setting(key, &raw)
}

// ============================================================================
// PROJECT PHP, VHOST, SSL & CONFIG API (BATCHED + SINGLE CONNECTION)
// ============================================================================

pub fn get_project_php(name: &str) -> Option<String> {
    with_db(|conn| {
        let id = name.replace(['/', '\\'], "_");
        let id_double = name.replace(['/', '\\'], "__");
        conn.query_row(
            "SELECT php_version FROM projects WHERE (id = ?1 OR id = ?2 OR name = ?3) AND php_version != '' LIMIT 1",
            params![id, id_double, name],
            |r| r.get(0),
        )
    })
    .ok()
    .filter(|s: &String| !s.is_empty())
}

pub fn set_project_php(name: &str, php_version: &str) -> Result<()> {
    with_db(|conn| {
        let id = name.replace(['/', '\\'], "_");
        let now = chrono::Local::now().timestamp();
        conn.execute(
            "INSERT INTO projects (id, name, php_version, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET php_version = ?3, updated_at = ?4",
            params![id, name, php_version, now],
        )?;
        Ok(())
    })
}

pub fn get_all_projects_php_map() -> HashMap<String, String> {
    let mut map = HashMap::new();
    // 1. Load from settings('sites.json') if present
    if let Some(raw) = get_setting("sites.json") {
        if let Ok(m) = serde_json::from_str::<HashMap<String, String>>(&raw) {
            for (k, v) in m {
                if !v.is_empty() {
                    map.insert(k, v);
                }
            }
        }
    }
    // 2. Merge from projects table in single query
    let _ = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, category, php_version FROM projects WHERE php_version != ''",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        for item in rows.flatten() {
            let (id, name, cat, php) = item;
            map.insert(name.clone(), php.clone());
            map.insert(id, php.clone());
            if !cat.is_empty() {
                map.insert(format!("{}/{}", cat, name), php);
            }
        }
        Ok(())
    });
    map
}

pub fn set_project_vhost(name: &str, vhost: &str) -> Result<()> {
    with_db(|conn| {
        let id = name.replace(['/', '\\'], "_");
        let now = chrono::Local::now().timestamp();
        conn.execute(
            "INSERT INTO projects (id, name, vhost_domain, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET vhost_domain = ?3, updated_at = ?4",
            params![id, name, vhost, now],
        )?;
        Ok(())
    })
}

pub fn set_project_ssl(name: &str, ssl: bool) -> Result<()> {
    with_db(|conn| {
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
    })
}

pub fn get_all_vhosts_map() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let _ = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT name, vhost_domain FROM projects WHERE vhost_domain != ''",
        )?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for item in rows.flatten() {
            map.insert(item.0, item.1);
        }
        Ok(())
    });
    map
}

pub fn get_all_ssl_map() -> HashMap<String, bool> {
    let mut map = HashMap::new();
    let _ = with_db(|conn| {
        let mut stmt = conn.prepare("SELECT name, ssl_enabled FROM projects")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        for item in rows.flatten() {
            map.insert(item.0, item.1 != 0);
        }
        Ok(())
    });
    map
}

pub fn get_project_config_entry(project_name: &str, category: &str) -> Value {
    let id1 = make_project_db_id(project_name, category);
    let id2 = make_project_db_id(project_name, "");
    with_db(|conn| {
        let raw: String = conn.query_row(
            "SELECT config_json FROM projects
             WHERE (id = ?1 OR id = ?2 OR (name = ?3 AND category = ?4) OR name = ?3)
               AND config_json != '{}' AND config_json != ''
             ORDER BY CASE WHEN id = ?1 THEN 0 WHEN category = ?4 THEN 1 ELSE 2 END
             LIMIT 1",
            params![id1, id2, project_name, category],
            |r| r.get(0),
        )?;
        Ok(serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| json!({})))
    })
    .unwrap_or_else(|_| json!({}))
}

pub fn get_all_projects_config_map() -> HashMap<String, Value> {
    let mut map = HashMap::new();
    let _ = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, category, config_json FROM projects WHERE config_json != '{}' AND config_json != ''",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        for item in rows.flatten() {
            let (id, name, cat, raw) = item;
            if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                if val.as_object().map(|m| !m.is_empty()).unwrap_or(false) {
                    map.insert(id, val.clone());
                    if !cat.is_empty() {
                        map.insert(format!("{}/{}", cat, name), val.clone());
                    }
                    map.entry(name).or_insert(val);
                }
            }
        }
        Ok(())
    });
    map
}

pub fn save_project_config_entry(project_name: &str, category: &str, cfg: &Value) -> bool {
    let now = chrono::Local::now().timestamp();
    with_db(|conn| {
        upsert_project_config_conn(conn, project_name, category, cfg, now);
        Ok(true)
    })
    .unwrap_or(false)
}

pub fn delete_project_config_entry(project_name: &str, category: &str) -> bool {
    let id1 = make_project_db_id(project_name, category);
    let id2 = make_project_db_id(project_name, "");
    with_db(|conn| {
        conn.execute(
            "UPDATE projects SET config_json = '{}', has_demo = 0, demo_url = ''
             WHERE id = ?1 OR id = ?2 OR name = ?3",
            params![id1, id2, project_name],
        )?;
        Ok(true)
    })
    .unwrap_or(false)
}

// ============================================================================
// DIRECTORY SIZES CACHE API (SQLITE)
// ============================================================================

pub fn load_sizes_cache() -> HashMap<String, Value> {
    let mut map = HashMap::new();
    let _ = with_db(|conn| {
        let mut stmt = conn.prepare("SELECT key, path, mtime, size, updated_at FROM dir_sizes_cache")?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, f64>(3)?,
                r.get::<_, i64>(4)?,
            ))
        })?;
        for item in rows.flatten() {
            let (k, path, mtime, size, updated_at) = item;
            map.insert(
                k,
                json!({
                    "path": path,
                    "mtime": mtime as u64,
                    "size": size,
                    "updated_at": updated_at as u64
                }),
            );
        }
        Ok(())
    });
    map
}

pub fn save_sizes_cache(cache: &HashMap<String, Value>) {
    let _ = with_db(|conn| {
        let tx = conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO dir_sizes_cache (key, path, mtime, size, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;
            for (k, v) in cache {
                let path = v.get("path").and_then(|x| x.as_str()).unwrap_or("");
                let mtime = v.get("mtime").and_then(|x| x.as_u64()).unwrap_or(0) as i64;
                let size = v.get("size").and_then(|x| x.as_f64()).unwrap_or(0.0);
                let updated_at = v.get("updated_at").and_then(|x| x.as_u64()).unwrap_or(0) as i64;
                let _ = stmt.execute(params![k, path, mtime, size, updated_at]);
            }
        }
        tx.commit()?;
        Ok(())
    });
}

// ============================================================================
// CAUGHT EMAILS API (SQLITE)
// ============================================================================

pub fn load_caught_emails() -> Vec<CaughtEmail> {
    let mut list = Vec::new();
    let _ = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, subject, sender, recipients, received_at, raw_data, html_body, text_body, is_read
             FROM caught_emails ORDER BY id DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(CaughtEmail {
                id: r.get(0)?,
                subject: r.get(1)?,
                sender: r.get(2)?,
                recipients: r.get(3)?,
                received_at: r.get(4)?,
                raw_data: r.get(5)?,
                html_body: r.get(6)?,
                text_body: r.get(7)?,
                is_read: r.get::<_, i64>(8)? != 0,
            })
        })?;
        for item in rows.flatten() {
            list.push(item);
        }
        Ok(())
    });
    list
}

pub fn insert_caught_email(m: &CaughtEmail) -> Result<()> {
    with_db(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO caught_emails (id, subject, sender, recipients, received_at, raw_data, html_body, text_body, is_read)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                m.id,
                m.subject,
                m.sender,
                m.recipients,
                m.received_at,
                m.raw_data,
                m.html_body,
                m.text_body,
                if m.is_read { 1 } else { 0 }
            ],
        )?;
        Ok(())
    })
}

pub fn mark_caught_email_read(id: &str) -> Result<Vec<CaughtEmail>> {
    with_db(|conn| {
        conn.execute(
            "UPDATE caught_emails SET is_read = 1 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    })?;
    Ok(load_caught_emails())
}

pub fn delete_caught_email(id: &str) -> Result<Vec<CaughtEmail>> {
    with_db(|conn| {
        conn.execute("DELETE FROM caught_emails WHERE id = ?1", params![id])?;
        Ok(())
    })?;
    Ok(load_caught_emails())
}

pub fn clear_all_caught_emails() -> Result<Vec<CaughtEmail>> {
    with_db(|conn| {
        conn.execute("DELETE FROM caught_emails", [])?;
        Ok(())
    })?;
    Ok(Vec::new())
}
