const { app, BrowserWindow } = require('electron')
const {ipcMain} = require('electron')
const { exec } = require('child_process');
const rimraf = require("rimraf");

function createWindow () {
  const win = new BrowserWindow({
    width: 960,
    height: 503,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false,
    enableRemoteModule: true
  })

  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
ipcMain.on('close_window', (evt, arg) => {
  app.quit()
})
ipcMain.on('play_wow', (evt, arg) => {
  var directory = 'E:\\Wow\\';
  rimraf.sync("E:\\Wow\\cache\\");
  exec(directory + 'Wow.exe');
  app.quit()
})