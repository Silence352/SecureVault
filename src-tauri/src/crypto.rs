use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::RngCore, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;
use zeroize::Zeroize;

const NONCE_SIZE: usize = 12;
const SALT_SIZE: usize = 16;
const KEY_SIZE: usize = 32;

#[derive(Clone)]
pub struct MasterKey {
    key: [u8; KEY_SIZE],
}

impl MasterKey {
    pub fn new(key: [u8; KEY_SIZE]) -> Self {
        Self { key }
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.key
    }
}

impl Drop for MasterKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

pub struct CryptoEngine {
    master_key: Option<MasterKey>,
}

impl CryptoEngine {
    pub fn new() -> Self {
        Self { master_key: None }
    }

    pub fn is_unlocked(&self) -> bool {
        self.master_key.is_some()
    }

    pub fn derive_key(&self, password: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE], String> {
        let argon2 = Argon2::default();

        let mut key = [0u8; KEY_SIZE];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Key derivation failed: {}", e))?;

        Ok(key)
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, String> {
        let key = self.master_key.as_ref().ok_or("Vault is locked")?;

        let cipher = Aes256Gcm::new_from_slice(key.as_slice())
            .map_err(|e| format!("Cipher init failed: {}", e))?;

        let mut nonce_bytes = [0u8; NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        let mut combined = nonce_bytes.to_vec();
        combined.extend(ciphertext);

        Ok(BASE64.encode(&combined))
    }

    pub fn decrypt(&self, encrypted: &str) -> Result<String, String> {
        let key = self.master_key.as_ref().ok_or("Vault is locked")?;

        let combined = BASE64
            .decode(encrypted)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        if combined.len() < NONCE_SIZE {
            return Err("Invalid encrypted data".to_string());
        }

        let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
        let nonce = Nonce::from_slice(nonce_bytes);

        let cipher = Aes256Gcm::new_from_slice(key.as_slice())
            .map_err(|e| format!("Cipher init failed: {}", e))?;

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode failed: {}", e))
    }

    pub fn unlock(&mut self, password: &str, salt: &[u8], stored_hash: &str) -> Result<(), String> {
        // Verify password
        let parsed_hash =
            PasswordHash::new(stored_hash).map_err(|e| format!("Invalid stored hash: {}", e))?;

        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .map_err(|_| "Invalid master password")?;

        // Derive and store key
        let key = self.derive_key(password, salt)?;
        self.master_key = Some(MasterKey::new(key));

        Ok(())
    }

    pub fn lock(&mut self) {
        self.master_key = None;
    }

    pub fn get_key(&self) -> Option<&MasterKey> {
        self.master_key.as_ref()
    }
}

impl Default for CryptoEngine {
    fn default() -> Self {
        Self::new()
    }
}

pub fn generate_salt() -> [u8; SALT_SIZE] {
    let mut salt = [0u8; SALT_SIZE];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("Password hashing failed: {}", e))
}

pub fn generate_random_password(
    length: usize,
    use_uppercase: bool,
    use_lowercase: bool,
    use_numbers: bool,
    use_special: bool,
    exclude_chars: Option<&str>,
) -> Result<String, String> {
    let mut charset = String::new();

    if use_uppercase {
        charset.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }
    if use_lowercase {
        charset.push_str("abcdefghijklmnopqrstuvwxyz");
    }
    if use_numbers {
        charset.push_str("0123456789");
    }
    if use_special {
        charset.push_str("!@#$%^&*()_+-=[]{}|;:,.<>?");
    }

    if charset.is_empty() {
        charset.push_str("abcdefghijklmnopqrstuvwxyz");
    }

    if let Some(excluded) = exclude_chars {
        for c in excluded.chars() {
            charset = charset.replace(c, "");
        }
    }

    let charset: Vec<char> = charset.chars().collect();
    if charset.is_empty() {
        return Err("No characters available for password generation".to_string());
    }

    let mut rng = rand::thread_rng();
    let password: String = (0..length)
        .map(|_| charset[rng.gen_range(0..charset.len())])
        .collect();

    Ok(password)
}
