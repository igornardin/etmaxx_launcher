const { ipcRenderer } = require('electron');
const http = require('https');

let arrayAddons;

insertNews();
searchPatches();
searchOptional();
setConfigCurrent("settingsTabLauncher");

ipcRenderer.invoke('get_version').then(function (results) {
    document.getElementById("CurrentVersionValue").textContent = results;
});

ipcRenderer.invoke('patch_applied').then(function (results) {
    document.getElementById("CurrentPatchValue").textContent = results;
});

ipcRenderer.invoke('get_directory').then(function (results) {
    if(!results){
        ipcRenderer.send('message', 'Atenção!', 'Antes de qualquer coisa, selecione o diretório que seu World of Warcraft esteja instalado no botão de configurações ao lado do botão Play!')
    }else
    {
        document.getElementById("wowDirectoryText").value = results;
    }
    
});

ipcRenderer.invoke('get_closeLauncher').then(function (results) {
    document.getElementById("closeLauncher").checked = results;
});

document.getElementById('wowDirectory').addEventListener('click', () => {
    ipcRenderer.invoke('Open_folder').then(function (results) {
        document.getElementById("wowDirectoryText").value = results;
        updateOptional();
    });
});

document.getElementById('closeLauncher').addEventListener('click', () => {
    ipcRenderer.send('set_closeLauncher', document.getElementById("closeLauncher").checked);
});

document.getElementById('config').addEventListener('click', () => {
    openConfig();
});

document.getElementById('play').addEventListener('click', () => {
    ipcRenderer.send('play_wow');
});

document.getElementById('buttonPatch').addEventListener('click', () => {
    ipcRenderer.invoke('apply_patch').then(function (results) {
        if(results)
            document.getElementById("buttonPatch").setAttribute("style", "display: none");
    });
});

document.getElementById('frameButton_minimize').addEventListener('click', () => {
    ipcRenderer.send('minimize_main');
})

document.getElementById('frameButton_close').addEventListener('click', () => {
    ipcRenderer.send('close_main');
})

function openConfig(){
    document.getElementById("body_main").setAttribute("style", "display: none");
    document.getElementById("body_config").setAttribute("style", "display: block");
}

function openMain(){
    document.getElementById("body_main").setAttribute("style", "display: block");
    document.getElementById("body_config").setAttribute("style", "display: none");
}

function insertNews(){
    http.request(
        {
            hostname: "etmaxx.com.br",
            path: "/en/news/last"
        },
        res => {
            let data = ""

            res.on("data", d => {
                data += d;
            })
            res.on("end", () => {
                createSlideNews(JSON.parse(data));
                document.getElementById("newsLoading").setAttribute("style", "display: none");
                document.getElementById("news_div").setAttribute("style", "display: block");
            })
        }
    )
    .end()
}

function searchPatches(){
    http.request(
        {
            hostname: "etmaxx.com.br",
            path: "/assets/launcher/patch.json"
        },
        res => {
            let data = ""
            res.on("data", d => {
                data += d;
            })
            res.on("end", () => {
                ipcRenderer.invoke('process_patch', data).then(function (result) {
                    if(result)
                        document.getElementById("buttonPatch").setAttribute("style", "display: block");
                });
            })
        }
    )
    .end()
}

function searchOptional(){
    http.request(
        {
            hostname: "etmaxx.com.br",
            path: "/assets/launcher/optional.json"
        },
        res => {
            let data = ""
            res.on("data", d => {
                data += d;
            })
            res.on("end", () => {
                createOptionalTab(data);
            })
        }
    )
    .end()
}

function openUrl(url){
    ipcRenderer.send('open_url', url)
}

function createSlideNews(json){
    var array = json["news"];
    var obj = array[0];
    //Cria div principal
    var div_news = document.createElement("button");
    div_news.setAttribute("class", "div_news_main fade");
    div_news.setAttribute("onclick", "openUrl('https://etmaxx.com.br/en/news/" + obj.id + "')");
    //Cria imagem
    var image_news = document.createElement("img");
    image_news.setAttribute("src", obj.image);
    image_news.setAttribute("class", "image_news_main");
    div_news.appendChild(image_news);
    //Cria caption
    var div_caption = document.createElement("div");
    div_caption.setAttribute("class", "div_caption_news_main");
    //Cria texto do caption
    var div_caption_title = document.createElement("span");
    div_caption_title.setAttribute("class", "caption_news_main");
    div_caption_title.textContent = obj.title;
    div_caption.appendChild(div_caption_title);
    div_news.appendChild(div_caption);
    div_news.appendChild(document.createElement("br"));        
    document.getElementById("main_news").appendChild(div_news);   
    for(var i = 1; i < 4; i++) {
        var obj = array[i];
        //Cria div principal
        var div_news = document.createElement("button");
        div_news.setAttribute("class", "div_news_bottom fade");
        div_news.setAttribute("onclick", "openUrl('https://etmaxx.com.br/en/news/" + obj.id + "')");
        //Cria imagem
        var image_news = document.createElement("img");
        image_news.setAttribute("src", obj.image);
        image_news.setAttribute("class", "image_news_bottom");
        div_news.appendChild(image_news);
        //Cria caption
        var div_caption = document.createElement("div");
        div_caption.setAttribute("class", "div_caption_news_bottom");
        //Cria texto do caption
        var div_caption_title = document.createElement("span");
        div_caption_title.setAttribute("class", "caption_news_bottom");
        div_caption_title.textContent = obj.title;
        div_caption.appendChild(div_caption_title);
        div_news.appendChild(div_caption);
        div_news.appendChild(document.createElement("br"));        
        document.getElementById("other_news").appendChild(div_news);   
    }  
}

