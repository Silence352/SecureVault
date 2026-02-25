import { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { getSettings, saveSettings, getFullShortcut, AppSettings } from '../settingsStore';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: () => void;
}

function Settings({ isOpen, onClose, onSettingsChange }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    shortcutModifier: 'ctrl+shift',
    shortcutKey: 'p',
    clipboardClearTime: 30,
    closeBehavior: 'minimize_to_tray',
  });
  const [shortcutKeyInput, setShortcutKeyInput] = useState('p');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const loaded = await getSettings();
    setSettings(loaded);
    setShortcutKeyInput(loaded.shortcutKey);
  };

  const handleModifierChange = async (modifier: AppSettings['shortcutModifier']) => {
    const newSettings = { ...settings, shortcutModifier: modifier };
    setSettings(newSettings);
    await saveSettings(newSettings);
    onSettingsChange();
    showSaved();
  };

  const handleKeyChange = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key.toLowerCase();
    if (key.length !== 1) return;
    
    setShortcutKeyInput(key);
    const newSettings = { ...settings, shortcutKey: key };
    setSettings(newSettings);
    await saveSettings(newSettings);
    onSettingsChange();
    showSaved();
  };

  const handleClearTimeChange = async (time: number) => {
    const newSettings = { ...settings, clipboardClearTime: time };
    setSettings(newSettings);
    await saveSettings(newSettings);
    showSaved();
  };

  const handleCloseBehaviorChange = async (behavior: AppSettings['closeBehavior']) => {
    const newSettings = { ...settings, closeBehavior: behavior };
    setSettings(newSettings);
    await saveSettings(newSettings);
    showSaved();
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!isOpen) return null;

  const fullShortcut = getFullShortcut(settings.shortcutModifier, settings.shortcutKey);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <div className="settings-section-title">
              <Keyboard size={16} />
              Global Shortcut
            </div>
            
            <div className="settings-group">
              <label className="settings-label">Modifier</label>
              <select
                className="form-select"
                value={settings.shortcutModifier}
                onChange={(e) => handleModifierChange(e.target.value as AppSettings['shortcutModifier'])}
              >
                <option value="ctrl">Ctrl</option>
                <option value="shift">Shift</option>
                <option value="ctrl+shift">Ctrl + Shift</option>
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">Key</label>
              <input
                type="text"
                className="form-input settings-key-input"
                value={shortcutKeyInput}
                onKeyDown={handleKeyChange}
                placeholder="Press a key"
                maxLength={1}
              />
              <p className="settings-hint">Press any single key (a-z, 0-9)</p>
            </div>

            <div className="settings-preview">
              <span className="preview-label">Current shortcut:</span>
              <kbd className="preview-shortcut">{fullShortcut}</kbd>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              Clipboard Settings
            </div>

            <div className="settings-group">
              <label className="settings-label">Clear clipboard after</label>
              <select
                className="form-select"
                value={settings.clipboardClearTime}
                onChange={(e) => handleClearTimeChange(Number(e.target.value))}
              >
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={0}>Immediately</option>
                <option value={-1}>Never</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              Window Behavior
            </div>

            <div className="settings-group">
              <label className="settings-label">When closing the window</label>
              <select
                className="form-select"
                value={settings.closeBehavior}
                onChange={(e) => handleCloseBehaviorChange(e.target.value as AppSettings['closeBehavior'])}
              >
                <option value="minimize_to_tray">Minimize to system tray</option>
                <option value="minimize_to_taskbar">Minimize to taskbar</option>
                <option value="quit">Quit application</option>
              </select>
            </div>
          </div>

          {saved && (
            <div className="settings-saved-toast">Settings saved</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
