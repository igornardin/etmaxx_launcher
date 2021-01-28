const { app, BrowserWindow } = require('electron')
const { ipcMain } = require('electron')
const { exec } = require('child_process');
const rimraf = require("rimraf");
const { dialog } = require('electron');
const Store = require('./store.js');
var fs = require('fs');
const log = require('electron-log');
const path = require('path');
const { autoUpdater } = require("electron-updater");
const { download } = require('electron-dl');
const zip = require('7zip-min');
const ProgressBar = require('electron-progressbar');

log.transports.file.level = 'info';
log.transports.file.fileName = 'log.log';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

var directory = '';
let mainWindow;
let patchsToApply;
let lastPatchToApply;

/* Arquivos pra baixar e o equivalente destino */
let filesDownload = [];
let filesDestination = [];

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
    resizable: false,
    fullscreenable: false,
    icon: path.join(__dirname, 'assets', 'images', 'favicon.ico'),
    frame: false
  })
  mainWindow.removeMenu();

  mainWindow.loadFile('src/index.html');
}

app.on('ready', function () {
  createWindow();
  autoUpdater.checkForUpdates();
});

autoUpdater.on('update-downloaded', (info) => {
  log.info("Vou atualizar!");
  dialog.showMessageBoxSync({
    title: "Atenção!",
    message: "Existe uma nova versão do launcher. Ele será atualizado agora!"
  });
  autoUpdater.quitAndInstall();
})

app.on('window-all-closed', () => {
  app.quit()
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

ipcMain.on('play_wow', (evt, arg) => {
  if (!installValid(directory)) {
    return;
  }
  let options = {
    title: "Atenção!",
    message: "Existem patchs para aplicar no World of Warcraft! Deseja fazer agora?",
    type: "question",
    buttons: ["Não", "Sim"]
  };
  if (dialog.showMessageBoxSync(options) === 1)
    if (!applyPatch())
      return;
  path.join(directory.toString(), 'cache');
  write_realmlist();
  exec(path.join(directory.toString(), 'Wow.exe'));
})

function write_realmlist() {
  var filepath = path.join(directory.toString(), 'data', 'enus', 'realmlist.wtf')
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

ipcMain.handle('process_patch', (evt, arg) => {
  let hasPatch = false;
  patchsToApply = JSON.parse(arg)["patchs"];
  for (let indexPatch = 0; indexPatch < patchsToApply.length; indexPatch++) {
    if (patchsToApply[indexPatch]["patch_number"] > store.get('patch')) {
      hasPatch = true;
      filesDownload.push(patchsToApply[indexPatch]["file"]);
      filesDestination.push(patchsToApply[indexPatch]["destination"]);
      lastPatchToApply = patchsToApply[indexPatch]["patch_number"];
    }
  }
  return hasPatch;
})

ipcMain.handle('apply_patch', () => {
  return applyPatch();
})

function applyPatch(){
  if (!installValid(directory)) {
    return false;
  }
  rimraf.sync(path.join(directory.toString(), 'downloads', '*'));
  var progressBar = new ProgressBar({
    text: 'Atualizando o cliente...',
    indeterminate: false,
    detail: 'Espere...',
    maxValue: filesDownload.length,
    browserWindow:{
      parent: mainWindow,
      icon: path.join(__dirname, 'assets', 'images', 'favicon.ico'),
    }
  });
  progressBar
  .on('completed', function() {
    progressBar.detail = 'Atualização finalizada. Saindo...';
  })
  .on('aborted', function() {
    console.info(`A atualização foi abortada...`);
  })
  .on('progress', function(value) {
    progressBar.detail = `Atualização ${value} de ${progressBar.getOptions().maxValue}...`;
  });
  let error = false;
  for (let index = 0; index < filesDownload.length; index++) {
    if (!downloadFiles(filesDownload[index], filesDestination[index])){
      error = true;
    }
    progressBar.value+=1;
  }
  if (error){
    dialog.showErrorBox("Erro na aplicação do patch", "Não foi possível aplicar o patch no client do World of Warcraft. Tente novamente mais tarde!");
    return false;
  }else{
    store.set('patch', lastPatchToApply);
    return true;
  }
}

async function downloadFiles(fileDownload, fileDestination) {
  let error = false;
  await download(mainWindow, fileDownload, {
    directory: path.join(directory.toString(), 'downloads'),
    saveAs: false,
    showBadge: false,
  }).then(function (result) {
    zip.unpack(result.getSavePath(), path.join(directory.toString(), fileDestination), err => { 
      console.log(err); 
      if(err) 
        error = true;
    });
  });
  return error;
}

function installValid(directoryValid) {
  if (directoryValid === '') {
    dialog.showErrorBox("Erro!", "Selecione um diretório antes de iniciar o jogo!");
    return false;
  }
  if (!fs.existsSync(path.join(directoryValid.toString()))) {
    dialog.showErrorBox("Erro!", "Diretório do World of Warcraft não existe!");
    return false;
  }
  if (!fs.existsSync(path.join(directoryValid.toString(), 'data'))) {
    dialog.showErrorBox("Erro!", "Diretório Data não existe dentro do diretório do World of Warcraft!");
    return false;
  }
  if (!fs.existsSync(path.join(directoryValid.toString(), 'wow.exe'))) {
    dialog.showErrorBox("Erro!", "Não encontrei executável dentro do diretório do World of Warcraft!");
    return false;
  }
  return true;
}