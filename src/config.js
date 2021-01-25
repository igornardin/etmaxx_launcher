const { ipcRenderer } = require('electron');

document.getElementById('frameButton_close').addEventListener('click', () => {
    ipcRenderer.send('close_config')
})

setConfigCurrent("settingsTabLauncher");

ipcRenderer.invoke('get_version').then(function (results) {
    document.getElementById("CurrentVersionValue").textContent = results;
});

ipcRenderer.invoke('patch_applied').then(function (results) {
    document.getElementById("CurrentPatchValue").textContent = results;
});

ipcRenderer.invoke('return_directory').then(function (results) {
    document.getElementById("wowDirectoryText").value = results;
});

document.getElementById('wowDirectory').addEventListener('click', () => {
    ipcRenderer.invoke('Open_folder').then(function (results) {
        document.getElementById("wowDirectoryText").value = results;
    });
});

function setConfigCurrent(id){
    var documents = document.getElementsByClassName("settingsTab");
    for (let index = 0; index < documents.length; index++) {
        const element = documents.item(index);
        element.setAttribute("style", "display: none");
    }
    document.getElementById(id).setAttribute("style", "display: block");
}

function openUrl(url){
    ipcRenderer.send('open_url', url)
}