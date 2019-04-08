"use strict";

var fs = require('fs');
var url = require('url');
var http = require('http');
var crypto = require('crypto');
var mongodb = require('mongodb');
var arangojs = require('arangojs');
var WebSocketServer = require('websocket').server;

var port = 8080;
var clients = [];

// === AUTO RESTART when index.js is changed/deployed ==================================================================

var hash = null;
setInterval(function () {
    var s = crypto.createHash('sha256').update(
        fs.readFileSync("index.js").toString()
    ).digest("hex");
    if (!!hash && hash !== s) process.exit(0);
    hash = s;
}, 1000);

// === ARANGO, HTTP, & WS SERVICES ======================================================================================

mongodb.MongoClient.connect('mongodb://localhost:27017/webicq', function(err, dbs) {
    if (err) throw err;
    var db = {};
    dbs.collections(function (err, res) {
        //console.log(err, res);
        if (err) throw err;
        res.forEach(function (collection) {
            db[collection.s.name] = collection;
        });
        // as we have connected to mongo we are starting http service
        var server = http.createServer(function (request, response) {
            //console.log("request url: ", request.url);
            var tmp = request.url;
            while (tmp.indexOf("..") > -1) tmp = tmp.replace("..",  "");
            while (tmp.indexOf("//") > -1) tmp = tmp.replace("//", "/");
            tmp = url.parse(tmp, true, true);
            //console.log("parsed url: ", tmp);
            var filename = tmp.pathname;
            if (filename == "/") filename = "/index.html";
            filename = "content" + filename;
            //console.log(filename);
            fs.readFile(filename,
                function(error, content) {
                    if (error) {
                        response.writeHead(404);
                        response.end("oops?");
                        return;
                    }
                    var headers = {};
                    var ext = filename.split('.').pop();
                    switch (ext) {
                        case 'js'  : headers["Content-Type"] = 'text/javascript'          ; headers["Expires"] = "Mon, 1 Feb 2010 00:00:00 GMT"; break;
                        case 'css' : headers["Content-Type"] = 'text/css'                 ; headers["Expires"] = "Mon, 1 Feb 2010 00:00:00 GMT"; break;
                        case 'json': headers["Content-Type"] = 'application/json'         ; headers["Expires"] = "Mon, 1 Feb 2010 00:00:00 GMT"; break;
                        case 'png' : headers["Content-Type"] = 'image/png'                ; headers["Expires"] = "Mon, 1 Apr 2020 00:00:00 GMT"; break;
                        case 'jpg' : headers["Content-Type"] = 'image/jpg'                ; headers["Expires"] = "Mon, 1 Jun 2020 00:00:00 GMT"; break;
                        case 'wav' : headers["Content-Type"] = 'audio/wav'                ; headers["Expires"] = "Mon, 1 Jun 2020 00:00:00 GMT"; break;
                        case 'zip' : headers["Content-Type"] = 'application/octet-stream' ; headers["Expires"] = "Mon, 1 Jun 2020 00:00:00 GMT"; break;
                        default    : headers["Content-Type"] = "text/html"                ; headers["Expires"] = "Mon, 1 Feb 2010 00:00:00 GMT";
                    }
                    response.writeHead(200, headers);
                    response.end(content);
                }
            );
        }).listen(port, function () {
            console.log("listening on localhost:"  + port + " ...");
            // as http service has been started, we start websocket service
            var wsServer = new WebSocketServer({httpServer: server});
            wsServer.on('request', function(request) {
                var conn = request.accept('mylovelyproto', request.origin);
                var info = conn.socket.remoteAddress + ":" + conn.socket.remotePort;
                console.log(info, "conn");
                var client = {info: info, conn: conn};
                clients.push(client);
                conn.on('message', function(data) {
                    wsRecv(db, client, data);
                });
                conn.on('close', function(reasonCode, description) {
                    console.log(info, "disc", reasonCode, description);
                    clients.splice(clients.indexOf(client), 1);
                    wsClose(db, client);
                });
            });
        });
    });
});

