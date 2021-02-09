const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const log = require('electron-log');
const { autoUpdater } = require("electron-updater");
const { download } = require('electron-dl');
const ProgressBar = require('electron-progressbar');
const { spawn } = require('child_process');
const rimraf = require("rimraf");
const Store = require('./store.js');
var fs = require('fs');
var glob = require("glob")
const path = require('path');
const DecompressZip = require('decompress-zip');
const open = require('open');

/* Configurações de log */
log.transports.file.level = 'info';
log.transports.file.fileName = 'log.log';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

let autoUpdateProgressBar;

var directory = '';
let mainWindow;
/* Configurações de patch  */
let patchsToApply;
let patchbefore;
let lastPatchToApply;

/* Arquivos pra baixar e o equivalente destino */
let filesDownload = [];
let filesDestination = [];

/**
 * Configurações salvas do launcher
 */
const store = new Store({
  configName: 'user-preferences',
  defaults: {
    directory: '',
    patch: 0,
    closeLauncher: false
  }
});
store.write();

/**
 * Janela principal
 */
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
  // mainWindow.webContents.openDevTools();
  mainWindow.loadFile('src/index.html');
}

/**
 * Quando o app estiver pronto
 */
app.on('ready', function () {
  createWindow();
  autoUpdater.checkForUpdates();
});

/**
 * Quando terminar de baixar o launcher
 */
autoUpdater.on('update-downloaded', (info) => {
  log.info("Vou atualizar!");
  dialog.showMessageBoxSync({
    title: "Atenção!",
    message: "Existe uma nova versão do launcher. Ele será atualizado agora!"
  });
  autoUpdater.quitAndInstall();
})

/**
 * Se tem atualização nova, tranca o botão de play
 */
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
  autoUpdateProgressBar = new ProgressBar({
    text: 'Atualizando o launcher...',
    indeterminate: false,
    detail: 'Espere...',
    maxValue: 100,
    browserWindow: {
      parent: mainWindow,
      icon: path.join(__dirname, 'assets', 'images', 'favicon.ico'),
    }
  });
});

/**
 * Mostra atualização do download
 */
autoUpdater.on('download-progress', (progress) => {
  autoUpdateProgressBar.value = progress.percent;
});

/**
 * Configurações de tela
 */
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

/**
 * Botão de play
 */
ipcMain.on('play_wow', (evt, arg) => {
  if (!installValid(directory)) {
    return;
  }
  if(!shouldApplyPatch()){
    return;
  }
  rimraf.sync(path.join(directory.toString(), 'cache'));
  write_realmlist();
  let subprocess = spawn(path.join(directory.toString(), 'Wow.exe'), {
    detached: true,
    stdio: 'ignore',
    cwd: directory.toString()
  });
  subprocess.unref();
  if(store.get('closeLauncher')){
    app.quit();
  }
})

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

/**
 * Controle de patch
 */
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

ipcMain.handle('apply_patch', () => {
  return applyPatch();
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
      store.set('patch', lastPatchToApply);
    })
    .on('aborted', function () {
      console.info(`A atualização foi abortada...`);
    })
    .on('progress', function (value) {
      progressBar.detail = `Atualização ${value} de ${progressBar.getOptions().maxValue}...`;
  });
  downloadFiles(progressBar);
  return true;
}

/**
 * Controle de arquivos do patch
 * @param {ProgressBar} progressBar 
 */
async function downloadFiles(progressBar){
  for (let index = 0; index < filesDownload.length; index++) {
    log.info(await downloadFile(filesDownload[index]).then((result) => {
      progressBar.value += 1;
      unzipFile(result, path.join(directory.toString(), filesDestination[index]), progressBar);
    }));
  }
}

/**
 * Controles de diretório
 */
ipcMain.handle('Open_folder', (evt, arg) => {
  directory = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  })
  if(!directory){
    store.set('directory', '');
    return '';
  }
  store.set('directory', directory.toString());
  return directory;
})

