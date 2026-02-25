use crate::crypto::generate_random_password;
use crate::db::Database;
use crate::models::{AccountTemplate, Category, PasswordRule, VaultEntry};
use chrono::Utc;
use enigo::{Enigo, Keyboard, Settings};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::time::sleep;
use uuid::Uuid;

pub struct AppState {
    pub db: Arc<Database>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntryDto {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: String,
    pub custom_fields: Vec<crate::models::CustomField>,
    pub password_rule: Option<PasswordRule>,
    pub created_at: String,
    pub updated_at: String,
    pub favorite: bool,
}

impl From<VaultEntry> for EntryDto {
    fn from(e: VaultEntry) -> Self {
        Self {
            id: e.id,
            title: e.title,
            username: e.username,
            password: e.password,
            url: e.url,
            notes: e.notes,
            category: e.category,
            custom_fields: e.custom_fields,
            password_rule: e.password_rule,
            created_at: e.created_at.to_rfc3339(),
            updated_at: e.updated_at.to_rfc3339(),
            favorite: e.favorite,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateEntryRequest {
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: String,
    pub custom_fields: Option<Vec<crate::models::CustomField>>,
    pub password_rule: Option<PasswordRule>,
    pub favorite: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntryRequest {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub category: String,
    pub custom_fields: Option<Vec<crate::models::CustomField>>,
    pub password_rule: Option<PasswordRule>,
    pub favorite: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateDto {
    pub id: String,
    pub name: String,
    pub category: String,
    pub default_fields: Vec<crate::models::TemplateField>,
    pub default_rule: PasswordRule,
}

impl From<AccountTemplate> for TemplateDto {
    fn from(t: AccountTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name,
            category: t.category,
            default_fields: t.default_fields,
            default_rule: t.default_rule,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub entry_count: usize,
}

impl From<Category> for CategoryDto {
    fn from(c: Category) -> Self {
        Self {
            id: c.id,
            name: c.name,
            icon: c.icon,
            entry_count: c.entry_count,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratePasswordRequest {
    pub length: Option<usize>,
    pub use_uppercase: Option<bool>,
    pub use_lowercase: Option<bool>,
    pub use_numbers: Option<bool>,
    pub use_special: Option<bool>,
    pub exclude_chars: Option<String>,
}

#[tauri::command]
pub fn check_vault_exists(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.db.is_initialized())
}

#[tauri::command]
pub fn reset_vault(state: State<'_, AppState>) -> Result<(), String> {
    state.db.reset_vault()
}

#[tauri::command]
pub fn setup_vault(state: State<'_, AppState>, password: String) -> Result<(), String> {
    state.db.setup_vault(&password)
}

#[tauri::command]
pub fn unlock_vault(state: State<'_, AppState>, password: String) -> Result<(), String> {
    state.db.unlock(&password)
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    state.db.lock();
    Ok(())
}

#[tauri::command]
pub fn is_vault_unlocked(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.db.is_unlocked())
}

#[tauri::command]
pub fn get_entries(state: State<'_, AppState>) -> Result<Vec<EntryDto>, String> {
    let entries = state.db.get_entries()?;
    Ok(entries.into_iter().map(EntryDto::from).collect())
}

#[tauri::command]
pub fn get_entry(state: State<'_, AppState>, id: String) -> Result<EntryDto, String> {
    let entry = state.db.get_entry(&id)?;
    Ok(EntryDto::from(entry))
}

#[tauri::command]
pub fn create_entry(
    state: State<'_, AppState>,
    request: CreateEntryRequest,
) -> Result<EntryDto, String> {
    let entry = VaultEntry::new(
        request.title,
        request.username,
        request.password,
        request.url,
        request.notes,
        request.category,
    );

    let mut entry = entry;
    if let Some(fields) = request.custom_fields {
        entry.custom_fields = fields;
    }
    if let Some(rule) = request.password_rule {
        entry.password_rule = Some(rule);
    }
    if let Some(fav) = request.favorite {
        entry.favorite = fav;
    }
    entry.updated_at = Utc::now();

    state.db.save_entry(&entry)?;
    Ok(EntryDto::from(entry))
}

#[tauri::command]
pub fn update_entry(
    state: State<'_, AppState>,
    request: UpdateEntryRequest,
) -> Result<EntryDto, String> {
    let existing = state.db.get_entry(&request.id)?;

    let mut entry = existing;
    entry.title = request.title;
    entry.username = request.username;
    entry.password = request.password;
    entry.url = request.url;
    entry.notes = request.notes;
    entry.category = request.category;
    entry.custom_fields = request.custom_fields.unwrap_or_default();
    entry.password_rule = request.password_rule;
    entry.favorite = request.favorite.unwrap_or(false);
    entry.updated_at = Utc::now();

    state.db.save_entry(&entry)?;
    Ok(EntryDto::from(entry))
}

#[tauri::command]
pub fn delete_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_entry(&id)
}

#[tauri::command]
pub fn toggle_favorite(state: State<'_, AppState>, id: String) -> Result<EntryDto, String> {
    let mut entry = state.db.get_entry(&id)?;
    entry.favorite = !entry.favorite;
    entry.updated_at = Utc::now();
    state.db.save_entry(&entry)?;
    Ok(EntryDto::from(entry))
}

#[tauri::command]
pub fn generate_password(request: GeneratePasswordRequest) -> Result<String, String> {
    generate_random_password(
        request.length.unwrap_or(16),
        request.use_uppercase.unwrap_or(true),
        request.use_lowercase.unwrap_or(true),
        request.use_numbers.unwrap_or(true),
        request.use_special.unwrap_or(true),
        request.exclude_chars.as_deref(),
    )
}

#[tauri::command]
pub fn get_templates(state: State<'_, AppState>) -> Result<Vec<TemplateDto>, String> {
    let templates = state.db.get_templates()?;
    Ok(templates.into_iter().map(TemplateDto::from).collect())
}

#[tauri::command]
pub fn get_template(state: State<'_, AppState>, id: String) -> Result<TemplateDto, String> {
    let templates = state.db.get_templates()?;
    templates
        .into_iter()
        .find(|t| t.id == id)
        .map(TemplateDto::from)
        .ok_or_else(|| "Template not found".to_string())
}

#[tauri::command]
pub fn create_template(
    state: State<'_, AppState>,
    name: String,
    category: String,
    default_rule: PasswordRule,
) -> Result<TemplateDto, String> {
    let template = AccountTemplate {
        id: Uuid::new_v4().to_string(),
        name,
        category,
        default_fields: vec![],
        default_rule,
    };
    state.db.save_template(&template)?;
    Ok(TemplateDto::from(template))
}

#[tauri::command]
pub fn get_categories(state: State<'_, AppState>) -> Result<Vec<CategoryDto>, String> {
    let categories = state.db.get_categories()?;
    Ok(categories.into_iter().map(CategoryDto::from).collect())
}

#[tauri::command]
pub fn search_entries(state: State<'_, AppState>, query: String) -> Result<Vec<EntryDto>, String> {
    let entries = state.db.get_entries()?;
    let query_lower = query.to_lowercase();

    let filtered: Vec<EntryDto> = entries
        .into_iter()
        .filter(|e| {
            e.title.to_lowercase().contains(&query_lower)
                || e.username.to_lowercase().contains(&query_lower)
                || e.url
                    .as_ref()
                    .map(|u| u.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || e.category.to_lowercase().contains(&query_lower)
        })
        .map(EntryDto::from)
        .collect();

    Ok(filtered)
}

#[tauri::command]
pub fn change_master_password(
    state: State<'_, AppState>,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    state
        .db
        .change_master_password(&old_password, &new_password)
}

pub fn init_app_state(app_dir: PathBuf) -> Result<AppState, String> {
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;

    let db_path = app_dir.join("vault.db");
    let db = Database::new(db_path).map_err(|e| format!("Failed to initialize database: {}", e))?;

    Ok(AppState { db: Arc::new(db) })
}

#[tauri::command]
pub fn get_cursor_position(app: AppHandle) -> Result<(f64, f64), String> {
    app.cursor_position()
        .map(|pos| (pos.x, pos.y))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_quick_panel(app: AppHandle) -> Result<(), String> {
    log::info!("[QuickPanel] Emitting show-quick-panel event...");
    
    app.emit("show-quick-panel", ())
        .map_err(|e| {
            log::error!("[QuickPanel] Failed to emit event: {}", e);
            e.to_string()
        })?;
    
    log::info!("[QuickPanel] Event emitted successfully");
    Ok(())
}

#[tauri::command]
pub fn close_quick_panel(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quickpanel") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn copy_password_to_clipboard(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    if !state.db.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    let entry = state.db.get_entry(&id)?;
    let password = entry.password.clone();

    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(&password)
        .map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    tokio::spawn(async move {
        sleep(Duration::from_secs(30)).await;
        if let Err(e) = app_clone.clipboard().write_text("") {
            log::error!("Failed to clear clipboard: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn copy_username_to_clipboard(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    if !state.db.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    let entry = state.db.get_entry(&id)?;
    let username = entry.username.clone();

    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(&username)
        .map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    tokio::spawn(async move {
        sleep(Duration::from_secs(30)).await;
        if let Err(e) = app_clone.clipboard().write_text("") {
            log::error!("Failed to clear clipboard: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn simulate_paste() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;

    enigo
        .key(enigo::Key::Control, enigo::Direction::Press)
        .map_err(|e| e.to_string())?;
    enigo
        .key(enigo::Key::Unicode('v'), enigo::Direction::Click)
        .map_err(|e| e.to_string())?;
    enigo
        .key(enigo::Key::Control, enigo::Direction::Release)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuickEntryDto {
    pub id: String,
    pub title: String,
    pub username: String,
    pub category: String,
    pub favorite: bool,
}

#[tauri::command]
pub fn get_quick_entries(state: State<'_, AppState>) -> Result<Vec<QuickEntryDto>, String> {
    if !state.db.is_unlocked() {
        return Ok(vec![]);
    }

    let entries = state.db.get_entries()?;
    let quick_entries: Vec<QuickEntryDto> = entries
        .into_iter()
        .map(|e| QuickEntryDto {
            id: e.id,
            title: e.title,
            username: e.username,
            category: e.category,
            favorite: e.favorite,
        })
        .collect();

    Ok(quick_entries)
}