// === APP SERVICE =====================================================================================================

function wsSend(client, msg) {
    var str = JSON.stringify(msg);
    console.log(client.info, "send", str);
    client.conn.sendUTF(str);
}
function wsRecv(db, client, data) { // may return 1xx errors
    var str = data.utf8Data;
    console.log(client.info, "recv", str);
    var msg = JSON.parse(str);

    // only ping and join allowed for client without assigned uid
    if (!client.uid && ["ping","join"].indexOf(msg.type) < 0)
        return wsSend(client, {type: "join", error: 100});
    if (msg.type != "ping" && msg.type != "find") {
        db.logs.insert(msg, function (err, res) {
            console.log("log inserted:" + msg + "\nerror:", err, "\nresult:", "res");});
    }

    switch(msg.type) {
        case "ping": wsSend(client, {type: 'pong'}); break;
        case "join": wsRecvJoin(db, client, msg); break;
        case "find": wsRecvFind(db, client, msg); break;
        case "user": wsRecvUser(db, client, msg); break;
        case "chat": wsRecvChat(db, client, msg); break;
        case "room": wsRecvRoom(db, client, msg); break;
        case "sync": wsRecvSync(db, client, msg); break;
        default: console.error("unknown message type");
    }
    db.logs.remove(msg, function (err, res) {
        console.log("log removed:" + msg + "\nerror:", err, "\nresult:", "res");});
}
function wsRecvJoin(db, client, msg) { // may return 3xx errors
    if (!msg.uname || !msg.pass1) return wsSend(client, {type: "join", error: 300}); // bad params
    var isNewUser = (msg.pass1 == msg.pass2); // do we need to try to register/insert or not
    var passw = crypto.createHash('sha256').update(msg.pass1).digest("hex"); // we do not store passwords
    db.users.findOneAndUpdate ( // try to find and if not there then insert a user into db
        { uname: msg.uname, passw: passw }, {
            $set: { last: Date.now() }, // what to insert or update any way (for example here is the last time user has joined)
            $setOnInsert: { // what to set on insert only
                id: "u" + Date.now() + "" + process.hrtime().join(""), // new id for new user
                uname: msg.uname, passw: passw, status: "online", peers: {}
            }
        }, {
            upsert: isNewUser, // if new user, try to insert if it is not there yet
            returnOriginal: !isNewUser // if new user, return just created document, otherwise return previous, not updated version
        }, function (err, res) {
            //console.log(err, res);
            if (err) {
                if (err.code == 11000) return wsSend(client, {type: "join", error: 301}); // uname with diff password already exists
                else throw err; // something wrong, hard stop
            }
            var user = res.value; //this is our user we have found or just created/inserted
            db.users.find({ id: { $in: Object.keys(user.peers || {}) } }).toArray(function(err, peers) { //get peers from db
                //console.log(err, peers);
                if (err) throw err; // something wrong, hard stop

                client.uid = user.id; // assign user to the client
                db.rooms.find({ id: { $in: Object.keys(user.rooms || {}) } }).toArray(function(err, rooms) {
                    if (err) throw err; // something wrong, hard stop

                //reply back to the user client with user info and list of peers
                    wsSend(client, {
                        type: "join",
                        user: { id: user.id, uname: user.uname, status: user.status },
                        peers: peers.map(function (peer) {
                            return {id: peer.id, uname: peer.uname, status: peer.status, state: user.peers[peer.id].state};
                        }),
                        rooms: rooms.map(function (room) {
                            return {id: room.id, roomName: room.roomName, creator: room.creator, admins: room.admins, roommates: room.roommates, invited: room.invited, canceled: room.canceled};
                        })
                    });

                    // do we need to notify other peers' clients? (yes, if this user is not connected via _another_ client)
                    if ( !clients.find(function (c) { return (c != client && c.uid == client.uid); }) )
                        clients.forEach(function (c) {
                            peers.forEach(function (peer) {
                                if (c.uid == peer.id && peer.peers[user.id]) // ...&& peer has this user as its peer
                                    wsSend(c, { type:"user", user: {id: user.id, uname: user.uname, status: user.status, state: peer.peers[user.id].state } });
                            });
                        });
                });
            });
        });
}
function wsRecvFind(db, client, msg) {// may return 4xx errors
    if (!msg.text) return wsSend(client, {type: "find", error: 400}); // bad params
    db.users.findOne({id: client.uid}, function (err, user) {
        //console.log(err, user);
        if (err) throw err; // something wrong, hard stop
        db.users.find({
            id:    { $nin: Object.keys(user.peers || {}).concat([user.id]) },
            uname: { $regex : ".*" + msg.text + ".*"     }
        }).limit(50).toArray(function(err, users) { // up to 50 items
            //console.log(err, users);
            if (err) throw err; // something wrong, hard stop
            var list = users.map(function (u) { return { id: u.id, uname: u.uname, status: u.status }; });
            wsSend(client, {type: "find", list: list});
        });
    });
}
function wsRecvUser(db, client, msg) { // may return 5xx errors
    var user, peer;
    if (!msg.user || !msg.user.id) return wsSend(client, {type: "user", error: 500}); // bad params
    if (msg.user.id == client.uid) { // user modifies itself
        if (msg.user.passw) msg.user.passw = crypto.createHash('sha256').update(msg.user.passw).digest("hex"); // we do not store passwords
        user = assign(msg.user, ["id","uname","passw","status"]);
        db.users.findOneAndUpdate({ id: user.id }, { $set: user }, { returnOriginal: false }, function(err, res) {
            //console.log(err, res);
            if (err) {
                console.error(err);
                if (err.code == 11000) return wsSend(client, {type: "user", error: 501}); // someone else is using this uname
                else throw err; // something wrong, hard stop
            }
            user = res.value; //assign(res.value, ["id","uname","status"]);
            // notify all user clients and peers
            db.users.find({ id: { $in: Object.keys(user.peers || {}) } }).toArray(function(err, peers) {
                //console.log(err, peers);
                if (err) throw err; // something wrong, hard stop
                user = assign(user, ["id","uname","status"]);
                clients.forEach(function (c) {
                    if (c.uid == user.id) // this is one of the user clients
                        wsSend(c, { type: "user", user: user });
                    else
                        peers.forEach(function (peer) {
                            if (c.uid == peer.id && peer.peers[user.id]) // ...&& peer has this user as its peer
                                wsSend(c, { type:"user", user: {id: user.id, uname: user.uname, status: user.status, state: peer.peers[user.id].state } });
                        });
                });
            });
        });
    } else { // this is about peers
        var userState, peerState;
        switch (msg.action) {
            case "invite": peerState = "invite"; userState = "verify"; break;
            case "accept": peerState = "accept"; userState = "accept"; break;
            case "reject": peerState = "delete"; userState = "reject"; break;
            case "cancel": peerState = "delete"; userState = "delete"; break;
            default:
                console.error("bad msg.action!", msg.action);
                return;
        }
        user = {id: client.uid};
        peer = {id: msg.user.id};

        // if at least two - create room
        var rid = "r" + crypto.createHash('sha256').update(user.id < peer.id ? user.id + peer.id : peer.id + user.id).digest("hex");
        if (peerState === "accept" && userState === "accept") {
            // user.room = {id: rid};
            // peer.room = {id: rid};
            db.rooms.findOneAndUpdate({id: rid}, {id:rid, peers: [user.id, peer.id]},{upsert: true, returnOriginal: true}, function (err, res) {
                console.log("added room :" + rid + "\nerror:", err, "\nresult:", "res");
                // notify();
            });
        }
        // else {
        //     //     otherwise remove room
        //     db.rooms.remove ({id: rid} , function (err, res) {
        //         console.log("deleted room :" + rid + "\nerror:", err, "\nresult:", res);
        //     });
        // }
        else if (peerState !== "accept" && userState !== "accept") {
            db.rooms.findOneAndUpdate({id: rid}, {id:rid, oldPeers: [user.id, peer.id]},{upsert: true, returnOriginal: true}, function (err, res) {
                console.log("added room :" + rid + "\nerror:", err, "\nresult:", "res");
            });
        } else
        if (peerState !== "accept" || userState !== "accept") {
            if (peerState !== "accept") {
                {db.rooms.findOneAndUpdate({id: rid}, {id:rid, peers: [user.id], oldPeers: [peer.id]},{upsert: true, returnOriginal: true}, function (err, res) {
                    console.log("added room :" + rid + "\nerror:", err, "\nresult:", "res");
                }); }
            } else
            if (userState !== "accept") {
                {db.rooms.findOneAndUpdate({id: rid}, {id:rid, peers: [peer.id], oldPeers: [user.id]},{upsert: true, returnOriginal: true}, function (err, res) {
                    console.log("added room :" + rid + "\nerror:", err, "\nresult:", "res");
                }); }
            }
        }


        // if room exists
        //     add peer and user into room if they are not there

        // if (peerState === "accept" && userState === "accept") {
        //     var rid = "r" + crypto.createHash('sha256').update(user.id < peer.id ? user.id + peer.id : peer.id + user.id).digest("hex");
        //     db.rooms.findOneAndUpdate({id: rid}, {id:rid},{upsert: true, returnOriginal: true}, function (err, res) {
        //         console.log("added room :" + rid + "\nerror:", err, "\nresult:", res);
        //     });
        // }

        // можно воспользоваться кодом ниже:
        var userUpdate = JSON.parse((peerState == "delete") ? '{"$unset":{"peers.' + peer.id + '":1}}' : '{"$set":{"peers.' + peer.id + '.state":"' + peerState + '"}}');
        var peerUpdate = JSON.parse((userState == "delete") ? '{"$unset":{"peers.' + user.id + '":1}}' : '{"$set":{"peers.' + user.id + '.state":"' + userState + '"}}');
        db.users.findOneAndUpdate ({ id: peer.id }, peerUpdate, {upsert: false, returnOriginal: true}, function (err, res) {
            if (err) throw err; // something wrong, hard stop
            peer = res.value;
            db.users.findOneAndUpdate ({ id: user.id }, userUpdate, {upsert: false, returnOriginal: true}, function (err, res) {
                if (err) throw err; // something wrong, hard stop
                user = res.value;
                // notify all clients
                clients.forEach(function (c) {
                    if (c.uid == user.id) { // send update to all clients with the user.id
                        wsSend(c, { type: "user", user: {id: peer.id, uname: peer.uname, status: peer.status, state: peerState} });
                    } else
                    if (c.uid == peer.id) { // send update to all clients with the peer.id
                        wsSend(c, { type: "user", user: {id: user.id, uname: user.uname, status: user.status, state: userState} });
                    }
                });
            });
        });
    }
}
function wsRecvChat(db, client, msg) { // may return 6xx errors
    if (!msg.chat || !msg.chat.id) return wsSend(client, {type: "find", error: 600}); // bad params
    var rid;
    // короче, у нас тут проблема c rid[0] = r / u.
    // теперь оба начинаются на r, почему так получилось - хз, но нам надо как-это это разнести.
    // Потому что нужно создавать мульти комнаты и комнаты для двоих - у них разный функционал.
    // Просто видимо раньше мы не предполагали, что для двоих тоже нужна будет комната...
    // UPD: Хотел сделать чтоб для двоих rid будет начинаться с "d", типа диалог, а для мульти комнаты - r, потому что это room и есть
    // но выскочила такая ошибка: http://prntscr.com/fk98zs
    if (msg.chat.id[0] == "r") { rid = "m" + msg.chat.id; } else
    if (msg.chat.id[0] == "u") { rid = "r" + crypto.createHash('sha256').update(client.uid < msg.chat.id ? client.uid + msg.chat.id : msg.chat.id + client.uid).digest("hex"); }
    if (!rid) return wsSend(client, {type: "chat", error: 601}); // invalid identifier format
    if (rid[0] == "r") {
        db.rooms.findOne({id: rid}, function(err, room) {
            if (err) throw err; // something wrong, hard stop
            if (!room) return wsSend(client, {type: "chat", error: 602}); // no such room!
            var mts = Date.now();
            db.messages.insertOne({rid: room._id, ts: mts, msg: msg.chat.text}, function (err, res) {
                if (err) throw err; // something wrong, hard stop
                // тут они должны получить msgs

                clients.forEach(function (c) {
                   if  (room.peers.indexOf(c.uid)>=0) {
                       msg.user = {id: client.uid};
                       wsSend(c, msg);
                   }
                });

            });
        });
    } else
    if (rid[0] == "u") {

        /// тут тоже сообщения надо прописать как получать
    }


}