function setConfigCurrent(id){
    var documents = document.getElementsByClassName("settingsTab");
    for (let index = 0; index < documents.length; index++) {
        const element = documents.item(index);
        element.setAttribute("style", "display: none");
    }
    document.getElementById(id).setAttribute("style", "display: block");
}

function createOptionalTab(json){
    createAddonsTab(json);
    createOthersTab(json);
}

function createAddonsTab(json){
    json = json.replace(/\\/g, "\\\\");
    arrayAddons = JSON.parse(json)["addons"];
    for (let index = 0; index < arrayAddons.length; index++) {
        const element = arrayAddons[index];
        var settingsFieldContainer = document.createElement("div");
        settingsFieldContainer.setAttribute("class", "settingsFieldContainer");
        var settingsFieldTitle = document.createElement("span");
        settingsFieldTitle.setAttribute("class", "settingsFieldTitle");
        settingsFieldTitle.innerHTML = element["name"];
        settingsFieldContainer.appendChild(settingsFieldTitle);
        var settingsFieldDesc = document.createElement("span");
        settingsFieldDesc.setAttribute("class", "settingsFieldDesc");
        settingsFieldDesc.innerHTML = element["description"];
        settingsFieldContainer.appendChild(settingsFieldDesc);
        var settingsFieldRight = document.createElement("div");
        settingsFieldRight.setAttribute("class", "settingsFieldRight");
        var switchField = document.createElement("label");
        switchField.setAttribute("class", "switch");
        var checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.setAttribute("id", "input_addon_" + element["name"]);
        ipcRenderer.invoke('get_directory').then(function (results) {
            if(!results){
                document.getElementById("input_addon_" + element["name"]).setAttribute("disabled", "true");
            }else{
                ipcRenderer.invoke('verify_file', element["destination"], element["file_match"]).then(function (results) {
                    if(results)
                        document.getElementById("input_addon_" + element["name"]).setAttribute("checked", true);
                    else
                        document.getElementById("input_addon_" + element["name"]).removeAttribute("checked");
                });
            }
        });
        checkbox.setAttribute("onclick", "changeOptional(this.checked, '" + element["destination"] + "', '" + element["url"] + "', '" + element["file_match"] + "')")
        switchField.appendChild(checkbox);
        var slider = document.createElement("span");
        slider.setAttribute("class", "slider");
        switchField.appendChild(slider);
        settingsFieldRight.appendChild(switchField);
        settingsFieldContainer.appendChild(settingsFieldRight);
        document.getElementById("settingsAddonCurrentContainer").appendChild(settingsFieldContainer);          
    }
}

function createOthersTab(json){
    json = json.replace(/\\/g, "\\\\");
    arrayAddons = JSON.parse(json)["other"];
    for (let index = 0; index < arrayAddons.length; index++) {
        const element = arrayAddons[index];
        var settingsFieldContainer = document.createElement("div");
        settingsFieldContainer.setAttribute("class", "settingsFieldContainer");
        var settingsFieldTitle = document.createElement("span");
        settingsFieldTitle.setAttribute("class", "settingsFieldTitle");
        settingsFieldTitle.innerHTML = element["name"];
        settingsFieldContainer.appendChild(settingsFieldTitle);
        var settingsFieldDesc = document.createElement("span");
        settingsFieldDesc.setAttribute("class", "settingsFieldDesc");
        settingsFieldDesc.innerHTML = element["description"];
        settingsFieldContainer.appendChild(settingsFieldDesc);
        var settingsFieldRight = document.createElement("div");
        settingsFieldRight.setAttribute("class", "settingsFieldRight");
        var switchField = document.createElement("label");
        switchField.setAttribute("class", "switch");
        var checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.setAttribute("id", "input_other_" + element["name"]);
        ipcRenderer.invoke('get_directory').then(function (results) {
            if(!results){
                document.getElementById("input_other_" + element["name"]).setAttribute("disabled", "true");
            }else{
                ipcRenderer.invoke('verify_file', element["destination"], element["file_match"]).then(function (results) {
                    if(results)
                        document.getElementById("input_other_" + element["name"]).setAttribute("checked", true);
                    else
                        document.getElementById("input_other_" + element["name"]).removeAttribute("checked");
                });
            }
        });
        checkbox.setAttribute("onclick", "changeOptional(this.checked, '" + element["destination"] + "', '" + element["url"] + "', '" + element["file_match"] + "')")
        switchField.appendChild(checkbox);
        var slider = document.createElement("span");
        slider.setAttribute("class", "slider");
        switchField.appendChild(slider);
        settingsFieldRight.appendChild(switchField);
        settingsFieldContainer.appendChild(settingsFieldRight);
        document.getElementById("settingsOtherCurrentContainer").appendChild(settingsFieldContainer);          
    }
}

function updateOptional(){
    for (let index = 0; index < arrayAddons.length; index++) {
        const element = arrayAddons[index];
        ipcRenderer.invoke('verify_file', element["destination"], element["file_match"]).then(function (results) {
            if(results)
                document.getElementById("input_addon_" + element["name"]).setAttribute("checked", true);
            else
                document.getElementById("input_addon_" + element["name"]).removeAttribute("checked");
        });
    }
}

function changeOptional(element, destination, url, file_match){
    if(element){
        ipcRenderer.send('download_optional', destination, url);
    }else{
        ipcRenderer.send('remove_optional', destination, file_match);
    }
}

ipcRenderer.on('update_available', () => {
    ipcRenderer.removeAllListeners('update_available');
    let element = document.getElementById("play");
    element.innerHTML = "Atualizando...";
    element.disabled = true;
    element.setAttribute("class", "buttons play_disable");
  });