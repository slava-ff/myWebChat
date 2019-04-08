// берём Express
var express = require('express');

// создаём Express-приложение - //не понял зачем это??
var app = express();

// создаём маршрут для главной страницы
// http://localhost:8080/
app.get('/', function(req, res) {
    res.sendfile('index.html');
});

// запускаем сервер на порту 8080
app.listen(8080);
// отправляем сообщение
console.log('Сервер стартовал!');


console.log(module);