function wsRecvRoom (db, client, msg) {
 // тут наверное нужные какие-то условия, как в wsRecvChat

    switch(msg.action) {
        // 0. на клиенте чел кликнул добавить комнату, с клиента отправляется msg
        // (type: 'room', action: 'create', roomName: '_рандомно_', chat.id: '_не знаю как сделать, может по создателю_')
        case "create": createRoom(db, client, msg); break;

        // 1. На клиенте чел нажал на поиск, там html+css поменялся, выкинулось поле для поиска юзера, ввели имя, нажали поиск
        //  {type:"room", action:"find", text:"u2", chat.id: '_'}
        case "find": findToRoom(db, client, msg); break;

        // 2. (тут без статуса (без access) я решил, там и так понятно, если твой id находится в креаторе - то одно, если в руммэйт - другое)
        // тут клиент получает сообщение что он креатор, там он выбрал пиров чтобы пригласить в чат, и отправил сюда сообщение со списком приглашенных
        // примерно так: (type: 'room', action: 'invite', invited: [u1.id, u2.id, u3.id, u4.id], chat.id: '_'}
        case "invite": inviteRoom(db, client, msg); break;

        // 3. клиенты получают сообщения и находят себя в списке invited, там вырисовывается вопрос, согласиться или отменить
        // если нажимает согласиться, на сервер отправляется: {type: 'room', action: 'accept', chat.id: '_'}
        case "accept": confirmRoom(db, client, msg); break;

        // 4. либо нашли себя в списке invited, либо уже были в руммэйтс, но отказались от приглашения / удалились, либо админ удалил
        // отправляется {type: 'room', action: 'cancel', chat.id: '_', uid: ''}
        case "cancel": cancelRoom(db, client, msg); break;

        // 5. roommate'а создатель назначил админом (или несколько юзеров назначил)
        // отправляется что-то типа {type: 'room', action: 'toAdmin', admins: [u1, u2], chat.id: '_'}
        case "toAdmin": toAdminRoom(db, client, msg); break;

        // 5. создатель админов сделал руммэйтами
        // отправляется что-то типа {type: 'room', action: 'deAdmin', roommates: [u1, u2], chat.id: '_'}
        case "deAdmin": deAdminRoom(db, client, msg); break;



        default: console.error("unknown message action");
    }

}