/**
 * Controle de configurações
 */
ipcMain.handle('get_directory', (evt, arg) => {
  return store.get('directory');
})

ipcMain.handle('get_closeLauncher', (evt, arg) => {
  return store.get('closeLauncher');
})

ipcMain.on('set_closeLauncher', (evt, value) => {
  store.set('closeLauncher', value);
})

ipcMain.handle('get_version', (evt, arg) => {
  return app.getVersion();
})

ipcMain.handle('patch_applied', (evt, arg) => {
  return store.get('patch');
})

/**
 * Abre URL no browser
 */
ipcMain.on('open_url', (event, arg) => {
  open(arg);
})

/**
 * Controle de addon
 */
ipcMain.handle('verify_addon', (evt, addon) => {
  if (!installValid(directory, false)) {
    return false;
  }
  let foldername = addon + '*';
  let files = glob.sync(path.join(directory.toString(), 'interface', 'addons', foldername));
  return files.length == 0 ? false : true;
});

ipcMain.on('download_addon', (evt, url) => {
  if (!installValid(directory)) {
    return false;
  }
  var progressBar = new ProgressBar({
    text: 'Baixando o addon...',
    indeterminate: false,
    detail: 'Espere...',
    maxValue: 2,
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
  downloadFile(url).then((result) => {
    progressBar.value += 1;
    unzipFile(result, path.join(directory.toString(), 'interface', 'addons'), progressBar);
  });
});

ipcMain.on('remove_addon', (evt, addon) => {
  if (!installValid(directory)) {
    return false;
  }
  let foldername = addon + '*';
  rimraf.sync(path.join(directory.toString(), 'interface', 'addons', foldername));
});


/**
 * Descompacta o arquivo
 * @param {Electron.DownloadItem} result 
 * @param {String} destination 
 * @param {ProgressBar} progressBar 
 */
async function unzipFile(result, destination, progressBar){
  var unzipper = new DecompressZip(result.getSavePath());
  unzipper.on('error', function (err) {
      log.info(err);
      log.info(result.getSavePath());
      log.info(destination);
      dialog.showErrorBox("Erro na aplicação do patch/addon", "Não foi possível aplicar o download no client do World of Warcraft. Tente novamente mais tarde!");
      store.set('patch', patchbefore);
      progressBar.close();
  });
  unzipper.on('extract', function (log) {
    console.log('Finished extracting');
    progressBar.value += 1;
  });
  unzipper.extract({
    path: destination,
    filter: function (file) {
        return file.type !== "SymbolicLink";
    }
  });
}

/**
 * Faz o download do arquivo
 * @param {String} fileDownload 
 */
async function downloadFile(fileDownload) {
  return await download(mainWindow, fileDownload, {
    directory: path.join(directory.toString(), 'downloads'),
    saveAs: false,
    showBadge: false,
  });
}

/**
 * Testa se o diretório é válido
 * @param {String} directoryValid 
 */
function installValid(directoryValid, showmessage = true) {
  if (directoryValid === '' || !directoryValid) {
    if (showmessage)
      dialog.showErrorBox("Erro!", "Selecione um diretório antes de iniciar o jogo!");
    return false;
  }
  if (!fs.existsSync(path.join(directoryValid.toString(), 'data'))) {
    if (showmessage)
      dialog.showErrorBox("Erro!", "Diretório Data não existe dentro do diretório do World of Warcraft!");
    return false;
  }
  if (!fs.existsSync(path.join(directoryValid.toString(), 'wow.exe'))) {
    if (showmessage)
      dialog.showErrorBox("Erro!", "Não encontrei executável dentro do diretório do World of Warcraft!");
    return false;
  }
  return true;
}

/**
 * Exibe mensagem vinda do front-end
 */
ipcMain.on('message', (evt, title, message) => {
  dialog.showMessageBoxSync({
    title: title,
    message: message
  });
});