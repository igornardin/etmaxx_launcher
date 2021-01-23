const { ipcRenderer } = require('electron');
const http = require('https');

var slideIndex = 1;

insertNews();

const config = document.getElementById('config');
config.addEventListener('click', () => {
    ipcRenderer.send('config_window')
});

const playbutton = document.getElementById('play');
playbutton.addEventListener('click', () => {
    ipcRenderer.send('play_wow')
});

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
                showSlides(slideIndex);
            })
        }
    )
    .end()
}

function createSlideNews(json){
    var array = json["news"];
    for(var i = 0; i < 5; i++) {
        var obj = array[i];
        //Cria div principal
        var div_news = document.createElement("div");
        div_news.setAttribute("class", "div_news_main fade");
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
        
        var element = document.getElementById("main_news");
        element.appendChild(div_news);   
    }  
}

// Next/previous controls
function plusSlides(n) {
    showSlides(slideIndex += n);
}

// Thumbnail image controls
function currentSlide(n) {
    showSlides(slideIndex = n);
}

function showSlides(n) {
    var i;
    var slides = document.getElementsByClassName("div_news_main");
    if (n > slides.length) {slideIndex = 1}
    if (n < 1) {slideIndex = slides.length}
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    slides[slideIndex-1].style.display = "block";
}