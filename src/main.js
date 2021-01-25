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
    patch: 0
  }
});

function createWindow() {
  if (process.platform !== 'win32') {
    app.quit()
    return
  }

  directory = store.get('directory');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 628,
    webPreferences: {
      nodeIntegration: true,
      additionalArguments: [directory]
    },
    enableRemoteModule: true,
    resizable: false,
    fullscreenable: false,
    icon: './assets/images/favicon.ico',
    frame: false
  })
  mainWindow.removeMenu();

  mainWindow.loadFile('src/index.html')
}

function createWindowConfig() {

  configWindow = new BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      additionalArguments: [directory]
    },
    enableRemoteModule: true,
    resizable: false,
    fullscreenable: false,
    icon: './assets/images/favicon.ico',
    parent: mainWindow,
    modal: true,
    frame: false
  })
  configWindow.removeMenu();

  configWindow.loadFile('src/config.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('config_window', (evt, arg) => {
  createWindowConfig()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
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
  if (!installValid(directory)){
    return;
  }
  rimraf.sync(directory + "\\cache\\");
  write_realmlist();
  exec(directory + '\\Wow.exe');
})

function installValid(directoryValid){
  if (directoryValid === '') {
    dialog.showErrorBox("Erro!", "Selecione um diretório antes de iniciar o jogo!");
    return false;
  }
  if (!fs.existsSync(directoryValid + '\\')){
    dialog.showErrorBox("Erro!", "Diretório do World of Warcraft não existe!");
    return false;    
  }
  if (!fs.existsSync(directoryValid + '\\Data')){
    dialog.showErrorBox("Erro!", "Diretório Data não existe dentro do diretório do World of Warcraft!");
    return false;    
  }  
  if (!fs.existsSync(directoryValid + '\\Wow.exe')){
    dialog.showErrorBox("Erro!", "Não encontrei executável dentro do diretório do World of Warcraft!");
    return false;    
  } 
  return true;
}

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

ipcMain.handle('Open_folder', (evt, arg) => {
  directory = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  })
  store.set('directory', directory);
  return directory;
})

ipcMain.handle('return_directory', (evt, arg) => {
  return store.get('directory');
})

ipcMain.on('open_url', (event, arg) => {
  exec('start ' + arg);
})

ipcMain.handle('get_version', (evt, arg) => {
  return app.getVersion();
})

ipcMain.handle('patch_applied', (evt, arg) => {
  return store.get('patch');
})