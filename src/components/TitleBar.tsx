import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Shield } from 'lucide-react';
import { getSettings, AppSettings } from '../settingsStore';

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [closeBehavior, setCloseBehavior] = useState<AppSettings['closeBehavior']>('minimize_to_tray');

  useEffect(() => {
    const checkMaximized = async () => {
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    const unlisten = getCurrentWindow().onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      setCloseBehavior(settings.closeBehavior);
    };
    loadSettings();
  }, []);

  const handleMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    const win = getCurrentWindow();
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    const win = getCurrentWindow();
    
    switch (closeBehavior) {
      case 'minimize_to_tray':
        await win.hide();
        break;
      case 'minimize_to_taskbar':
        await win.minimize();
        break;
      case 'quit':
        await win.close();
        break;
    }
  };

  const handleDragStart = async () => {
    await getCurrentWindow().startDragging();
  };

  return (
    <div className="title-bar" onMouseDown={handleDragStart}>
      <div className="title-bar-left">
        <Shield size={18} className="title-bar-icon" />
        <span className="title-bar-title">SecureVault</span>
      </div>
      <div className="title-bar-right">
        <button 
          className="title-bar-btn" 
          onClick={handleMinimize}
          onMouseDown={(e) => e.stopPropagation()}
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button 
          className="title-bar-btn" 
          onClick={handleMaximize}
          onMouseDown={(e) => e.stopPropagation()}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Square size={12} /> : <Square size={14} />}
        </button>
        <button 
          className="title-bar-btn title-bar-btn-close" 
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
