import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Lock, Search, Key, User, Star, X, Check } from 'lucide-react';

interface QuickEntry {
  id: string;
  title: string;
  username: string;
  category: string;
  favorite: boolean;
}

const categoryIcons: Record<string, string> = {
  'Login': '🔐',
  'Credit Card': '💳',
  'Identity': '🪪',
  'Bank': '🏦',
  'Note': '📝',
  'Password': '🔑',
};

function QuickPanel() {
  console.log('[QuickPanel] Component mounting...');
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedType, setCopiedType] = useState<'password' | 'username' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const checkUnlocked = useCallback(async () => {
    console.log('[QuickPanel] Checking vault status...');
    try {
      const unlocked = await invoke<boolean>('is_vault_unlocked');
      console.log('[QuickPanel] Vault unlocked:', unlocked);
      setIsUnlocked(unlocked);
      if (unlocked) {
        const data = await invoke<QuickEntry[]>('get_quick_entries');
        console.log('[QuickPanel] Entries loaded:', data.length);
        setEntries(data);
      }
    } catch (err) {
      console.error('[QuickPanel] Failed to check vault status:', err);
    }
  }, []);

  useEffect(() => {
    console.log('[QuickPanel] useEffect triggered');
    checkUnlocked();
    searchInputRef.current?.focus();
  }, [checkUnlocked]);

  // 监听窗口焦点事件 - 每次窗口获得焦点时刷新解锁状态
  useEffect(() => {
    console.log('[QuickPanel] Setting up focus listener...');
    let isMounted = true;
    
    const setupFocusListener = async () => {
      try {
        const win = getCurrentWindow();
        const unlisten = await win.onFocusChanged(({ payload: focused }) => {
          console.log('[QuickPanel] Focus changed:', focused);
          if (focused && isMounted) {
            console.log('[QuickPanel] Window focused, rechecking unlock status...');
            checkUnlocked();
          }
        });
        return unlisten;
      } catch (err) {
        console.error('[QuickPanel] Failed to setup focus listener:', err);
        return () => {};
      }
    };
    
    const unlistenPromise = setupFocusListener();
    
    return () => {
      isMounted = false;
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [checkUnlocked]);

  // 监听 vault-unlocked 事件 - 主窗口解锁时刷新状态
  useEffect(() => {
    console.log('[QuickPanel] Setting up vault-unlocked listener...');
    let isMounted = true;
    
    const setupUnlockListener = async () => {
      try {
        const unlisten = await listen('vault-unlocked', () => {
          console.log('[QuickPanel] Received vault-unlocked event');
          if (isMounted) {
            checkUnlocked();
          }
        });
        return unlisten;
      } catch (err) {
        console.error('[QuickPanel] Failed to setup unlock listener:', err);
        return () => {};
      }
    };
    
    const unlistenPromise = setupUnlockListener();
    
    return () => {
      isMounted = false;
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [checkUnlocked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUnlock = async () => {
    setLoading(true);
    setError('');
    try {
      await invoke('unlock_vault', { password });
      setIsUnlocked(true);
      const data = await invoke<QuickEntry[]>('get_quick_entries');
      setEntries(data);
      setPassword('');
    } catch (err) {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async (id: string) => {
    try {
      await invoke('copy_password_to_clipboard', { id });
      setCopiedType('password');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleCopyUsername = async (id: string) => {
    try {
      await invoke('copy_username_to_clipboard', { id });
      setCopiedType('username');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy username:', err);
    }
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  const filteredEntries = entries.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isUnlocked) {
      if (e.key === 'Enter') {
        handleUnlock();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredEntries.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredEntries[selectedIndex]) {
          handleCopyPassword(filteredEntries[selectedIndex].id);
        }
        break;
    }
  };

  useEffect(() => {
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement;
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  if (!isUnlocked) {
    return (
      <div className="quick-panel">
        <div className="quick-header">
          <Lock size={18} />
          <span>Unlock Vault</span>
          <button className="close-btn" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>
        <div className="quick-content unlock-content">
          <div className="unlock-icon">
            <Lock size={48} />
          </div>
          <p>Enter master password to access</p>
          <input
            ref={searchInputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
            className="unlock-input"
          />
          {error && <p className="error-text">{error}</p>}
          <button 
            className="unlock-btn" 
            onClick={handleUnlock}
            disabled={loading || !password}
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </div>
        <div className="quick-footer">
          <span>Enter to unlock</span>
        </div>
      </div>
    );
  }

  return (
    <div className="quick-panel" onKeyDown={handleKeyDown}>
      <div className="quick-header">
        <Search size={16} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search entries..."
          className="search-input"
          autoFocus
        />
        <button className="close-btn" onClick={handleClose}>
          <X size={16} />
        </button>
      </div>

      <div className="quick-content">
        {copied && (
          <div className="copied-toast">
            <Check size={14} /> {copiedType === 'username' ? 'Username' : 'Password'} copied {copiedType === 'password' ? '(clears in 30s)' : ''}
          </div>
        )}
        
        <div className="entries-list" ref={listRef}>
          {filteredEntries.length === 0 ? (
            <div className="no-results">No entries found</div>
          ) : (
            filteredEntries.map((entry, index) => (
              <div
                key={entry.id}
                className={`entry-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleCopyPassword(entry.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="entry-icon">
                  {categoryIcons[entry.category] || '📁'}
                </div>
                <div className="entry-info">
                  <div className="entry-title">
                    {entry.favorite && <Star size={12} className="favorite-star" />}
                    {entry.title}
                  </div>
                  <div className="entry-username">{entry.username}</div>
                </div>
                <div className="entry-actions">
                  <button 
                    className="action-btn" 
                    onClick={(e) => { e.stopPropagation(); handleCopyUsername(entry.id); }}
                    title="Copy username"
                  >
                    <User size={14} />
                  </button>
                  <button 
                    className="action-btn" 
                    onClick={(e) => { e.stopPropagation(); handleCopyPassword(entry.id); }}
                    title="Copy password"
                  >
                    <Key size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="quick-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Copy password</span>
      </div>
    </div>
  );
}

export default QuickPanel;
