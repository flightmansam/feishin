/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import electronLocalShortcut from 'electron-localshortcut';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import uniq from 'lodash/uniq';
import MpvAPI from 'node-mpv';
import { disableMediaKeys, enableMediaKeys } from './features/core/player/media-keys';
import { store } from './features/core/settings/index';
import MenuBuilder from './menu';
import { hotkeyToElectronAccelerator, isLinux, isMacOS, isWindows, resolveHtmlPath } from './utils';
import './features';

declare module 'node-mpv';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

process.on('uncaughtException', (error: any) => {
  console.log('Error in main process', error);
});

if (store.get('ignore_ssl')) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let exitFromTray = false;
let forceQuit = false;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
}

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

export const getMainWindow = () => {
  return mainWindow;
};

const createWinThumbarButtons = () => {
  if (isWindows()) {
    getMainWindow()?.setThumbarButtons([
      {
        click: () => getMainWindow()?.webContents.send('renderer-player-previous'),
        icon: nativeImage.createFromPath(getAssetPath('skip-previous.png')),
        tooltip: 'Previous Track',
      },
      {
        click: () => getMainWindow()?.webContents.send('renderer-player-play-pause'),
        icon: nativeImage.createFromPath(getAssetPath('play-circle.png')),
        tooltip: 'Play/Pause',
      },
      {
        click: () => getMainWindow()?.webContents.send('renderer-player-next'),
        icon: nativeImage.createFromPath(getAssetPath('skip-next.png')),
        tooltip: 'Next Track',
      },
    ]);
  }
};

