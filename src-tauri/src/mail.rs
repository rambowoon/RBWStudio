use base64::Engine;
use chrono::Local;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaughtEmail {
    #[serde(rename = "Id")]
    pub id: String,
    #[serde(rename = "Subject")]
    pub subject: String,
    #[serde(rename = "Sender")]
    pub sender: String,
    #[serde(rename = "Recipients")]
    pub recipients: String,
    #[serde(rename = "ReceivedAt")]
    pub received_at: String,
    #[serde(rename = "RawData")]
    pub raw_data: String,
    #[serde(rename = "HtmlBody")]
    pub html_body: String,
    #[serde(rename = "TextBody")]
    pub text_body: String,
    #[serde(rename = "IsRead")]
    pub is_read: bool,
}

static SMTP_RUNNING: AtomicBool = AtomicBool::new(false);
pub fn load_emails() -> Vec<CaughtEmail> {
    crate::db::load_caught_emails()
}

pub fn mark_email_read(id: &str) -> Result<Vec<CaughtEmail>, String> {
    crate::db::mark_caught_email_read(id).map_err(|e| e.to_string())
}

pub fn delete_email(id: &str) -> Result<Vec<CaughtEmail>, String> {
    crate::db::delete_caught_email(id).map_err(|e| e.to_string())
}

pub fn clear_all_emails() -> Result<Vec<CaughtEmail>, String> {
    crate::db::clear_all_caught_emails().map_err(|e| e.to_string())
}

