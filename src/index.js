const { ipcRenderer } = require('electron');
const http = require('https');
const path = require('path');

configBackground();
insertNews();
searchPatches();
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

function configBackground(){
    document.body.style.backgroundImage = 'url(assets/images/LK_background.jpeg)';
}

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
                openMain();
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

function openUrl(url){
    ipcRenderer.send('open_url', url)
}

function createSlideNews(json){
    var array = json["news"];
    for(var i = 0; i < 4; i++) {
        var obj = array[i];
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
        div_caption.setAttribute("class", "caption_news_main");
        //Cria texto do caption
        var div_caption_title = document.createTextNode(obj.title);
        div_caption.appendChild(div_caption_title);
        div_news.appendChild(div_caption);
        div_news.appendChild(document.createElement("br"));        
        var element = document.getElementById("main_news");
        element.appendChild(div_news);   
    }  
    document.getElementById("titulo_news").textContent = "Últimas notícias";
}

function setConfigCurrent(id){
    var documents = document.getElementsByClassName("settingsTab");
    for (let index = 0; index < documents.length; index++) {
        const element = documents.item(index);
        element.setAttribute("style", "display: none");
    }
    document.getElementById(id).setAttribute("style", "display: block");
}