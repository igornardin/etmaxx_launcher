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
let patchFilesDownload = [];
let patchFilesDestination = [];

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

  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    var progressBar = new ProgressBar({
      text: 'Baixando...',
      indeterminate: false,
      detail: 'Espere...',
      maxValue: 100,
      browserWindow: {
        parent: mainWindow,
        icon: path.join(__dirname, 'assets', 'images', 'favicon.ico'),
      }
    });
    progressBar
    .on('completed', function () {
      progressBar.detail = 'Instalação finalizada. Saindo...';
    })
    .on('aborted', function () {
      console.info(`A atualização foi abortada...`);
    }); 
    item.on('updated', (event, state) => {
      if(state === 'progressing' && !progressBar.isCompleted()){
        progressBar.detail = `Atualização ${item.getReceivedBytes()} bytes de ${item.getTotalBytes()} bytes...`;
        progressBar.value = (item.getReceivedBytes() / item.getTotalBytes()) * 100;  
      }
    })
  });
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
autoUpdater.on('update-available', (UpdateInfo) => {
  mainWindow.webContents.send('update_available');
  let size = UpdateInfo["files"][0]["size"] / 1000000;
  autoUpdateProgressBar = new ProgressBar({
    text: 'Atualizando o launcher...',
    indeterminate: false,
    detail: `Espere... Recebido 0 MB de ${size} MB`,
    maxValue: 100,
    browserWindow: {
      parent: mainWindow,
      icon: path.join(__dirname, 'assets', 'images', 'favicon.ico'),
      closable: false
    }
  });
});

/**
 * Mostra atualização do download
 */
autoUpdater.on('download-progress', (progress) => {
  // Se a janela foi finalizada antes da hora
  if (!autoUpdateProgressBar.isInProgress())
    return
  let size = progress.total / 1000000;
  let downloaded = progress.transferred / 1000000;
  autoUpdateProgressBar.detail = `Espere... Recebido ${downloaded} MB de ${size} MB`;
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
  json = arg.replace(/\\/g, "\\\\");
  patchsToApply = JSON.parse(json)["patchs"];
  for (let indexPatch = 0; indexPatch < patchsToApply.length; indexPatch++) {
    if (patchsToApply[indexPatch]["patch_number"] > store.get('patch')) {
      hasPatch = true;
      patchFilesDownload.push(patchsToApply[indexPatch]["file"]);
      patchFilesDestination.push(patchsToApply[indexPatch]["destination"]);
      lastPatchToApply = patchsToApply[indexPatch]["patch_number"];
    }
  }
  return hasPatch;
})

function applyPatch() {
  if (!installValid(directory)) {
    return false;
  }
  patchbefore = store.get('patch');
  removeDownloads();
  downloadFilesPatch();
  return true;
}

/**
 * Controle de arquivos do patch
 */
async function downloadFilesPatch(){
  for (let index = 0; index < patchFilesDownload.length; index++) {
    await downloadFile(patchFilesDownload[index]).then((result) => {
      unzipFile(result, path.join(directory.toString(), patchFilesDestination[index])).then(() => {
        store.set('patch', lastPatchToApply);
      }).catch(() => {
        store.set('patch', patchbefore);
      });
    });
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
 * Controle de opcionais
 */
ipcMain.on('download_optional', (evt, destination, url) => {
  if (!installValid(directory)) {
    return false;
  }
  removeDownloads();
  downloadFile(url).then((result) => {
    unzipFile(result, path.join(directory.toString(), destination));
  });
});

ipcMain.on('remove_optional', (evt, destination, file_match) => {
  if (!installValid(directory)) {
    return false;
  }
  rimraf.sync(path.join(directory.toString(), destination, file_match));
});

/**
 * Descompacta o arquivo
 * @param {Electron.DownloadItem} result 
 * @param {String} destination 
 */
function unzipFile(result, destination){
  return new Promise((resolve, reject) => {
    var unzipper = new DecompressZip(result.getSavePath());
    unzipper.on('error', function (err) {
        log.info(err);
        log.info(result.getSavePath());
        log.info(destination);
        dialog.showErrorBox("Erro na aplicação do download", "Não foi possível aplicar o download no client do World of Warcraft. Tente novamente mais tarde!");
        reject();
    });
    unzipper.on('extract', function (log) {
      console.log('Finished extracting');
      resolve();
    });
    unzipper.extract({
      path: destination,
      filter: function (file) {
          return file.type !== "SymbolicLink";
      }
    });
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

/**
 * Verifica se o arquivo existe
 */
ipcMain.handle('verify_file', (evt, destination, file_match) => {
  if (!installValid(directory, false)) {
    return false;
  }
  let files = glob.sync(path.join(directory.toString(), destination, file_match));
  return files.length == 0 ? false : true;
});

function removeDownloads(){
  rimraf.sync(path.join(directory.toString(), 'downloads', '*'));
}