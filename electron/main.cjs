// input: Electron app lifecycle
// output: desktop ReadPilot window backed by Next standalone server
// pos: Electron main process, starts server and exposes desktop IPC
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { loadConfig, saveConfig, hasConfig, getDefaultDataPath } = require('./config-store.cjs');

const isDev = !app.isPackaged;
let serverProcess = null;
let _mainWindow = null;

function logBoot(message) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.appendFileSync(path.join(app.getPath('userData'), 'main.log'), `${new Date().toISOString()} ${message}\n`, 'utf-8');
  } catch {
    // logging must never block startup
  }
}

const originalConsoleError = console.error;
console.error = (...args) => {
  logBoot(args.map((arg) => arg instanceof Error ? `${arg.stack || arg.message}` : String(arg)).join(' '));
  originalConsoleError(...args);
};

process.on('uncaughtException', (error) => {
  logBoot(`uncaughtException: ${error.stack || error.message}`);
});
process.on('unhandledRejection', (reason) => {
  logBoot(`unhandledRejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});

function standaloneRoot() {
  return isDev ? path.join(process.cwd(), '.next', 'standalone') : path.join(process.resourcesPath, 'standalone');
}

function preloadPath() {
  return path.join(__dirname, 'preload.cjs');
}

function wizardPath() {
  return path.join(__dirname, 'wizard.html');
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findPort() {
  for (let port = 3456; port <= 3500; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error('No free local port in 3456-3500.');
}

function waitForHttp(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('Server startup timeout.'));
        else setTimeout(tick, 350);
      });
      req.setTimeout(1000, () => req.destroy());
    };
    tick();
  });
}

async function startServer(dataPath) {
  logBoot('startServer');
  const root = standaloneRoot();
  const serverPath = path.join(root, 'server.js');
  const runtimeModules = path.join(root, 'runtime_modules');
  if (!fs.existsSync(serverPath)) throw new Error(`Missing ${serverPath}. Run npm run electron:prepare.`);

  const port = await findPort();
  const booksDir = path.join(dataPath, 'books');
  fs.mkdirSync(booksDir, { recursive: true });
  const serverEnv = {
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    NODE_ENV: 'production',
    NODE_PATH: runtimeModules,
    READPILOT_RUNTIME_MODULES_DIR: runtimeModules,
    READPILOT_DESKTOP: '1',
    READPILOT_DATA_DIR: dataPath,
    READPILOT_BOOKS_DIR: booksDir,
  };

  let serverOutput = '';
  const appendServerOutput = (chunk) => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-3000);
  };

  const bundledNodePath = path.join(root, 'node.exe');
  const nodePath = fs.existsSync(bundledNodePath) ? bundledNodePath : process.execPath;
  if (!isDev && !fs.existsSync(bundledNodePath)) throw new Error(`Missing ${bundledNodePath}. Run npm run electron:prepare.`);

  const env = {
    ...process.env,
    ...(nodePath === process.execPath ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    ...serverEnv,
  };

  logBoot(`spawning server ${serverPath}`);
  serverProcess = spawn(nodePath, [serverPath], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });

  serverProcess.stdout?.on('data', (chunk) => {
    appendServerOutput(chunk);
    console.log('[next]', chunk.toString().trim());
  });
  serverProcess.stderr?.on('data', (chunk) => {
    appendServerOutput(chunk);
    console.error('[next]', chunk.toString().trim());
  });
  serverProcess.once('exit', (code) => {
    serverProcess = null;
    if (code) console.error(`[next] exited with ${code}`);
  });

  try {
    await waitForHttp(port);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n\n${serverOutput || 'No server output.'}`);
  }
  return port;
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function createWindow(port) {
  const config = loadConfig();
  const bounds = config.windowBounds || { width: 1400, height: 900 };
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    title: 'ReadPilot',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}`);
  win.once('ready-to-show', () => win.show());
  win.on('close', () => {
    const next = loadConfig();
    next.windowBounds = win.getBounds();
    saveConfig(next);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

function showWizard() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 560,
      height: 440,
      resizable: false,
      title: 'ReadPilot 初始设置',
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.setMenuBarVisibility(false);
    win.loadFile(wizardPath());

    const done = () => {
      ipcMain.off('desktop-config-saved', done);
      const config = loadConfig();
      if (!hasConfig()) saveConfig(config);
      win.close();
      resolve(config.dataPath);
    };
    ipcMain.once('desktop-config-saved', done);
    win.on('closed', () => {
      ipcMain.off('desktop-config-saved', done);
      const config = loadConfig();
      if (!hasConfig()) saveConfig(config);
      resolve(config.dataPath);
    });
  });
}

function registerIpc() {
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('get-data-path', () => loadConfig().dataPath);
  ipcMain.handle('get-default-data-path', () => getDefaultDataPath());
  ipcMain.handle('set-data-path', (_event, dataPath) => {
    const config = loadConfig();
    config.dataPath = dataPath;
    saveConfig(config);
    ipcMain.emit('desktop-config-saved');
    if (serverProcess) {
      dialog.showMessageBox({
        type: 'info',
        title: '需要重启',
        message: '数据路径已保存。重启 ReadPilot 后生效。',
      });
    }
  });
}

app.whenReady().then(async () => {
  logBoot('app ready');
  registerIpc();
  const dataPath = hasConfig() ? loadConfig().dataPath : await showWizard();
  try {
    const port = await startServer(dataPath);
    _mainWindow = createWindow(port);
  } catch (error) {
    dialog.showErrorBox('ReadPilot 启动失败', error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', stopServer);
