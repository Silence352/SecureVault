import { LazyStore } from '@tauri-apps/plugin-store';

export interface AppSettings {
  shortcutModifier: 'ctrl' | 'shift' | 'ctrl+shift';
  shortcutKey: string;
  clipboardClearTime: number;
  closeBehavior: 'minimize_to_tray' | 'minimize_to_taskbar' | 'quit';
}

const DEFAULT_SETTINGS: AppSettings = {
  shortcutModifier: 'ctrl+shift',
  shortcutKey: 'p',
  clipboardClearTime: 30,
  closeBehavior: 'minimize_to_tray',
};

const store = new LazyStore('settings.json');

export async function getSettings(): Promise<AppSettings> {
  try {
    const modifier = await store.get<string>('shortcutModifier');
    const key = await store.get<string>('shortcutKey');
    const clearTime = await store.get<number>('clipboardClearTime');
    const closeBehavior = await store.get<string>('closeBehavior');

    return {
      shortcutModifier: (modifier as AppSettings['shortcutModifier']) || DEFAULT_SETTINGS.shortcutModifier,
      shortcutKey: key || DEFAULT_SETTINGS.shortcutKey,
      clipboardClearTime: clearTime ?? DEFAULT_SETTINGS.clipboardClearTime,
      closeBehavior: (closeBehavior as AppSettings['closeBehavior']) || DEFAULT_SETTINGS.closeBehavior,
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    if (settings.shortcutModifier !== undefined) {
      await store.set('shortcutModifier', settings.shortcutModifier);
    }
    if (settings.shortcutKey !== undefined) {
      await store.set('shortcutKey', settings.shortcutKey);
    }
    if (settings.clipboardClearTime !== undefined) {
      await store.set('clipboardClearTime', settings.clipboardClearTime);
    }
    if (settings.closeBehavior !== undefined) {
      await store.set('closeBehavior', settings.closeBehavior);
    }
    await store.save();
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

export function getFullShortcut(modifier: string, key: string): string {
  const modifierMap: Record<string, string> = {
    'ctrl': 'CommandOrControl',
    'shift': 'Shift',
    'ctrl+shift': 'CommandOrControl+Shift',
  };
  const mod = modifierMap[modifier] || 'CommandOrControl';
  return `${mod}+${key.toUpperCase()}`;
}
