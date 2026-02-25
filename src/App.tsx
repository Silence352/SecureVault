import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { 
  Shield, Lock, Plus, Search, Star, Trash2, Edit2, Copy, Eye, EyeOff, 
  Key, CreditCard, User, FileText, Building, Server, Database, X, Settings as SettingsIcon
} from 'lucide-react';
import { useGlobalShortcut } from './hooks/useGlobalShortcut';
import TitleBar from './components/TitleBar';
import Settings from './components/Settings';
import './App.css';

interface Entry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string | null;
  notes: string | null;
  category: string;
  custom_fields: CustomField[];
  password_rule: PasswordRule | null;
  created_at: string;
  updated_at: string;
  favorite: boolean;
}

interface CustomField {
  name: string;
  value: string;
  field_type: string;
}

interface PasswordRule {
  length: number;
  use_uppercase: boolean;
  use_lowercase: boolean;
  use_numbers: boolean;
  use_special: boolean;
  exclude_chars: string | null;
  must_start_with: string | null;
  must_contain: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  entry_count: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  login: <Key size={20} />,
  card: <CreditCard size={20} />,
  identity: <User size={20} />,
  note: <FileText size={20} />,
  bank: <Building size={20} />,
  server: <Server size={20} />,
  database: <Database size={20} />,
};

