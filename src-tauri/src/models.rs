use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: String,
    pub custom_fields: Vec<CustomField>,
    pub password_rule: Option<PasswordRule>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomField {
    pub name: String,
    pub value: String,
    pub field_type: FieldType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    Text,
    Password,
    Email,
    Phone,
    Number,
    Url,
    Date,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordRule {
    pub length: usize,
    pub use_uppercase: bool,
    pub use_lowercase: bool,
    pub use_numbers: bool,
    pub use_special: bool,
    pub exclude_chars: Option<String>,
    pub must_start_with: Option<String>,
    pub must_contain: Option<String>,
}

impl Default for PasswordRule {
    fn default() -> Self {
        Self {
            length: 16,
            use_uppercase: true,
            use_lowercase: true,
            use_numbers: true,
            use_special: true,
            exclude_chars: None,
            must_start_with: None,
            must_contain: None,
        }
    }
}

impl VaultEntry {
    pub fn new(
        title: String,
        username: String,
        password: String,
        url: Option<String>,
        notes: Option<String>,
        category: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            title,
            username,
            password,
            url,
            notes,
            category: category.clone(),
            custom_fields: Vec::new(),
            password_rule: None,
            created_at: now,
            updated_at: now,
            favorite: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountTemplate {
    pub id: String,
    pub name: String,
    pub category: String,
    pub default_fields: Vec<TemplateField>,
    pub default_rule: PasswordRule,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateField {
    pub name: String,
    pub field_type: FieldType,
    pub required: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub salt: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub last_unlocked: Option<DateTime<Utc>>,
}

impl VaultConfig {
    pub fn new(salt: String, password_hash: String) -> Self {
        Self {
            salt,
            password_hash,
            created_at: Utc::now(),
            last_unlocked: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub entry_count: usize,
}

pub fn get_default_categories() -> Vec<Category> {
    vec![
        Category {
            id: "login".to_string(),
            name: "Login".to_string(),
            icon: "key".to_string(),
            entry_count: 0,
        },
        Category {
            id: "card".to_string(),
            name: "Credit Card".to_string(),
            icon: "credit-card".to_string(),
            entry_count: 0,
        },
        Category {
            id: "identity".to_string(),
            name: "Identity".to_string(),
            icon: "user".to_string(),
            entry_count: 0,
        },
        Category {
            id: "note".to_string(),
            name: "Secure Note".to_string(),
            icon: "file-text".to_string(),
            entry_count: 0,
        },
        Category {
            id: "bank".to_string(),
            name: "Bank Account".to_string(),
            icon: "building".to_string(),
            entry_count: 0,
        },
        Category {
            id: "server".to_string(),
            name: "Server".to_string(),
            icon: "server".to_string(),
            entry_count: 0,
        },
        Category {
            id: "database".to_string(),
            name: "Database".to_string(),
            icon: "database".to_string(),
            entry_count: 0,
        },
    ]
}
