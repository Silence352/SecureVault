import { useEffect, useCallback, useRef } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { invoke } from '@tauri-apps/api/core';
import { getSettings, getFullShortcut } from '../settingsStore';

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+P';

const QUICKPANEL_WIDTH = 400;
const QUICKPANEL_HEIGHT = 500;

export function useGlobalShortcut() {
  const currentShortcutRef = useRef<string>(DEFAULT_SHORTCUT);
  
  const showQuickPanel = useCallback(async () => {
    try {
      console.log('[QuickPanel] Getting cursor position...');
      
      // 获取鼠标位置
      let cursorPos: [number, number] = [100, 100];
      try {
        cursorPos = await invoke<[number, number]>('get_cursor_position');
        console.log('[QuickPanel] Cursor position:', cursorPos);
      } catch (e) {
        console.warn('[QuickPanel] Failed to get cursor position, using default');
      }
      
      // 计算窗口位置（居中于鼠标）
      const [x, y] = cursorPos;
      const winX = Math.max(0, x - QUICKPANEL_WIDTH / 2);
      const winY = Math.max(0, y - QUICKPANEL_HEIGHT / 2);
      
      console.log('[QuickPanel] Checking for existing window...');
      
      // 检查窗口是否已存在
      const existing = await WebviewWindow.getByLabel('quickpanel');
      if (existing) {
        console.log('[QuickPanel] Window found, setting position and showing...');
        await existing.setPosition(new LogicalPosition(winX, winY));
        await existing.show();
        await existing.setFocus();
        console.log('[QuickPanel] Window shown and focused');
      } else {
        console.log('[QuickPanel] Window not found, creating new window...');
        // 窗口不存在，tauri.conf.json 中已配置，会自动创建
        // 我们只需要显示它
        const win = await WebviewWindow.getByLabel('quickpanel');
        if (win) {
          await win.setPosition(new LogicalPosition(winX, winY));
          await win.show();
          await win.setFocus();
        }
      }
    } catch (err) {
      console.error('Failed to show quick panel:', err);
    }
  }, []);

  const registerShortcut = useCallback(async (shortcutToRegister: string) => {
    try {
      const registered = await isRegistered(shortcutToRegister);
      if (registered) {
        await unregister(shortcutToRegister);
      }
      await register(shortcutToRegister, async (event) => {
        if (event.state === 'Pressed') {
          await showQuickPanel();
        }
      });
      currentShortcutRef.current = shortcutToRegister;
    } catch (err) {
      console.error('Failed to register shortcut:', err);
    }
  }, [showQuickPanel]);

  const unregisterShortcut = useCallback(async (shortcutToUnregister: string) => {
    try {
      const registered = await isRegistered(shortcutToUnregister);
      if (registered) {
        await unregister(shortcutToUnregister);
      }
    } catch (err) {
      console.error('Failed to unregister shortcut:', err);
    }
  }, []);

  const loadAndRegisterShortcut = useCallback(async () => {
    try {
      const settings = await getSettings();
      const fullShortcut = getFullShortcut(settings.shortcutModifier, settings.shortcutKey);
      await registerShortcut(fullShortcut);
    } catch (err) {
      console.error('Failed to load and register shortcut:', err);
      await registerShortcut(DEFAULT_SHORTCUT);
    }
  }, [registerShortcut]);

  useEffect(() => {
    loadAndRegisterShortcut();
    
    return () => {
      unregisterShortcut(currentShortcutRef.current);
    };
  }, []);

  return {
    registerShortcut,
    unregisterShortcut,
    showQuickPanel,
    reloadShortcut: loadAndRegisterShortcut,
  };
}