function App() {
  const { reloadShortcut } = useGlobalShortcut();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordLength, setPasswordLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSpecial, setUseSpecial] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    category: 'login',
    favorite: false,
  });

  useEffect(() => {
    checkVaultStatus();
  }, []);

  const checkVaultStatus = async () => {
    try {
      const exists = await invoke<boolean>('check_vault_exists');
      setIsInitialized(exists);
      if (exists) {
        const unlocked = await invoke<boolean>('is_vault_unlocked');
        setIsUnlocked(unlocked);
        if (unlocked) {
          loadData();
        }
      }
    } catch (err) {
      console.error('Failed to check vault status:', err);
    }
  };

  const loadData = async () => {
    try {
      const [entriesData, categoriesData] = await Promise.all([
        invoke<Entry[]>('get_entries'),
        invoke<Category[]>('get_categories'),
      ]);
      setEntries(entriesData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await invoke('setup_vault', { password });
      await invoke('unlock_vault', { password });
      setIsInitialized(true);
      setIsUnlocked(true);
      loadData();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await invoke('unlock_vault', { password });
      setIsUnlocked(true);
      loadData();
      // 通知快速面板窗口保险库已解锁
      await emit('vault-unlocked', {});
    } catch (err) {
      setError('Invalid master password');
    }
  };

  const handleLock = async () => {
    try {
      await invoke('lock_vault');
      setIsUnlocked(false);
      setEntries([]);
      setPassword('');
    } catch (err) {
      console.error('Failed to lock vault:', err);
    }
  };

  const generatePassword = async () => {
    try {
      const pwd = await invoke<string>('generate_password', {
        request: {
          length: passwordLength,
          use_uppercase: useUppercase,
          use_lowercase: useLowercase,
          use_numbers: useNumbers,
          use_special: useSpecial,
          exclude_chars: null,
        },
      });
      setGeneratedPassword(pwd);
      setFormData({ ...formData, password: pwd });
    } catch (err) {
      console.error('Failed to generate password:', err);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke('create_entry', {
        request: {
          title: formData.title,
          username: formData.username,
          password: formData.password,
          url: formData.url || null,
          notes: formData.notes || null,
          category: formData.category,
          custom_fields: [],
          password_rule: null,
          favorite: formData.favorite,
        },
      });
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Failed to create entry:', err);
    }
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    try {
      await invoke('update_entry', {
        request: {
          id: selectedEntry.id,
          title: formData.title,
          username: formData.username,
          password: formData.password,
          url: formData.url || null,
          notes: formData.notes || null,
          category: formData.category,
          custom_fields: [],
          password_rule: null,
          favorite: formData.favorite,
        },
      });
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Failed to update entry:', err);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await invoke('delete_entry', { id });
      loadData();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('toggle_favorite', { id });
      loadData();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    resetForm();
    setShowModal(true);
  };

  const openViewModal = (entry: Entry) => {
    setModalMode('view');
    setSelectedEntry(entry);
    setFormData({
      title: entry.title,
      username: entry.username,
      password: entry.password,
      url: entry.url || '',
      notes: entry.notes || '',
      category: entry.category,
      favorite: entry.favorite,
    });
    setShowModal(true);
  };

  const openEditFromView = () => {
    if (!selectedEntry) return;
    setModalMode('edit');
    setFormData({
      title: selectedEntry.title,
      username: selectedEntry.username,
      password: selectedEntry.password,
      url: selectedEntry.url || '',
      notes: selectedEntry.notes || '',
      category: selectedEntry.category,
      favorite: selectedEntry.favorite,
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      username: '',
      password: '',
      url: '',
      notes: '',
      category: 'login',
      favorite: false,
    });
    setSelectedEntry(null);
    setGeneratedPassword('');
  };

const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyPasswordToClipboard = async (id: string) => {
    try {
      await invoke('copy_password_to_clipboard', { id });
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const copyUsernameToClipboard = async (id: string) => {
    try {
      await invoke('copy_username_to_clipboard', { id });
    } catch (err) {
      console.error('Failed to copy username:', err);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesCategory = 
      selectedCategory === 'all' || 
      (selectedCategory === 'favorites' && entry.favorite) ||
      entry.category === selectedCategory;
    const matchesSearch = 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.url && entry.url.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return entries.length;
    return entries.filter((e) => e.category === categoryId).length;
  };

  if (!isInitialized) {
    return (
      <>
        <TitleBar />
        <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="logo-icon">
              <Shield size={20} color="white" />
            </div>
            <span className="logo-text">SecureVault</span>
          </div>
          <h1 className="auth-title">Create Master Password</h1>
          <p className="auth-subtitle">Set up your secure vault</p>
          
          {error && <div className="auth-error">{error}</div>}
          
          <form onSubmit={handleSetup}>
            <div className="form-group">
              <label className="form-label">Master Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Confirm master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Create Vault
            </button>
          </form>
          
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', marginTop: '10px' }}
            onClick={async () => {
              if (confirm('Are you sure you want to reset the vault? All data will be lost.')) {
                try {
                  await invoke('reset_vault');
                  window.location.reload();
                } catch (err) {
                  console.error('Failed to reset vault:', err);
                }
              }
            }}
          >
            Reset Vault
          </button>
        </div>
      </div>
      </>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <TitleBar />
        <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="logo-icon">
              <Shield size={20} color="white" />
            </div>
            <span className="logo-text">SecureVault</span>
          </div>
          <h1 className="auth-title">Unlock Vault</h1>
          <p className="auth-subtitle">Enter your master password</p>
          
          {error && <div className="auth-error">{error}</div>}
          
          <form onSubmit={handleUnlock}>
            <div className="form-group">
              <label className="form-label">Master Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <TitleBar />
      <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Shield size={20} color="white" />
            </div>
            <span className="logo-text">SecureVault</span>
          </div>
        </div>
        
        <div className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Vault</div>
            <div
              className={`nav-item ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              <Key size={18} />
              <span>All Items</span>
              <span className="nav-item-count">{getCategoryCount('all')}</span>
            </div>
            <div
              className={`nav-item ${selectedCategory === 'favorites' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('favorites')}
            >
              <Star size={18} />
              <span>Favorites</span>
              <span className="nav-item-count">{entries.filter(e => e.favorite).length}</span>
            </div>
          </div>
          
          <div className="nav-section">
            <div className="nav-section-title">Categories</div>
            {categories.map((category) => (
              <div
                key={category.id}
                className={`nav-item ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {categoryIcons[category.id] || <Key size={18} />}
                <span>{category.name}</span>
                <span className="nav-item-count">{getCategoryCount(category.id)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="sidebar-footer">
          <button className="lock-btn" onClick={() => setShowSettings(true)}>
            <SettingsIcon size={18} />
            Settings
          </button>
          <button className="lock-btn" onClick={handleLock}>
            <Lock size={18} />
            Lock Vault
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-header">
          <h2 className="content-title">
            {selectedCategory === 'all' ? 'All Items' : 
             selectedCategory === 'favorites' ? 'Favorites' :
             categories.find(c => c.id === selectedCategory)?.name || 'Items'}
          </h2>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div className="search-bar">
              <Search size={18} color="#666" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={18} />
              Add Item
            </button>
          </div>
        </div>
        
        <div className="content-body">
          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Key size={32} />
              </div>
              <h3 className="empty-state-title">No items yet</h3>
              <p className="empty-state-desc">
                Add your first password entry to get started
              </p>
              <button className="btn btn-primary" onClick={openCreateModal}>
                <Plus size={18} />
                Add Item
              </button>
            </div>
          ) : (
            <div className="entries-grid">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="entry-card"
                  onClick={() => openViewModal(entry)}
                >
                  <div className="entry-card-header">
                    <div className="entry-icon">
                      {categoryIcons[entry.category] || <Key size={20} />}
                    </div>
                    <Star
                      size={18}
                      className="entry-favorite"
                      fill={entry.favorite ? '#f59e0b' : 'none'}
                      onClick={(e) => handleToggleFavorite(entry.id, e)}
                    />
                  </div>
                  <h3 className="entry-title">{entry.title}</h3>
                  <p className="entry-username">{entry.username}</p>
<div className="entry-footer">
                    <span className="entry-category">
                      {categories.find(c => c.id === entry.category)?.name || entry.category}
                    </span>
                    <div className="entry-actions">
                      <button 
                        className="action-btn" 
                        onClick={(e) => { e.stopPropagation(); copyUsernameToClipboard(entry.id); }}
                        title="Copy username"
                      >
                        <User size={14} />
                      </button>
                      <button 
                        className="action-btn" 
                        onClick={(e) => { e.stopPropagation(); copyPasswordToClipboard(entry.id); }}
                        title="Copy password"
                      >
                        <Key size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {modalMode === 'create' ? 'Add New Item' : 
                 modalMode === 'edit' ? 'Edit Item' : 'View Item'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={modalMode === 'create' ? handleCreateEntry : handleUpdateEntry}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Google Account"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    disabled={modalMode === 'view'}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Username / Email</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="username@example.com"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={modalMode === 'view'}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Password</label>
                  {modalMode === 'view' ? (
                    <div className="password-field">
                      <span style={{ flex: 1 }}>{formData.password}</span>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyToClipboard(formData.password)}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="password-field">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          style={{ border: 'none', padding: 0 }}
                          placeholder="Enter password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          type="button"
                          className="copy-btn"
                          onClick={() => copyToClipboard(formData.password)}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      
                      <div className="password-generator">
                        <div className="generator-header">
                          <span className="generator-title">Password Generator</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={generatePassword}
                          >
                            Generate
                          </button>
                        </div>
                        
                        {generatedPassword && (
                          <div className="generated-password">
                            <span className="password-display">{generatedPassword}</span>
                            <button
                              type="button"
                              className="copy-btn"
                              onClick={() => copyToClipboard(generatedPassword)}
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        )}
                        
                        <div className="length-slider">
                          <label>Length: {passwordLength}</label>
                          <input
                            type="range"
                            min="8"
                            max="64"
                            value={passwordLength}
                            onChange={(e) => setPasswordLength(Number(e.target.value))}
                          />
                        </div>
                        
                        <div className="generator-options">
                          <label className="generator-option">
                            <input
                              type="checkbox"
                              checked={useUppercase}
                              onChange={(e) => setUseUppercase(e.target.checked)}
                            />
                            A-Z
                          </label>
                          <label className="generator-option">
                            <input
                              type="checkbox"
                              checked={useLowercase}
                              onChange={(e) => setUseLowercase(e.target.checked)}
                            />
                            a-z
                          </label>
                          <label className="generator-option">
                            <input
                              type="checkbox"
                              checked={useNumbers}
                              onChange={(e) => setUseNumbers(e.target.checked)}
                            />
                            0-9
                          </label>
                          <label className="generator-option">
                            <input
                              type="checkbox"
                              checked={useSpecial}
                              onChange={(e) => setUseSpecial(e.target.checked)}
                            />
                            !@#
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Website URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    disabled={modalMode === 'view'}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    disabled={modalMode === 'view'}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    placeholder="Additional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    disabled={modalMode === 'view'}
                  />
                </div>
                
                {modalMode !== 'view' && (
                  <div className="form-group">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.favorite}
                        onChange={(e) => setFormData({ ...formData, favorite: e.target.checked })}
                      />
                      Mark as favorite
                    </label>
                  </div>
                )}
              </form>
            </div>
            
            <div className="modal-footer">
              {modalMode === 'view' ? (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => selectedEntry && handleDeleteEntry(selectedEntry.id)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={openEditFromView}
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={modalMode === 'create' ? handleCreateEntry : handleUpdateEntry}
                  >
                    {modalMode === 'create' ? 'Create' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    <Settings 
      isOpen={showSettings} 
      onClose={() => setShowSettings(false)} 
      onSettingsChange={reloadShortcut}
    />
    </>
  );
}

export default App;
