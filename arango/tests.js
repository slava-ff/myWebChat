"use strict";

var arangojs = require('arangojs');

var adb = new arangojs.Database({
    url: "https://test:pass@slava.dnset.com",
    databaseName: "TEST"
});

// module.exports = {
//     getAllUsers : function()
//     {
//         return adb.database('TEST')
//             .then(function (mydb) {return mydb.query('FOR x IN User RETURN x');})
//             .then(function (cursor) { return  cursor.all();});
//     }
// };

// function getSomeRandomUser(collection)
// {
//     adb.query('FOR doc IN ' + collection + ' SORT RAND() LIMIT 1 RETURN doc')
//         .then(function (cursor) { return  console.log(cursor.all());});
// }
//
// getSomeRandomUser ('m');


var x = 'u2';
var y = 'u2u2';
var calls = {
    // getAllUsers: function () {
    //     return adb.query('FOR x IN m RETURN x').then(function(cursor) {return cursor.all()});
    // },
    findJoinedUser: function () {
        return adb.query('FOR doc IN u FILTER doc.name == "' + x + '" FILTER doc.pass == "' + y + '" RETURN doc').then(function(cursor) {return cursor.all()});
    },
    createNwUser: function () {
        return adb.query('INSERT {id: "' + Date.now() + '", uname: "' + Date.now() + '", passw: "' + Date.now() + '", status: "online"} ' +
            'IN u options  { waitForSync: true } RETURN NEW')
    }
};

calls.findJoinedUser().then(function(users){
    console.log(users);
});

calls.createNwUser().then(function(users){
    console.log(users);
});

// написать функкции:
// 1. найти юзера, если нет - создать и запихнуть в БД - отправить клиенту инфу о его юзере
// 2. найти все комнаты юзера (всех пиров и румов) - отправить их юзеру, отправить им о юзере
// 3. найти список юзеров, содержащих в имени часть текста
// 4. юзер модифицирует себя
// 5. юезеры invite accept reject cancel
// 6. чатятся
// 7. room: create find invite accept cancel toAdmin deAdmin


// var calls2 = {
//     findJoinedUser2: function () {
//         return adb.query('FOR doc IN users FILTER doc.uname == "' + msg.uname + '" FILTER doc.passw == "' + passw + '" RETURN doc').then(function(cursor) {return cursor.all()});
//     },
//     createNwUser2: function () {
//         return adb.query('INSERT {id: "' + "u" + Date.now() + "" + process.hrtime().join("") + '", uname: "' + msg.uname + '", passw: "' + passw + '", status: "online"} ' +
//             'IN u options  { waitForSync: true } RETURN NEW')
//     }
//
//
// };





















// adb.collections(function(err, res){
//     if (err) throw err;
//     var dbs = {};
//     res.forEach(function(v){dbs[v.name] = v});
//     adb.graphs(function(err, res) {
//         res.forEach(function(v){dbs[v.name] = v});
//         continueWithMappedCollections(dbs);
//     });
// });

// // тут сохраняем collections (documents)
// function continueWithMappedCollections(db) {
//     console.log(Object.keys(db));
//
//     var r1 = {
//         id: Date.now(),
//         name: 'r1'
//     };
//
//     var u1 = {
//         id: Date.now(),
//         uname: 'u1',
//         passw: 'u1',
//         status: 'offline',
//         rooms:[]
//     };
//     db.rooms.save(r1).then(
//         function r1Ok ( meta) {
//             console.log('Room saved:', meta._rev);
//             r1._key = meta._key;
//             db.users.save(u1).then(
//                 function u1Ok ( meta) {
//                     console.log('Document saved:', meta._rev);
//                     u1._key = meta._key;
//                     //
//                 },
//                 function (err) { console.error('Failed to save document:', err)}
//             );
//         },
//         function (err) { console.error('Failed to save room:', err)}
//     );
// }


// // тут сохраняем edges
// function continueWithMappedCollections(db) {
//     console.log(Object.keys(db));
//     Promise.all([
//         db.u.document("u2"),
//         db.r.document("r123")
//     ]).then(function (results) {
//         var x = results[0];
//         console.log(x);
//         var y = results[1];
//         console.log(y);
//         return db.m.save({_from: x._id, _to: y._id, msg: 'TEST_webstorm'});
//     })
//     .then(
//         function (meta) {console.log(meta)},
//         function(err){console.log(err.toString())}
//     );
// }

// тут работаем с graphs (здесь хз, может удалить(
// adb.graphs(function(err, res){
//     if (err) throw err;
//     var dbs = {};
//     res.forEach(function(v){dbs[v.name] = v});
//     continueWithMappedGraphs(dbs);
// });

// тут работаем с graphs
// function continueWithMappedCollections(db) {
//     console.log(Object.keys(db));
// }