const createTray = () => {
  if (isMacOS()) {
    return;
  }

  tray = isLinux() ? new Tray(getAssetPath('icon.png')) : new Tray(getAssetPath('icon.ico'));
  const contextMenu = Menu.buildFromTemplate([
    {
      click: () => {
        getMainWindow()?.webContents.send('renderer-player-play-pause');
      },
      label: 'Play/Pause',
    },
    {
      click: () => {
        getMainWindow()?.webContents.send('renderer-player-next');
      },
      label: 'Next Track',
    },
    {
      click: () => {
        getMainWindow()?.webContents.send('renderer-player-previous');
      },
      label: 'Previous Track',
    },
    {
      click: () => {
        getMainWindow()?.webContents.send('renderer-player-stop');
      },
      label: 'Stop',
    },
    {
      type: 'separator',
    },
    {
      click: () => {
        mainWindow?.show();
        createWinThumbarButtons();
      },
      label: 'Open main window',
    },
    {
      click: () => {
        exitFromTray = true;
        app.quit();
      },
      label: 'Quit',
    },
  ]);

  tray.on('double-click', () => {
    mainWindow?.show();
    createWinThumbarButtons();
  });

  tray.setToolTip('Feishin');
  tray.setContextMenu(contextMenu);
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    frame: false,
    height: 900,
    icon: getAssetPath('icon.png'),
    minHeight: 600,
    minWidth: 640,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      devTools: true,
      nodeIntegration: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      webSecurity: store.get('ignore_cors') ? false : undefined,
    },
    width: 1440,
  });

  electronLocalShortcut.register(mainWindow, 'Ctrl+Shift+I', () => {
    mainWindow?.webContents.openDevTools();
  });

  ipcMain.on('window-dev-tools', () => {
    mainWindow?.webContents.openDevTools();
  });

  ipcMain.on('window-maximize', () => {
    mainWindow?.maximize();
  });

  ipcMain.on('window-unmaximize', () => {
    mainWindow?.unmaximize();
  });

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.on('app-restart', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.on('global-media-keys-enable', () => {
    enableMediaKeys(mainWindow);
  });

  ipcMain.on('global-media-keys-disable', () => {
    disableMediaKeys();
  });

  const globalMediaKeysEnabled = store.get('global_media_hotkeys') as boolean;

  if (globalMediaKeysEnabled) {
    enableMediaKeys(mainWindow);
  }

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      createWinThumbarButtons();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!exitFromTray && store.get('window_exit_to_tray')) {
      if (isMacOS() && !forceQuit) {
        exitFromTray = true;
      }
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('minimize', (event: any) => {
    if (store.get('window_minimize_to_tray') === true) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (isWindows()) {
    app.setAppUserModelId(process.execPath);
  }

  if (isMacOS()) {
    app.on('before-quit', () => {
      forceQuit = true;
    });
  }

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  if (store.get('disable_auto_updates') !== true) {
    // eslint-disable-next-line
    new AppUpdater();
  }
};

app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');

const MPV_BINARY_PATH = store.get('mpv_path') as string | undefined;

const prefetchPlaylistParams = [
  '--prefetch-playlist=no',
  '--prefetch-playlist=yes',
  '--prefetch-playlist',
];

const DEFAULT_MPV_PARAMETERS = (extraParameters?: string[]) => {
  const parameters = [];

  if (!extraParameters?.some((param) => prefetchPlaylistParams.includes(param))) {
    parameters.push('--prefetch-playlist=yes');
  }

  return parameters;
};

let mpvInstance: MpvAPI | null = null;

const createMpv = (data: { extraParameters?: string[]; properties?: Record<string, any> }) => {
  const { extraParameters, properties } = data;

  const params = uniq([...DEFAULT_MPV_PARAMETERS(extraParameters), ...(extraParameters || [])]);

  mpvInstance = new MpvAPI(
    {
      audio_only: true,
      auto_restart: true,
      binary: MPV_BINARY_PATH || '',
      time_update: 1,
    },
    params,
  );

  mpvInstance.setMultipleProperties(properties || {});

  mpvInstance.start().catch((error) => {
    console.log('error starting mpv', error);
  });

  mpvInstance.on('status', (status) => {
    if (status.property === 'playlist-pos') {
      if (status.value !== 0) {
        getMainWindow()?.webContents.send('renderer-player-auto-next');
      }
    }
  });

  // Automatically updates the play button when the player is playing
  mpvInstance.on('resumed', () => {
    getMainWindow()?.webContents.send('renderer-player-play');
  });

  // Automatically updates the play button when the player is stopped
  mpvInstance.on('stopped', () => {
    getMainWindow()?.webContents.send('renderer-player-stop');
  });

  // Automatically updates the play button when the player is paused
  mpvInstance.on('paused', () => {
    getMainWindow()?.webContents.send('renderer-player-pause');
  });

  // Event output every interval set by time_update, used to update the current time
  mpvInstance.on('timeposition', (time: number) => {
    getMainWindow()?.webContents.send('renderer-player-current-time', time);
  });
};

export const getMpvInstance = () => {
  return mpvInstance;
};

ipcMain.on('player-set-properties', async (_event, data: Record<string, any>) => {
  if (data.length === 0) {
    return;
  }

  if (data.length === 1) {
    getMpvInstance()?.setProperty(Object.keys(data)[0], Object.values(data)[0]);
  } else {
    getMpvInstance()?.setMultipleProperties(data);
  }
});

ipcMain.on(
  'player-restart',
  async (_event, data: { extraParameters?: string[]; properties?: Record<string, any> }) => {
    mpvInstance?.quit();
    createMpv(data);
  },
);

ipcMain.on(
  'player-initialize',
  async (_event, data: { extraParameters?: string[]; properties?: Record<string, any> }) => {
    createMpv(data);
  },
);

// Must duplicate with the one in renderer process settings.store.ts
enum BindingActions {
  GLOBAL_SEARCH = 'globalSearch',
  LOCAL_SEARCH = 'localSearch',
  MUTE = 'volumeMute',
  NEXT = 'next',
  PAUSE = 'pause',
  PLAY = 'play',
  PLAY_PAUSE = 'playPause',
  PREVIOUS = 'previous',
  SHUFFLE = 'toggleShuffle',
  SKIP_BACKWARD = 'skipBackward',
  SKIP_FORWARD = 'skipForward',
  STOP = 'stop',
  TOGGLE_FULLSCREEN_PLAYER = 'toggleFullscreenPlayer',
  TOGGLE_QUEUE = 'toggleQueue',
  TOGGLE_REPEAT = 'toggleRepeat',
  VOLUME_DOWN = 'volumeDown',
  VOLUME_UP = 'volumeUp',
}

const HOTKEY_ACTIONS: Record<BindingActions, () => void> = {
  [BindingActions.MUTE]: () => getMainWindow()?.webContents.send('renderer-player-volume-mute'),
  [BindingActions.NEXT]: () => getMainWindow()?.webContents.send('renderer-player-next'),
  [BindingActions.PAUSE]: () => getMainWindow()?.webContents.send('renderer-player-pause'),
  [BindingActions.PLAY]: () => getMainWindow()?.webContents.send('renderer-player-play'),
  [BindingActions.PLAY_PAUSE]: () =>
    getMainWindow()?.webContents.send('renderer-player-play-pause'),
  [BindingActions.PREVIOUS]: () => getMainWindow()?.webContents.send('renderer-player-previous'),
  [BindingActions.SHUFFLE]: () =>
    getMainWindow()?.webContents.send('renderer-player-toggle-shuffle'),
  [BindingActions.SKIP_BACKWARD]: () =>
    getMainWindow()?.webContents.send('renderer-player-skip-backward'),
  [BindingActions.SKIP_FORWARD]: () =>
    getMainWindow()?.webContents.send('renderer-player-skip-forward'),
  [BindingActions.STOP]: () => getMainWindow()?.webContents.send('renderer-player-stop'),
  [BindingActions.TOGGLE_REPEAT]: () =>
    getMainWindow()?.webContents.send('renderer-player-toggle-repeat'),
  [BindingActions.VOLUME_UP]: () => getMainWindow()?.webContents.send('renderer-player-volume-up'),
  [BindingActions.VOLUME_DOWN]: () =>
    getMainWindow()?.webContents.send('renderer-player-volume-down'),
  [BindingActions.GLOBAL_SEARCH]: () => {},
  [BindingActions.LOCAL_SEARCH]: () => {},
  [BindingActions.TOGGLE_QUEUE]: () => {},
  [BindingActions.TOGGLE_FULLSCREEN_PLAYER]: () => {},
};

ipcMain.on(
  'set-global-shortcuts',
  (
    _event,
    data: Record<BindingActions, { allowGlobal: boolean; hotkey: string; isGlobal: boolean }>,
  ) => {
    // Since we're not tracking the previous shortcuts, we need to unregister all of them
    globalShortcut.unregisterAll();

    for (const shortcut of Object.keys(data)) {
      const isGlobalHotkey = data[shortcut as BindingActions].isGlobal;
      const isValidHotkey =
        data[shortcut as BindingActions].hotkey && data[shortcut as BindingActions].hotkey !== '';

      if (isGlobalHotkey && isValidHotkey) {
        const accelerator = hotkeyToElectronAccelerator(data[shortcut as BindingActions].hotkey);

        globalShortcut.register(accelerator, () => {
          HOTKEY_ACTIONS[shortcut as BindingActions]();
        });
      }
    }

    const globalMediaKeysEnabled = store.get('global_media_hotkeys') as boolean;

    if (globalMediaKeysEnabled) {
      enableMediaKeys(mainWindow);
    }
  },
);

app.on('before-quit', () => {
  getMpvInstance()?.stop();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  getMpvInstance()?.quit();
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (isMacOS()) {
    mainWindow = null;
  } else {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    createTray();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
