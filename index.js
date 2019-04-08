"use strict";

var fs = require('fs');
var url = require('url');
var http = require('http');
var crypto = require('crypto');
var WebSocketServer = require('websocket').server;

// === AUTO RESTART when index.js is changed/deployed ==================================================================

var hash = null;
setInterval(function () {
    var s = crypto.createHash('sha256').update(
        fs.readFileSync("index.js").toString()
    ).digest("hex");
    if (!!hash && hash !== s) process.exit(0);
    hash = s;
}, 1000);

// === SIMPLE WEB SERVICE ==============================================================================================

var port = 8080;
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
        function(error, filecontent) {
            if (error) {
                response.writeHead(404);
                response.end("we do not have that file");
                return;
            }
            var headers = {};
            headers["Content-Type"] = "text/html";
            var extname = filename.split('.').pop();
            switch (extname) {
                case 'htm' : headers["Content-Type"] = 'text/html'                ; headers["Expires"] = "Mon, 1 Apr 2000 00:00:00 GMT"; break;
                case 'js'  : headers["Content-Type"] = 'text/javascript'          ; headers["Expires"] = "Mon, 1 Apr 2000 00:00:00 GMT"; break;
                case 'css' : headers["Content-Type"] = 'text/css'                 ; headers["Expires"] = "Mon, 1 Apr 2000 00:00:00 GMT"; break;
                case 'json': headers["Content-Type"] = 'application/json'         ; headers["Expires"] = "Mon, 1 Apr 2000 00:00:00 GMT"; break;
                case 'png' : headers["Content-Type"] = 'image/png'                ; headers["Expires"] = "Mon, 1 Apr 2016 00:00:00 GMT"; break;
                case 'jpg' : headers["Content-Type"] = 'image/jpg'                ; headers["Expires"] = "Mon, 1 Apr 2016 00:00:00 GMT"; break;
                case 'wav' : headers["Content-Type"] = 'audio/wav'                ; headers["Expires"] = "Mon, 1 Apr 2016 00:00:00 GMT"; break;
                case 'zip' : headers["Content-Type"] = 'application/octet-stream' ; headers["Expires"] = "Mon, 1 Apr 2000 00:00:00 GMT"; break;

            }
            response.writeHead(200, headers);
            response.end(filecontent);
        }
    );

}).listen(port);
console.log("listening on localhost:"  +port + " ...");

// === DATA LOAD =======================================================================================================

var rooms = {}, users = {};
fs.readFile("files/users.json", function (err, content) {
    if (err) {
        console.warn("warning: reading file users.json:", err.code);
    } else {
        users = JSON.parse(content.toString());
    }
    // console.log("users:", JSON.stringify(users, null, 4));
    fs.readFile("files/rooms.json", function (err, content) {
        if (err) {
            console.warn("warning: reading file rooms.json:", err.code);
        } else { // y
            rooms = JSON.parse(content.toString());
        }
        // console.log("rooms:", JSON.stringify(rooms, null, 4));
        Object.keys(rooms).forEach(function (rid) {
            var room = rooms[rid];
            room.users = {};
            room.messages = {};
            fs.readFile("files/room-" + rid + ".json", function (err, content) {
                if (err) {
                    console.warn("warning: reading file room-" + rid + ".json:", err.code);
                } else {
                    var temp = JSON.parse(content.toString());
                    temp.users.forEach(function (uid) {
                        var user = users[uid]; // trying to get pointer to user in the global list users
                        if (!user) { // if it does not exist
                            console.warn("warning: linking user:", uid, "not exists in list of users");
                        } else // linking  to room
                            room.users[uid] = user;
                    });
                }
            });
            fs.readFile("files/messages-" + rid + ".json", function (err, content) {
                if (err) {
                    console.warn("warning: reading file messages-" + rid + ".json:", err.code); //ENOENT - not exists, eto warning
                } else {
                    room.messages = JSON.parse(content.toString());
                }
            });
        });
    });
});

// === SIMPLE WS SERVICE ===============================================================================================

