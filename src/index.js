const { ipcRenderer } = require('electron');
const http = require('https');

insertNews();

document.getElementById('config').addEventListener('click', () => {
    ipcRenderer.send('config_window')
});

document.getElementById('play').addEventListener('click', () => {
    ipcRenderer.send('play_wow')
});

document.getElementById('frameButton_minimize').addEventListener('click', () => {
    ipcRenderer.send('minimize_main')
})

document.getElementById('frameButton_close').addEventListener('click', () => {
    ipcRenderer.send('close_main')
})

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
    document.getElementById("newsLoading").setAttribute("style", "display: none");
    document.getElementById("main_news").setAttribute("style", "display: block");
}