pub fn start_smtp_server() {
    if SMTP_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    thread::spawn(move || {
        let listener = match TcpListener::bind("127.0.0.1:1025") {
            Ok(l) => l,
            Err(_) => {
                SMTP_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        for stream in listener.incoming() {
            if !SMTP_RUNNING.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(s) = stream {
                thread::spawn(move || handle_smtp_client(s));
            }
        }
    });
}

fn handle_smtp_client(mut stream: TcpStream) {
    let _ = stream.write_all(b"220 RBWStack Local SMTP Server Ready\r\n");
    let cloned = match stream.try_clone() {
        Ok(c) => c,
        Err(_) => return,
    };
    let mut reader = BufReader::new(cloned);
    let mut sender = String::new();
    let mut recipients: Vec<String> = Vec::new();
    let mut raw_data = String::new();
    let mut in_data = false;
    let mut in_auth = false;

    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }

        if in_data {
            if line.trim_end_matches(&['\r', '\n'][..]) == "." {
                in_data = false;
                let _ = stream.write_all(b"250 2.0.0 OK: Message queued\r\n");
                process_and_store_email(&sender, &recipients.join(", "), &raw_data);
                raw_data.clear();
            } else {
                let clean = if line.starts_with("..") {
                    &line[1..]
                } else {
                    &line[..]
                };
                raw_data.push_str(clean);
            }
            continue;
        }

        let trimmed = line.trim();
        let upper = trimmed.to_uppercase();

        if in_auth {
            in_auth = false;
            let _ = stream.write_all(b"235 2.7.0 Authentication successful\r\n");
            continue;
        }

        if upper.starts_with("EHLO") || upper.starts_with("HELO") {
            let _ = stream.write_all(b"250-rbwstack.local\r\n250-SIZE 52428800\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n");
        } else if upper.starts_with("AUTH PLAIN") || upper.starts_with("AUTH LOGIN") {
            if upper == "AUTH LOGIN" {
                in_auth = true;
                let _ = stream.write_all(b"334 VXNlcm5hbWU6\r\n");
            } else {
                let _ = stream.write_all(b"235 2.7.0 Authentication successful\r\n");
            }
        } else if upper.starts_with("MAIL FROM:") {
            sender = extract_email_addr(&trimmed[10..]);
            let _ = stream.write_all(b"250 2.1.0 Ok\r\n");
        } else if upper.starts_with("RCPT TO:") {
            recipients.push(extract_email_addr(&trimmed[8..]));
            let _ = stream.write_all(b"250 2.1.5 Ok\r\n");
        } else if upper == "DATA" {
            in_data = true;
            let _ = stream.write_all(b"354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if upper == "RSET" {
            sender.clear();
            recipients.clear();
            raw_data.clear();
            let _ = stream.write_all(b"250 2.0.0 Ok\r\n");
        } else if upper == "NOOP" {
            let _ = stream.write_all(b"250 2.0.0 Ok\r\n");
        } else if upper == "QUIT" {
            let _ = stream.write_all(b"221 2.0.0 Bye\r\n");
            break;
        } else {
            let _ = stream.write_all(b"250 Ok\r\n");
        }
    }
}

fn extract_email_addr(input: &str) -> String {
    let s = input.trim();
    if let (Some(start), Some(end)) = (s.find('<'), s.find('>')) {
        if end > start {
            return s[start + 1..end].trim().to_string();
        }
    }
    s.to_string()
}

fn decode_mime_header(input: &str) -> String {
    let re = match Regex::new(r"=\?([^?]+)\?([bBqQ])\?([^?]+)\?=") {
        Ok(r) => r,
        Err(_) => return input.to_string(),
    };
    re.replace_all(input, |caps: &regex::Captures| {
        let encoding = caps[2].to_uppercase();
        let encoded_text = &caps[3];
        if encoding == "B" {
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(encoded_text) {
                return String::from_utf8_lossy(&bytes).to_string();
            }
        } else if encoding == "Q" {
            let replaced = encoded_text.replace('_', " ");
            return decode_quoted_printable(&replaced);
        }
        caps[0].to_string()
    })
    .to_string()
}

pub fn decode_quoted_printable(input: &str) -> String {
    let cleaned = input.replace("=\r\n", "").replace("=\n", "");
    let bytes = cleaned.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'=' && i + 2 < bytes.len() {
            if let (Some(h1), Some(h2)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push(((h1 << 4) | h2) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn process_and_store_email(sender: &str, recipients: &str, raw_data: &str) {
    let normalized = raw_data.replace("\r\n", "\n");
    let (headers_part, body_part) = match normalized.find("\n\n") {
        Some(idx) => (&normalized[..idx], &normalized[idx + 2..]),
        None => (normalized.as_str(), ""),
    };

    let mut subject = "(No Subject)".to_string();
    let mut from_header = sender.to_string();
    let mut to_header = recipients.to_string();
    let mut is_qp = false;
    let mut is_b64 = false;

    for line in headers_part.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("subject:") {
            subject = decode_mime_header(line[8..].trim());
        } else if lower.starts_with("from:") && from_header.is_empty() {
            from_header = decode_mime_header(line[5..].trim());
        } else if lower.starts_with("to:") && to_header.is_empty() {
            to_header = decode_mime_header(line[3..].trim());
        } else if lower.starts_with("content-transfer-encoding:") {
            if lower.contains("quoted-printable") {
                is_qp = true;
            } else if lower.contains("base64") {
                is_b64 = true;
            }
        }
    }

    let decoded_body = if is_qp {
        decode_quoted_printable(body_part)
    } else if is_b64 {
        let clean_b64: String = body_part.chars().filter(|c| !c.is_whitespace()).collect();
        base64::engine::general_purpose::STANDARD
            .decode(clean_b64)
            .map(|b| String::from_utf8_lossy(&b).to_string())
            .unwrap_or_else(|_| body_part.to_string())
    } else {
        decode_quoted_printable(body_part)
    };

    let mut html_body: String;
    let text_body: String;

    if decoded_body.to_lowercase().contains("<html") || decoded_body.to_lowercase().contains("<body") || decoded_body.to_lowercase().contains("<div") || decoded_body.to_lowercase().contains("<table") {
        // Extract HTML section if multipart
        if let Some(start) = decoded_body.to_lowercase().find("<html") {
            html_body = decoded_body[start..].to_string();
            if let Some(end) = html_body.to_lowercase().rfind("</html>") {
                html_body = html_body[..end + 7].to_string();
            }
        } else {
            html_body = decoded_body.clone();
        }
        text_body = decoded_body;
    } else {
        text_body = decoded_body.clone();
        html_body = format!(
            "<pre style=\"font-family:Segoe UI,sans-serif;white-space:pre-wrap;\">{}</pre>",
            decoded_body.replace('<', "&lt;").replace('>', "&gt;")
        );
    }

    let email = CaughtEmail {
        id: format!("{}", Local::now().timestamp_millis()),
        subject,
        sender: from_header,
        recipients: to_header,
        received_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        raw_data: raw_data.to_string(),
        html_body,
        text_body,
        is_read: false,
    };

    let _ = crate::db::insert_caught_email(&email);
}

