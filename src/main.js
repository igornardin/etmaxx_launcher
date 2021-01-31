const { app, BrowserWindow } = require('electron')
const { ipcMain } = require('electron')
const { exec } = require('child_process');
const rimraf = require("rimraf");
const { dialog } = require('electron');
const Store = require('./store.js');
var fs = require('fs');
const log = require('electron-log');
const path = require('path');
const DecompressZip = require('decompress-zip');
const { autoUpdater } = require("electron-updater");
const { download } = require('electron-dl');
const ProgressBar = require('electron-progressbar');

log.transports.file.level = 'info';
log.transports.file.fileName = 'log.log';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

var directory = '';
let mainWindow;
let patchsToApply;
let patchbefore;
let lastPatchToApply;

/* Arquivos pra baixar e o equivalente destino */
let filesDownload = [];
let filesDestination = [];

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    directory: '',
    patch: 0,
    closeLauncher: false
  }
});
store.write();

function createWindow() {
  if (process.platform !== 'win32') {
    app.quit()
    return
  }
  directory = store.get('directory');
  patchbefore = store.get('patch');
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
  if(!shouldApplyPatch()){
    return;
  }
  rimraf.sync(path.join(directory.toString(), 'cache'));
  write_realmlist();
  exec('"' + path.join(directory.toString(), 'Wow.exe') + '"');
  if(store.get('closeLauncher')){
    setTimeout(function(){mainWindow.close()}, 5000);
  }
})

function shouldApplyPatch(){
  if(store.get('patch') === lastPatchToApply || !lastPatchToApply){
    return true;
  }
  let options = {
    title: "Atenção!",
    message: "Existem patchs para aplicar no World of Warcraft! Deseja fazer agora?",
    type: "question",
    buttons: ["Não", "Sim"]
  };
  if (dialog.showMessageBoxSync(options) != 1){
    return true;
  }
  return applyPatch();  
}

function write_realmlist() {
  var filepath = path.join(directory.toString(), 'data', 'enus', 'realmlist.wtf');
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
  store.set('directory', directory.toString());
  return directory;
})

ipcMain.handle('get_directory', (evt, arg) => {
  return store.get('directory');
})

ipcMain.handle('get_closeLauncher', (evt, arg) => {
  return store.get('closeLauncher');
})

ipcMain.on('set_closeLauncher', (evt, value) => {
  store.set('closeLauncher', value);
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

function applyPatch() {
  if (!installValid(directory)) {
    return false;
  }
  rimraf.sync(path.join(directory.toString(), 'downloads', '*'));
  var progressBar = new ProgressBar({
    text: 'Atualizando o cliente...',
    indeterminate: false,
    detail: 'Espere...',
    maxValue: filesDownload.length * 2,
    browserWindow: {
      parent: mainWindow,
      icon: path.join(__dirname, 'assets', 'images', 'favicon.ico'),
    }
  });
  progressBar
    .on('completed', function () {
      progressBar.detail = 'Atualização finalizada. Saindo...';
    })
    .on('aborted', function () {
      console.info(`A atualização foi abortada...`);
    })
    .on('progress', function (value) {
      progressBar.detail = `Atualização ${value} de ${progressBar.getOptions().maxValue}...`;
  });
  downloadFiles(progressBar);
  store.set('patch', lastPatchToApply);
  return true;
}

async function downloadFiles(progressBar){
  for (let index = 0; index < filesDownload.length; index++) {
    log.info(await downloadFile(filesDownload[index]).then((result) => {
      progressBar.value += 1;
      unzipFile(result, filesDestination[index], progressBar);
    }));
  }
}

async function unzipFile(result, destination, progressBar){
  var unzipper = new DecompressZip(result.getSavePath());
  unzipper.on('error', function (err) {
      log.info(err);
      log.info(result.getSavePath());
      log.info(path.join(directory.toString(), destination));
      dialog.showErrorBox("Erro na aplicação do patch", "Não foi possível aplicar o patch no client do World of Warcraft. Tente novamente mais tarde!");
      store.set('patch', patchbefore);
      progressBar.close();
  });
  unzipper.on('extract', function (log) {
    console.log('Finished extracting');
    progressBar.value += 1;
  });
  unzipper.extract({
    path: path.join(directory.toString(), destination),
    filter: function (file) {
        return file.type !== "SymbolicLink";
    }
  });
}

async function downloadFile(fileDownload) {
  return await download(mainWindow, fileDownload, {
    directory: path.join(directory.toString(), 'downloads'),
    saveAs: false,
    showBadge: false,
  });
}

function installValid(directoryValid) {
  if (directoryValid === '') {
    dialog.showErrorBox("Erro!", "Selecione um diretório antes de iniciar o jogo!");
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