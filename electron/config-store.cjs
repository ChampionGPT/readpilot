// input: Electron app userData directory
// output: small JSON config store for desktop-only settings
// pos: Electron config persistence, no extra dependency
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_DATA_PATH = path.join(app.getPath('documents'), 'ReadPilot');

function defaultConfig() {
  return { dataPath: DEFAULT_DATA_PATH };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
    }
  } catch {
    // use defaults for corrupt config
  }
  return defaultConfig();
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

module.exports = {
  loadConfig,
  saveConfig,
  hasConfig: () => fs.existsSync(CONFIG_FILE),
  getDefaultDataPath: () => DEFAULT_DATA_PATH,
};
