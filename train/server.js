//module.exports = exports = this

var db = require('db');
db.connect(); // коннектиться можно один раз из любого файла - и тут и в user\index.js
//var phrases = require('./ru');
var User = require('./user');
// require('./user');
// userjs = объект exports
// userjs = {User: function}



function run() {
    var vasya = new User ("Вася");
    var petya = new User ("Петя");

    vasya.hello(petya);

    console.log(db.getPhrase("Run successful"))
}

if (module.parent) {
    exports.run = run;
    //run();
} else {
    run();
}





// 6.01
// var User = require('./user');
//
// function run() {
//     var vasya = new User("Вася");
//     var petya = new User("Петя");
//
//     vasya.hello(petya);
// }
//
// if (module.parent) {
//     exports.run = run;
// } else {
//     run();
// }