function createRoom(db, client, msg) {
    var rid = "r" + Date.now() + "" + process.hrtime().join("");
    db.rooms.findOneAndUpdate({id: rid}, {
        id: rid,
        roomName: msg.roomName,
        roomType: msg.roomType,
        peers: [{id: msg.creator,
            type:"OWNER"}]
    },
        {upsert: true, returnOriginal: true}, function (err, res) {
            console.log("added room :" + rid + "\nerror:", err, "\nresult:", "res");
        },
        function (db, rid) {wsRoomSync (db, rid)},
        function (db, rid) {console.log("db, rid: ", db + " " + rid)}
        );

    //wsSyncRoom (db, client, rid);
    // wsRoomSync (db, rid);
}

function findToRoom(db, client, msg) {
    var rid = msg.rid;
    var list = db.users.find( { name: { $in: msg.text } } );
    wsSend(client, {
        type: 'room',
        action: 'find',
        list: list,
        id: rid
    });
}


function inviteRoom(db, client, msg) {
    var rid = msg.rid;
    msg.invited.forEach(function(i) {db.rooms.updateOne({id: rid}, {$addToSet: {roommates: i}});},
        function (err, res) {console.log("invited :" + i + "\nerror:", err, "\nresult:", "res"); });
    wsRoomSync (rid);
}

