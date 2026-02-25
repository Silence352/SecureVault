use crate::crypto::{generate_salt, hash_password, CryptoEngine};
use crate::models::{
    get_default_categories, AccountTemplate, Category, CustomField, FieldType, PasswordRule,
    VaultConfig, VaultEntry,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use parking_lot::Mutex;
use rusqlite::{params, Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

pub struct Database {
    conn: Connection,
    crypto: Arc<Mutex<CryptoEngine>>,
}

unsafe impl Send for Database {}
unsafe impl Sync for Database {}

impl Database {
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        let conn = Connection::open(&db_path)?;
        let db = Self {
            conn,
            crypto: Arc::new(Mutex::new(CryptoEngine::new())),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqliteResult<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                url TEXT,
                notes TEXT,
                category TEXT NOT NULL,
                custom_fields TEXT,
                password_rule TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                favorite INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                default_fields TEXT,
                default_rule TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
            CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite);
            ",
        )?;
        Ok(())
    }

    pub fn is_initialized(&self) -> bool {
        self.conn
            .query_row(
                "SELECT value FROM config WHERE key = 'password_hash'",
                [],
                |row| row.get::<_, String>(0),
            )
            .is_ok()
    }

    pub fn setup_vault(&self, master_password: &str) -> Result<(), String> {
        if self.is_initialized() {
            return Err("Vault already initialized".to_string());
        }

        let salt = generate_salt();
        let salt_b64 = BASE64.encode(&salt);
        let password_hash = hash_password(master_password)?;

        self.conn
            .execute(
                "INSERT INTO config (key, value) VALUES ('salt', ?1)",
                params![salt_b64],
            )
            .map_err(|e| format!("Failed to save salt: {}", e))?;

        self.conn
            .execute(
                "INSERT INTO config (key, value) VALUES ('password_hash', ?1)",
                params![password_hash],
            )
            .map_err(|e| format!("Failed to save password hash: {}", e))?;

        let config = VaultConfig::new(salt_b64, password_hash);
        self.save_config(&config)?;

        self.init_default_templates()?;

        Ok(())
    }

    fn init_default_templates(&self) -> Result<(), String> {
        let templates = vec![
            AccountTemplate {
                id: "social".to_string(),
                name: "Social Media".to_string(),
                category: "login".to_string(),
                default_fields: vec![],
                default_rule: PasswordRule {
                    length: 20,
                    use_uppercase: true,
                    use_lowercase: true,
                    use_numbers: true,
                    use_special: true,
                    exclude_chars: None,
                    must_start_with: None,
                    must_contain: None,
                },
            },
            AccountTemplate {
                id: "bank".to_string(),
                name: "Bank Account".to_string(),
                category: "bank".to_string(),
                default_fields: vec![],
                default_rule: PasswordRule {
                    length: 16,
                    use_uppercase: true,
                    use_lowercase: true,
                    use_numbers: true,
                    use_special: false,
                    exclude_chars: Some("0O1lI".to_string()),
                    must_start_with: None,
                    must_contain: None,
                },
            },
            AccountTemplate {
                id: "email".to_string(),
                name: "Email Account".to_string(),
                category: "login".to_string(),
                default_fields: vec![],
                default_rule: PasswordRule {
                    length: 24,
                    use_uppercase: true,
                    use_lowercase: true,
                    use_numbers: true,
                    use_special: true,
                    exclude_chars: None,
                    must_start_with: None,
                    must_contain: None,
                },
            },
        ];

        for template in templates {
            self.save_template(&template)?;
        }

        Ok(())
    }

    pub fn unlock(&self, master_password: &str) -> Result<(), String> {
        let salt_b64: String = self
            .conn
            .query_row("SELECT value FROM config WHERE key = 'salt'", [], |row| {
                row.get(0)
            })
            .map_err(|_| "Vault not initialized")?;

        let password_hash: String = self
            .conn
            .query_row(
                "SELECT value FROM config WHERE key = 'password_hash'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "Vault not initialized")?;

        let salt = BASE64
            .decode(&salt_b64)
            .map_err(|e| format!("Invalid salt: {}", e))?;

        let mut crypto = self.crypto.lock();
        crypto.unlock(master_password, &salt, &password_hash)?;

        self.conn
            .execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES ('last_unlocked', ?1)",
                params![Utc::now().to_rfc3339()],
            )
            .ok();

        Ok(())
    }

    pub fn lock(&self) {
        let mut crypto = self.crypto.lock();
        crypto.lock();
    }

    pub fn reset_vault(&self) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM config", [])
            .map_err(|e| format!("Failed to reset vault: {}", e))?;
        self.conn
            .execute("DELETE FROM entries", [])
            .map_err(|e| format!("Failed to reset vault: {}", e))?;
        self.conn
            .execute("DELETE FROM templates", [])
            .map_err(|e| format!("Failed to reset vault: {}", e))?;

        // Lock the vault
        let mut crypto = self.crypto.lock();
        crypto.lock();

        Ok(())
    }

    pub fn is_unlocked(&self) -> bool {
        self.crypto.lock().is_unlocked()
    }

    fn save_config(&self, config: &VaultConfig) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES ('salt', ?1)",
                params![config.salt],
            )
            .map_err(|e| format!("Failed to save salt: {}", e))?;

        self.conn
            .execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES ('password_hash', ?1)",
                params![config.password_hash],
            )
            .map_err(|e| format!("Failed to save password hash: {}", e))?;

        Ok(())
    }

    pub fn save_entry(&self, entry: &VaultEntry) -> Result<(), String> {
        let crypto = self.crypto.lock();

        if !crypto.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let custom_fields_json = serde_json::to_string(&entry.custom_fields)
            .map_err(|e| format!("Failed to serialize custom fields: {}", e))?;

        let password_rule_json = entry
            .password_rule
            .as_ref()
            .map(|r| serde_json::to_string(r))
            .transpose()
            .map_err(|e| format!("Failed to serialize password rule: {}", e))?;

        let encrypted_password = crypto.encrypt(&entry.password)?;
        let username_encrypted = crypto.encrypt(&entry.username)?;
        let notes_encrypted = entry
            .notes
            .as_ref()
            .map(|n| crypto.encrypt(n))
            .transpose()?;

        self.conn
            .execute(
                "INSERT OR REPLACE INTO entries 
                (id, title, username, password, url, notes, category, custom_fields, password_rule, created_at, updated_at, favorite)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    entry.id,
                    entry.title,
                    username_encrypted,
                    encrypted_password,
                    entry.url,
                    notes_encrypted,
                    entry.category,
                    custom_fields_json,
                    password_rule_json,
                    entry.created_at.to_rfc3339(),
                    entry.updated_at.to_rfc3339(),
                    entry.favorite as i32
                ],
            )
            .map_err(|e| format!("Failed to save entry: {}", e))?;

        Ok(())
    }

    pub fn get_entries(&self) -> Result<Vec<VaultEntry>, String> {
        let crypto = self.crypto.lock();

        if !crypto.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let mut stmt = self.conn
            .prepare(
                "SELECT id, title, username, password, url, notes, category, custom_fields, password_rule, created_at, updated_at, favorite
                FROM entries ORDER BY updated_at DESC"
            )
            .map_err(|e| format!("Query prepare failed: {}", e))?;

        let entries = stmt
            .query_map([], |row| {
                let custom_fields_json: String = row.get(7)?;
                let password_rule_json: Option<String> = row.get(8)?;
                let notes_encrypted: Option<String> = row.get(5)?;
                let username_encrypted: String = row.get(2)?;
                let password_encrypted: String = row.get(3)?;

                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    username_encrypted,
                    password_encrypted,
                    row.get::<_, Option<String>>(4)?,
                    notes_encrypted,
                    row.get::<_, String>(6)?,
                    custom_fields_json,
                    password_rule_json,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, i32>(11)?,
                ))
            })
            .map_err(|e| format!("Query failed: {}", e))?;

        let mut result = Vec::new();

        for entry_result in entries {
            let (
                id,
                title,
                username_enc,
                password_enc,
                url,
                notes_enc,
                category,
                custom_fields_json,
                password_rule_json,
                created_at,
                updated_at,
                favorite,
            ) = entry_result.map_err(|e| format!("Row read failed: {}", e))?;

            let username = crypto
                .decrypt(&username_enc)
                .map_err(|e| format!("Failed to decrypt username: {}", e))?;

            let password = crypto
                .decrypt(&password_enc)
                .map_err(|e| format!("Failed to decrypt password: {}", e))?;

            let notes = notes_enc
                .map(|n| crypto.decrypt(&n))
                .transpose()
                .map_err(|e| format!("Failed to decrypt notes: {}", e))?;

            let custom_fields: Vec<CustomField> =
                serde_json::from_str(&custom_fields_json).unwrap_or_default();

            let password_rule: Option<PasswordRule> = password_rule_json
                .map(|j| serde_json::from_str(&j))
                .transpose()
                .ok()
                .flatten();

            result.push(VaultEntry {
                id,
                title,
                username,
                password,
                url,
                notes,
                category,
                custom_fields,
                password_rule,
                created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                favorite: favorite != 0,
            });
        }

        Ok(result)
    }

    pub fn delete_entry(&self, id: &str) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        self.conn
            .execute("DELETE FROM entries WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete entry: {}", e))?;

        Ok(())
    }

    pub fn get_entry(&self, id: &str) -> Result<VaultEntry, String> {
        let entries = self.get_entries()?;
        entries
            .into_iter()
            .find(|e| e.id == id)
            .ok_or_else(|| "Entry not found".to_string())
    }

    pub fn save_template(&self, template: &AccountTemplate) -> Result<(), String> {
        let default_fields_json = serde_json::to_string(&template.default_fields)
            .map_err(|e| format!("Failed to serialize fields: {}", e))?;

        let default_rule_json = serde_json::to_string(&template.default_rule)
            .map_err(|e| format!("Failed to serialize rule: {}", e))?;

        self.conn
            .execute(
                "INSERT OR REPLACE INTO templates (id, name, category, default_fields, default_rule)
                VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    template.id,
                    template.name,
                    template.category,
                    default_fields_json,
                    default_rule_json
                ],
            )
            .map_err(|e| format!("Failed to save template: {}", e))?;

        Ok(())
    }

    pub fn get_templates(&self) -> Result<Vec<AccountTemplate>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, category, default_fields, default_rule FROM templates")
            .map_err(|e| format!("Query prepare failed: {}", e))?;

        let templates = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| format!("Query failed: {}", e))?;

        let mut result = Vec::new();

        for template_result in templates {
            let (id, name, category, default_fields_json, default_rule_json) =
                template_result.map_err(|e| format!("Row read failed: {}", e))?;

            let default_fields: Vec<crate::models::TemplateField> =
                serde_json::from_str(&default_fields_json).unwrap_or_default();

            let default_rule: PasswordRule =
                serde_json::from_str(&default_rule_json).unwrap_or_default();

            result.push(AccountTemplate {
                id,
                name,
                category,
                default_fields,
                default_rule,
            });
        }

        Ok(result)
    }

    pub fn get_categories(&self) -> Result<Vec<Category>, String> {
        let mut categories = get_default_categories();

        let mut stmt = self
            .conn
            .prepare("SELECT category, COUNT(*) as count FROM entries GROUP BY category")
            .map_err(|e| format!("Query failed: {}", e))?;

        let counts: Vec<(String, usize)> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, usize>(1)?))
            })
            .map_err(|e| format!("Query failed: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        for (category_id, count) in counts {
            if let Some(cat) = categories.iter_mut().find(|c| c.id == category_id) {
                cat.entry_count = count;
            }
        }

        Ok(categories)
    }

    pub fn change_master_password(
        &self,
        old_password: &str,
        new_password: &str,
    ) -> Result<(), String> {
        let salt_b64: String = self
            .conn
            .query_row("SELECT value FROM config WHERE key = 'salt'", [], |row| {
                row.get(0)
            })
            .map_err(|_| "Vault not initialized")?;

        let old_hash: String = self
            .conn
            .query_row(
                "SELECT value FROM config WHERE key = 'password_hash'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "Vault not initialized")?;

        let salt = BASE64
            .decode(&salt_b64)
            .map_err(|e| format!("Invalid salt: {}", e))?;

        let mut crypto = CryptoEngine::new();
        crypto.unlock(old_password, &salt, &old_hash)?;

        let entries = self.get_entries()?;

        let new_salt = generate_salt();
        let new_salt_b64 = BASE64.encode(&new_salt);
        let new_hash = hash_password(new_password)?;

        for entry in entries {
            self.save_entry(&entry)
                .map_err(|e| format!("Failed to re-encrypt entry: {}", e))?;
        }

        self.conn
            .execute(
                "UPDATE config SET value = ?1 WHERE key = 'salt'",
                params![new_salt_b64],
            )
            .map_err(|e| format!("Failed to update salt: {}", e))?;

        self.conn
            .execute(
                "UPDATE config SET value = ?1 WHERE key = 'password_hash'",
                params![new_hash],
            )
            .map_err(|e| format!("Failed to update password hash: {}", e))?;

        Ok(())
    }
}
