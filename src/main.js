const { app, BrowserWindow } = require('electron')
const { ipcMain } = require('electron')
const { exec } = require('child_process');
const rimraf = require("rimraf");
const { dialog } = require('electron');
const Store = require('./store.js');
var fs = require('fs');

var directory = '';
let mainWindow;
let configWindow;

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    directory: '',
    version: '0.1'
  }
});

function createWindow() {
  if (process.platform !== 'win32') {
    app.quit()
    return
  }

  directory = store.get('directory');
  mainWindow = new BrowserWindow({
    width: 960,
    height: 503,
    webPreferences: {
      nodeIntegration: true,
      additionalArguments: [directory]
    },
    enableRemoteModule: true,
    resizable: false,
    fullscreenable: false,
    icon: './assets/favicon.ico',
  })
  mainWindow.removeMenu();

  mainWindow.loadFile('src/index.html')
}

function createWindowConfig() {

  configWindow = new BrowserWindow({
    width: 300,
    height: 150,
    webPreferences: {
      nodeIntegration: true,
      additionalArguments: [directory]
    },
    enableRemoteModule: true,
    resizable: false,
    fullscreenable: false,
    icon: './assets/favicon.ico',
    parent: mainWindow,
    modal: true,
  })
  configWindow.removeMenu();

  configWindow.loadFile('src/config.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.on('config_window', (evt, arg) => {
  createWindowConfig()
})

ipcMain.on('close_main', (evt, arg) => {
  mainWindow.close()
})

ipcMain.on('minimize_main', (evt, arg) => {
  mainWindow.minimize()
})

ipcMain.on('close_config', (evt, arg) => {
  configWindow.close()
})

ipcMain.on('play_wow', (evt, arg) => {
  if (directory === '') {
    dialog.showErrorBox("Erro!", "Selecione um diretório antes de iniciar o jogo!");
    return;
  }
  rimraf.sync(directory + "\\cache\\");
  write_realmlist();
  exec(directory + '\\Wow.exe');
  mainWindow.close();
})

function write_realmlist() {
  var filepath = directory + "\\Data\\enUS\\realmlist.wtf";
  var content = "set realmlist etmaxx.zapto.org\nset patchlist 127.0.0.1";

  fs.writeFile(filepath, content, (err) => {
    if (err) {
      dialog.showErrorBox("Erro!", "Ocorreu um erro ao alterar o realmlist.wtf!");
      console.log(err);
      return false;
    }
  });
}

ipcMain.handle('diretorio_wow', (evt, arg) => {
  directory = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  })
  store.set('directory', directory);
  return directory;
})

ipcMain.handle('return_directory', (evt, arg) => {
  return store.get('directory');
})