function confirmRoom(db, client, msg) {
    var rid = msg.rid;
    db.rooms.updateOne({id: rid}, {$addToSet: {roommates: client.id}});
    db.rooms.updateOne({id: rid}, {$pull: {invited: client.id}});
    wsRoomSync (msg, rid);
}

function cancelRoom(db, client, msg) {
    var rid = msg.rid;
    db.rooms.updateOne({id: rid}, {$addToSet: {canceled: msg.uid}});
    db.rooms.updateOne({id: rid}, {$pull: {invited: msg.uid}});
    db.rooms.updateOne({id: rid}, {$pull: {roommates: msg.uid}});
    db.rooms.updateOne({id: rid}, {$pull: {admins: msg.uid}});
    wsRoomSync (msg, rid);
    // после этого у всех отображается, что этот чел отказался от участия в чате. Надо подумать как это будет работать
}

function toAdminRoom(db, client, msg) {
    var rid = msg.rid;
    msg.admins.forEach(function(a) {
        db.rooms.updateOne({id: rid}, {$addToSet: {admins: a}});
        db.rooms.updateOne({id: rid}, {$pull: {roommates: a}});
        console.log("added to admins :" + a);
    }
    );
    wsRoomSync (msg, rid);
}

function deAdminRoom(db, client, msg) {
    var rid = msg.rid;
    msg.roommates.forEach(function(r) {
            db.rooms.updateOne({id: rid}, {$addToSet: {roommates: r}});
            db.rooms.updateOne({id: rid}, {$pull: {admins: r}});
            console.log("deleted from admins :" + r);
    }
    );

    wsRoomSync (msg, rid);
}

