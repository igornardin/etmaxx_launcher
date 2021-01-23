const { ipcRenderer } = require('electron');
const http = require('https');

ipcRenderer.invoke('return_directory', 'true').then(function (results) {
    document.getElementById("diretorio_text").value = results;
});

const closeApp = document.getElementById('close_button');
closeApp.addEventListener('click', () => {
    ipcRenderer.send('close_config')
});

var uploadFile = document.getElementById('diretorio_wow');
uploadFile.addEventListener('click', () => {
    ipcRenderer.invoke('diretorio_wow', 'true').then(function (results) {
        document.getElementById("diretorio_text").value = results;
    });
});