var clients = {};
var wsServer = new WebSocketServer({httpServer: server});
wsServer.on('request', function(r){
    var conn = r.accept('mylovelyproto', r.origin); // r.accept = подтверждение соедениения??; dа. а r.origin?
    var id = Date.now();

    //console.log("id:", id);
    clients[id] = {
        user: null,
        conn: conn,
        send: function (msg) {
            var str = JSON.stringify(msg);
            console.log("send:", str);
            conn.sendUTF(str);
        }
    };
    //console.log("clients[id]", clients[id]);
    //console.log("clients", clients);

    conn.on('message', function(message) { // = когда любой юзер
        var str = message.utf8Data; // prosto container/string
        console.log("recv:", str);

        var user = null;
        var room = null;
        var usr = null;
        var msg = JSON.parse(str);          //строка стала объектом
        switch(msg.type) {                  // языковая вместо if-else
            case "join":
                user = userJoin (msg.uname, msg.pass1, msg.pass2);
                if (!user) return clients[id].send({type: "join", user: null});

                var reg = user.reg;
                delete user.reg;

                clients[id].user = user;
                usr = userCopy(user);

                clients[id].send({type: "join", user: usr, reg: reg});

                // peers
                Object.keys(user.peers).forEach(function (pid) { //pid: a single peer id
                    var peer = userCopy(users[pid]);
                    var isOnline = false;
                    Object.keys(clients).forEach(function (cid) {
                        if (clients[cid].user && clients[cid].user.id == pid) {
                            isOnline = true;
                            // generate "user" messages about me to peers
                            if (clients[cid].user.peers[usr.id]) {
                                usr.state = clients[cid].user.peers[usr.id].state; // doljno rabotat', no posmotrim dalee
                                clients[cid].send({type: "user", user: usr});
                            }

                        }
                    });
                    // generate "user" messages about peers to me
                    if (!isOnline) peer.status = "offline";
                    peer.state = user.peers[pid].state;
                    clients[id].send({type: "user", user: peer});


                });

                // о комнатах сообщать
                Object.keys(user.rooms).forEach(function (rid) { //rid: a single room id
                    console.log("user.rooms", user.rooms);
                    console.log("rooms[rid]", rooms[rid]);
                    clients[id].send({type:'room', action: 'create', room: rooms[rid]});
                });
                break;
            case "room":
                if (msg.action == "create") {
                    room = {
                        id: "r" + Date.now(),
                        name: msg.name,
                        admins: {},
                        peers: {}
                    };
                    room.admins[msg.admin.id] = msg.admin;
                    rooms[room.id] = room;
                    fs.writeFileSync("files/rooms.json", JSON.stringify(rooms, null, 4));

                    clients[id].user.rooms[room.id] = room;
                    fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                    Object.keys(room.admins).forEach(function (aid) {
                        Object.keys(clients).forEach(function (cid) {
                            if (clients[cid].user && clients[cid].user.id == aid) {
                                // generate "room" messages about room to admins
                                clients[cid].send({type:'room', action: 'create', room: room});
                            }
                        });
                    });

                } else
                if (msg.action == "delete") { // msg.item = room
                    delete rooms[msg.item.id];
                    fs.writeFileSync("files/rooms.json", JSON.stringify(rooms, null, 4));
                    delete users[[clients[id].user.id]].rooms[msg.item.id];
                    fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                    // как-то надо обновить, рефрешнуть список!!

                    // или это (1)

                    // var room = msg.item;
                    // Object.keys(room.admins).forEach(function (aid) {
                    //     Object.keys(clients).forEach(function (cid) {
                    //         if (clients[cid].user && clients[cid].user.id == aid) {
                    //             // generate "room" messages about room to admins
                    //             clients[cid].send({type:'room', action: 'delete', room: room});
                    //         }
                    //     });
                    // });


                    // или это (2)

                    Object.keys(clients[id].user.rooms).forEach(function (rid) { //rid: a single room id
                        clients[id].send({type:'room', action: 'create', room: rooms[rid]});
                    });

                } else
                if (msg.action == "cancel") {

                }
                break;
            case "user":
                if (msg.action == "status") {
                    user = users[msg.user.id];
                    if (msg.user.name) user.name = msg.user.name;
                    if (msg.user.pass) user.pass = msg.user.pass;
                    if (msg.user.myFName) user.myFName = msg.user.myFName;
                    if (msg.user.myLName) user.myLName = msg.user.myLName;
                    if (msg.user.myPhone) user.myPhone = msg.user.myPhone;
                    if (msg.user.myEMail) user.myEMail = msg.user.myEMail;
                    if (msg.user.myFB) user.myFB = msg.user.myFB;
                    //if (msg.user.peers) user.peers = msg.user.peers;
                    //if (msg.user.rooms) user.rooms = msg.user.rooms;
                    // if (msg.user.state) delete user.state; - надо ли? а после записи обратно присвоить state?

                    console.log ("user:", user);

                    console.log ("users:", users);
                    fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));
                    usr = userCopy(user);
                    console.log ("user.peers:", user.peers);
                    Object.keys(user.peers).forEach(function (pid) {
                        Object.keys(clients).forEach(function (cid) {
                            if (clients[cid].user && clients[cid].user.id == pid) {
                                // generate "user" messages about me to peers
                                clients[cid].send({type: "user", user: usr});
                            }
                        });
                    });
                } else

                if (msg.action == "invite") { // здесь потом одинаковые части кода вынесу за if'ы
                    if (!clients[id].user.peers[msg.item.id]) {

                        clients[id].user.peers[msg.item.id] = {"state": "invite"};
                        // clients[id].user.peers[msg.item.id].state = "invite";
                        msg.item.state = "invite";
                        users[msg.item.id].peers[clients[id].user.id] = {"state": "verify"};
                        // users[msg.item.id].peers[clients[id].user.id].state = "verify";
                        clients[id].user.state = "verify";
                        fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                        clients[id].send({type: "user", user: msg.item});
                        uid = msg.item.id;
                        Object.keys(clients).forEach(function (cid) {
                            if (clients[cid].user && clients[cid].user.id == uid) {
                                me = userCopy(clients[id].user);
                                clients[cid].send({type: "user", user: me});
                            }
                        });
                    } else
                    if (clients[id].user.peers[msg.item.id] && msg.item.state == "reject") {
                        clients[id].user.peers[msg.item.id].state = "invite";
                        msg.item.state = "invite";
                        users[msg.item.id].peers[clients[id].user.id] = {"state": "verify"};
                        // users[msg.item.id].peers[clients[id].user.id].state = "verify";
                        clients[id].user.state = "verify";
                        fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                        clients[id].send({type: "user", user: msg.item});
                        uid = msg.item.id;
                        Object.keys(clients).forEach(function (cid) {
                            if (clients[cid].user && clients[cid].user.id == uid) {
                                me = userCopy(clients[id].user);
                                clients[cid].send({type: "user", user: me});
                            }
                        });

                    }


                } else
                if (msg.action == "accept") {

                    // 6а) в поле "state" юзера вместо verify у меня и invite у него - в файле JSON значение меняется на friend/accept
                    clients[id].user.peers[msg.item.id].state = "peer";
                    msg.item.state = "peer";
                    users[msg.item.id].peers[clients[id].user.id].state = "peer"; //???
                    clients[id].user.state = "peer";
                    fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                    // 6б) отправляем сообщение мне и юзеру (type "user") с информацией друг о друге
                    clients[id].send({type: "user", user: msg.item});
                    clients[id].send({type: "sync", chatId: msg.item.id});
                    uid = msg.item.id;
                    Object.keys(clients).forEach(function (cid) {
                        if (clients[cid].user && clients[cid].user.id == uid) {
                            me = userCopy(clients[id].user);
                            clients[cid].send({type: "user", user: me});
                        }
                    });

                } else

                if (msg.action == "reject") {
                    if (msg.item.state == "invite" || msg.item.state == "reject") {
                        delete clients[id].user.peers[msg.item.id];
                        delete users[msg.item.id].peers[clients[id].user.id];

                        // счас подумаю надо ли делать следующие 2 строчки // наверное надо удалить это:
                        msg.item.state = "delete";
                        clients[id].user.state = "delete";

                    } else

                    if (msg.item.state == "verify" || msg.item.state == "peer") { // сработало только для кликающего реджект, который принял приглашение
                        // clients[id].user.peers[msg.item.id].state = "reject";
                        // msg.item.state = "reject";
                        // delete users[msg.item.id].peers[clients[id].user.id];
                        // clients[id].user.state = "delete";

                        delete clients[id].user.peers[msg.item.id];
                        msg.item.state = "delete"; // наверное надо удалить это
                        users[msg.item.id].peers[clients[id].user.id].state = "reject";
                        clients[id].user.state = "reject";


                    } else {
                        console.error("msg.item.state should be verify or invite");
                        break;
                    }
                    fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                    // 6б) отправляем сообщение мне и юзеру (type "user") с информацией друг о друге
                    clients[id].send({type: "user", user: msg.item});
                    uid = msg.item.id;
                    Object.keys(clients).forEach(function (cid) {
                        if (clients[cid].user && clients[cid].user.id == uid) {
                            me = userCopy(clients[id].user);
                            clients[cid].send({type: "user", user: me});
                        }
                    });
                } else
                if (msg.action == "cancel") {
                    delete clients[id].user.peers[msg.item.id];
                    delete users[msg.item.id].peers[clients[id].user.id];
                    msg.item.state = "delete";
                    clients[id].user.state = "delete";

                    fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));

                    // 6б) отправляем сообщение мне и юзеру (type "user") с информацией друг о друге
                    clients[id].send({type: "user", user: msg.item});
                    uid = msg.item.id;
                    Object.keys(clients).forEach(function (cid) {
                        if (clients[cid].user && clients[cid].user.id == uid) {
                            me = userCopy(clients[id].user);
                            clients[cid].send({type: "user", user: me});
                        }
                    });

                }
                else
                console.warn ("something is wrong");
                break;
            case "text":
                var room = null, roomId = null;
                msg.ts = Date.now(); // add ts to original msg
                msg.id = "m" + msg.ts; // add id to original msg

                if (msg.chatId[0] == 'u') {
                    roomId = roomIdCreate (msg.chatId, msg.userId); // create room id
                    room = rooms[roomId]; // lookup room by room Id
                    if (!room) { // if not exists, we will create one
                        room = {id: roomId};
                        rooms[roomId] = room;

                        var temp = roomsCopy(rooms);
                        fs.writeFileSync("files/rooms.json", JSON.stringify(temp, null, 4));
                        room.messages = {};
                    }

                    room.messages[msg.id] = msgCopy(msg); //add msg copy to to messages
                    fs.writeFileSync("files/messages-" + roomId + ".json", JSON.stringify(room.messages, null, 4)); //save all messages

                    //send modified message to me
                    clients[id].send(msg);

                    var uid = msg.chatId;
                    msg.chatId = msg.userId; //replace chatId in the message
                    //send message to all "uid" connected/clients
                    Object.keys(clients).forEach(function (cid) {
                        if (clients[cid].user && clients[cid].user.id == uid) {
                            clients[cid].send(msg);
                        }
                    });

                } else
                if (msg.chatId[0] == 'r') {
                    roomId = msg.chatId; // lookup room by room Id
                    room = rooms[roomId];
                    if (!room) { // if not exists, we will create one
                        room = {id: roomId};
                        rooms[roomId] = room;

                        var temp = roomsCopy(rooms);
                        fs.writeFileSync("files/rooms.json", JSON.stringify(temp, null, 4));
                        room.messages = {};
                    }

                    room.messages[msg.id] = msgCopy(msg); //add msg copy to messages
                    fs.writeFileSync("files/messages-" + roomId + ".json", JSON.stringify(room.messages, null, 4)); //save all messages
                    Object.keys(room.users).forEach(function (uid){ //for all user ids in the room, even for myself...
                        //... send message to  all its connection/clients
                        Object.keys(clients).forEach(function (cid) {
                            if (clients[cid].user && clients[cid].user.id == uid) {
                                clients[cid].send(msg);
                            }
                        });
                    });
                } else {
                    console.warn("invalid recipient, must be U or R");
                }
                break;
            case "ping":
                clients[id].send({type: 'pong'});
                break;
            case "sync":
                if (msg.chatId[0] == "u") {

                    var roomId = roomIdCreate (msg.userId, msg.chatId);
                    if (rooms[roomId]) {
                        var messages = rooms[roomId].messages;
                        Object.keys(messages).forEach(function (mid) {
                            var msgSend = {
                                type: "text",
                                userId: messages[mid].userId,
                                chatId: msg.chatId,    // счас подумаю
                                text: messages[mid].text,
                                ts: messages[mid].ts,
                                id: messages[mid].id
                            };
                            clients[id].send(msgSend);

                        });
                    } else {
                        // eto ok esli netu esche rooma v spiske, znachit netu tam nichego i messages toje
                        //console.log("-------------------no room?", roomId);
                    }
                    clients[id].send({type: "sync", chatId: msg.chatId});
                } else
                if (chatId[0] == "r") {

                } else
                console.warn ("something is wrong");
                break;
            case "find":
                var me = clients[id].user;
                var list = [];
                Object.keys(users).forEach(function (uid) {
                    if (uid == me.id) return;// we don't need to reply ourselves
                    if (me.peers[uid]) return; // we don't need to reply peers, да я сообразил)
                    var user = users[uid];
                    if (user.name.toLowerCase().indexOf(msg.text) >= 0) {
                        var usr = userCopy(user);
                        usr.status = "unknown";
                        list.push(usr);
                    }
                });
                clients[id].send({type: "find", list: list});
                break;
            default:
                console.error("unknown message type");
        }
    });

    conn.on('close', function(reasonCode, description) {
        console.log("close:", id, reasonCode, description);

        var user = clients[id].user;
        if (!user) return;

        delete clients[id];

        var usr = userCopy(user);
        usr.status = "offline";

        Object.keys(user.peers).forEach(function (pid) {
            Object.keys(clients).forEach(function (cid) {
                if (clients[cid].user && clients[cid].user.id == pid) {
                    clients[cid].send({type:"user", user: usr});
                }
            });
        });
    });
});