function wsRoomSync (db, rid) {
    console.log("db.rooms[rid].peers: ", db.rooms[rid].peers);
    db.rooms[rid].peers.forEach( function(p) {
        wsSend(p, {
            type: 'room',
            id: db.rooms[rid].rid,
            roomName: db.rooms[rid].roomName,
            roomType: db.rooms[rid].roomType,
            peers: db.rooms[rid].peers
        });
    });
}

function wsRecvSync(db, client, msg) { // may return 7xx errors
}
function wsClose(db, client) {
    // on this event a client is already removed from the list of all clients, and
    // if no user assigned to this client yet, or there is an[other] client with the same user, then we don't need to notify anyone
    if ( !client.uid || clients.find(function (c) { return c.uid == client.uid; }) ) return;
    // otherwise get peers from db and notify them
    db.users.findOne({id: client.uid}, function(err, user) {
        //console.log(err, user);
        if (err) throw err; // something wrong, hard stop
        // notify peers about user
        var pids = Object.keys(user.peers || {});
        if (pids.length)
            db.users.find({ id: { $in: pids } }).toArray(function(err, peers) {
                //console.log(err, peers);
                if (err) throw err; // something wrong, hard stop
                peers.forEach(function (peer) {
                    clients.forEach(function (c) {
                        if (c.uid == peer.id && peer.peers[user.id]) // ...&& peer has this user as its peer
                            wsSend(c, { type:"user", user: {id: user.id, uname: user.uname, status: "offline", state: peer.peers[user.id].state } });
                    });
                });
            });
    });
}


// to assign list of properties from one object to another
function assign(src, fields) {
    var res = {};
    fields.forEach(function (name) {
        if (src[name]) res[name] = src[name];
    });
    return res;
}




