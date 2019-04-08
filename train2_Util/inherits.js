var util = require('util');

//родитель
function Animal(name) {
    this.name = name;
}

Animal.prototype.walk = function() {
    console.log("Ходит " + this.name);
};

// потомок
function Rabbit(name) {
    this.name = name;
}

util.inherits(Rabbit, Animal);

Rabbit.prototype.jump = function() {
    console.log("Прыгает " + this.name);
};

// Использование
var rabbit = new Rabbit("наш кролик");
rabbit.walk();
rabbit.jump();

///////////////////////////////////////////////////

var human = {walk: true};
var alien = {fly: true};
alien.__proto__ = human; // alien.prototype = human
//util.inherits(alien, human);
console.log("alien.fly :", alien.fly);
console.log("alien.walk :", alien.walk);
console.log("human.fly :", human.fly);
console.log("human.walk :", human.walk);