// ================================ кусок кода тут ==================================




// ================================ = = = = = = =  ==================================


function msgCopy(src) {
    var res = JSON.parse(JSON.stringify(src));
    delete res.type;
    delete res.chatId;
    return res;
}

function roomsCopy(src) {
    var res = {};
    Object.keys(src).forEach(function (rid) {
        var tmp = src[rid];
        res[rid] = {id: tmp.id, name:tmp.name};
    });
    return res;
}

function userCopy(src) {
    var res = JSON.parse(JSON.stringify(src));
    delete res.pass;
    delete res.peers;
    delete res.rooms;
    return res;
}

function userJoin (name, pass1, pass2) {
    var user = null;
    Object.keys(users).forEach(function (uid) { //uid: a single user id
        if (name == users[uid].name && pass1 == users[uid].pass) {
            user = users[uid];
        }
    });
    if (!user && pass2) {
        user = {
            id: "u" + Date.now(),
            name: name,
            pass: pass2,
            status: "online",
            peers: {},
            rooms: {},
            reg: true
        };
        users[user.id] = user;
        fs.writeFileSync("files/users.json", JSON.stringify(users, null, 4));
    }
    return user;
}

function roomIdCreate(p1, p2) { // ниже пока не удаляй, я потом еще раз просмотрю как следует чтоб запомнить
    // var roomId = null;
    // var ItemNumber = p1.substr(1);
    // var userNumber = p2.substr(1);
    // //console.log("ItemNumber:", ItemNumber);
    // //console.log("userNumber:", userNumber);
    // if (ItemNumber < userNumber) {
    //     roomId = "r" + ItemNumber + "-" + userNumber;
    // }
    // else {
    //     roomId = "r" + userNumber + "-" + ItemNumber;
    // }
    // console.log("roomId:", roomId);
    // return roomId;

    // can be simple as this:
    return 'r' + (p1 < p2 ? p1.substr(1) + "-" + p2.substr(1) : p2.substr(1) + "-" + p1.substr(1));
}
