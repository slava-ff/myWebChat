// var log = require('logger')(module);
// вот тут я уже ничего не понимаю - и оно не работает
module.exports = function(module) {
  return function (/* ... */) {
      var args = [module.filename].concat([].slice.call(arguments));

      console.log.apply(console, args);
  }  
};