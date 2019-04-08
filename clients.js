"use strict";

var fs = require('fs');
var url = require('url');
var http = require('http');
var crypto = require('crypto');
var assert = require('assert');
var WebSocketClient = require('websocket').client;

var name = "u"; //prefix
if (process.argv[2]) {
    name += padLeft('0',5, process.argv[2]);
    new Client("localhost:8080", name, name);
} else {
    var cs = new Array(3).fill(null).map(function (v, i) {
        return new Client("localhost:8080", name + padLeft('0',5,i), name + padLeft('0',5,i));
    });
    console.log(cs);
}

// possible status values
var status = ["online", "away", "offline"];

function Client(server, uname, passw) {
    var con = null, src = 0, me = {}, peers = {}, rooms = {};

    setInterval(action, 100);

    var ws = new WebSocketClient();
    ws.on('connect', function (c) {
        con = c; src = 0; me = {}; peers = {}; rooms = {};
        console.log(uname, "connect");
        c.on('error', function(error) {
            console.log(uname, "error", error.toString());
        });
        c.on('close', function(code, desc) {
            con = null; src = 0; me = {}; peers = {};
            console.log(uname, "close", code, desc);
            setTimeout(function() { ws.connect('ws://' + server, 'mylovelyproto'); }, 5000);
        });
        c.on('message', function(raw) {
            console.log(uname, "recv", raw.utf8Data);
            recv(JSON.parse(raw.utf8Data));
        });
        // once in a while simulate disconnect
        setTimeout(function () { if (!!con) con.close(1000, "timeout"); }, 30000 + rand(30000));
    });

    ws.on('connectFailed', function(error) {
        console.log(uname, "connect", error.code);
        ws.connect('ws://' + server, 'mylovelyproto');
    });

    setTimeout(function () { ws.connect('ws://' + server, 'mylovelyproto'); }, rand(3000));

    function send(msg) {
        if (!con) return;
        var s = JSON.stringify(msg);
        console.log(uname, "send", s);
        con.sendUTF(s);
    }

    function recv(msg) {
        switch (msg.type) {
            case "ping": {
            } break;
            case "join": {
                assert.ok(msg.user, "missing user");
                me.user = msg.user;
                me.timeout = Date.now() + 3000;
                (msg.peers || []).forEach(function (peer) {
                    peers[peer.id] = {};
                    peers[peer.id].user = peer;
                    peers[peer.id].timeout = Date.now() + rand(10000);
                });
                (msg.rooms || []).forEach(function (room) {
                    rooms[room.id] = {};
                    rooms[room.id].room = room;
                });
            } break;
            case "find": {
                assert.ok(me.user, "no me");
                assert.ok(Array.isArray(msg.list), "no list");
                msg.list.forEach(function(item) {
                    assert.ok(item.id !== me.user.id, "contains me");
                    //assert.ok(peers[item.id], "contains peer"); //actually this i a valid situation
                });
                if (msg.list.length) { // if list has at least one user (length >0), send invite to random one
                    var item = msg.list[rand(msg.list.length)];
                    send({type:"user", action:"invite", user: item});
                }
                me.timeout = Date.now() + 3000;
            } break;
            case "user": {
                assert.ok(me.user, "no me");
                assert.ok(msg.user, "no user");
                if (msg.user.id === me.user.id) {
                    me.user = msg.user;
                    me.timeout = Date.now() + 3000;
                } else
                switch (msg.user.state) {
                    case "invite": // I've invited other user and waiting for accept/reject
                    case "verify": // other user invited me and waiting for accept/reject
                    case "accept": // someone accept me
                    case "reject": // other user rejected my invitation
                        peers[msg.user.id] = {};
                        peers[msg.user.id].user = msg.user;
                        peers[msg.user.id].timeout = Date.now() + rand(10000);
                    break;
                    case "delete": // delete user from the peers
                        delete peers[msg.user.id];
                    break;
                    default: assert.ok(false, "wrong state");
                }
            } break;
            case "chat": {
                assert.ok(me.user, "no me");
                assert.ok(msg.user, "no user");
                if (msg.user.id !== me.user.id) {
                    assert.ok(peers[msg.user.id], "no peer");
                    peers[msg.user.id].timeout = Date.now() + rand(10000);
                }
            } break;
            case "room": {
                // assert.ok(me.user, "no me");
                // assert.ok(msg.user, "no user");
                // if (msg.user.id !== me.user.id) {
                //     assert.ok(peers[msg.user.id], "no peer");
                //     peers[msg.user.id].timeout = Date.now() + rand(10000);
                // }
                if (me.id == msg.creator) {
                // ???? а что тут-то писать? по сути ничего
                } else
                if (msg.roommates.indexOf(me.id) != -1) {

                } else
                if (msg.admins.indexOf(me.id) != -1) {

                } else
                if (msg.invited.indexOf(me.id) != -1) {

                } else
                if (msg.canceled.indexOf(me.id) != -1) {

                }
            } break;
            case "sync": {
                assert.ok(me.user, "no me");
                assert.ok(msg.user, "no user");
            } break;
            default: assert.ok(false, "wrong message");
        }
    }
    
    function action () {
        if (!con) return;
        if (!me.user) {
            send({type:"join", uname: uname, pass1: passw, pass2: passw});
        } else {
            var now = Date.now();
            if (me.timeout && me.timeout < now) { // lets do something about me
                var timeout = me.timeout;
                delete me.timeout;
                if ((timeout % 2) === 0) {
                    send({type:"find", text:"u"});
                } else {
                    //let's change me
                    send({
                        type: "user",
                        user: {
                            id: me.user.id,
                            uname: me.user.uname,
                            status: status[(status.indexOf(me.user.status) + 1) % status.length] // set next status
                        },
                        action: "update"
                    });
                }
            } else {
                // let's do something about peers
                Object.keys(peers).forEach( function(id) {
                    var peer = peers[id];
                    if (peer.timeout && peer.timeout < now) {
                        var timeout = peer.timeout;
                        delete peer.timeout;
                        switch (peer.user.state) {
                            case "invite": send({type:"user", user: peer.user, action: "cancel"                           }); break; // still invite? ok, cancel it.
                            case "verify": send({type:"user", user: peer.user, action: (timeout % 2) ? "reject" : "accept"}); break; // random accept or reject
                            case "reject": send({type:"user", user: peer.user, action: (timeout % 2) ? "invite" : "cancel"}); break; // random invite or cancel
                            case "accept": {
                                if ((timeout % 10) === 0) { // let's cancel a peer
                                    send({type: "user", user: peer.user, action: "cancel"});
                                } else { // let's chat :)
                                    send({
                                        type: "chat",
                                        chat: {
                                            id: peer.user.id,
                                            text: me.user.id + "" + peer.user.id
                                        }
                                    });

                                    // let's chat in multiroom
                                    // send({
                                    //     type: "chat",
                                    //     action: "create",
                                    //     roomName: me.id,
                                    //     chat: {
                                    //         id: "r" + me.id
                                    //     }
                                    // });
                                }
                            } break;
                            default: assert.ok(false, "ops, wrong state!");
                        }
                    }
                });


                // зачем синкать если отправить только когда джоин (на сервере). Object keys румс надо параллельно пирам.
                // 1/10 создаем комнату
                // 9/10 бегаем по комнате
                // if (rooms != 0) неправильно. Обжект.кейс.румсов.ленгс = 0
                // первым делом как только джоин выгребать сразу не только список пиров, но и список румов (даже если пустой)

                // как вообще начинать делать проекты
                // 1. определить объекты (комнаты, пиры, комнаты общие)



                // let's do something about rooms

                // 1 СОЗДАЕМ КОМНАТУ (1/10)
                if ((randInt (1, 1000) % 10) == 0) {
                    send({
                        type: "room",
                        action: "create",
                        creator: me.user.id,
                        roomName: rand(9999999),
                        roomType: "public"
                    });
                } else {
                    // 2 ДЕЙСТВИЯ С СУЩЕСТВУЮЩИМИ КОМНАТАМИ (9/10) - эти действия почему-то не происходят, смотрю не понимаю
                    Object.keys(rooms).forEach( function(id) {
                        var room = rooms[id];
                        // 2.1 уйти/отказаться (1/20)
                        if ((randInt (1, 1000) % 20) == 0) {
                            send({
                                type: 'room',
                                action: 'cancel',
                                uid: me.id,
                                rid: room.id
                            });
                        }
                        // 2.2 ДРУГИЕ ДЕЙСТВИЯ (19/20)
                        else {
                            // 2.2.1 ЕСЛИ Я ПРИГЛАШЕН
                            if (room.invited.indexOf(me.id) != -1) {
                                // 2.2.1.1 принимаем (1/1)
                                send({
                                    type: 'room',
                                    action: 'accept',
                                    rid: room.id
                                });
                            } else
                            // 2.2.2. ЕСЛИ Я В КОМНАТЕ (ЕСЛИ Я АДМИН || СОЗДАТЕЛЬ || ЮЗЕР)
                            if (room.admins.indexOf(me.id) != -1 || room.roommates.indexOf(me.id) != -1 || room.creator.indexOf(me.id) != -1) {
                                // 2.2.2.1 приглашаем (1/10)
                                if ((randInt (1, 1000) % 10) == 0) {
                                    var randomUser = Math.floor(Math.random() * me.peers.length);
                                    send({
                                        type: 'room',
                                        action: 'invite',
                                        invited: [randomUser.id],
                                        rid: room.id
                                    });
                                }
                                // 2.2.2.2 пишем (9/10)
                                else {
                                    send({
                                        type: "chat",
                                        chat: {
                                            id: room.id,
                                            text: "i am admin " + me.user.id + "" + room.id
                                        }
                                    });
                                }
                                // 2.2.2.3. ЕСЛИ Я НЕ ЮЗЕР (ЕСЛИ Я АДМИН || СОЗДАТЕЛЬ)
                                if (room.admins.indexOf(me.id) != -1 || room.creator.indexOf(me.id) != -1) {
                                    // 2.2.2.3.1 выгоняем юзера (1/10)
                                    if ((randInt (1, 1000) % 10) == 0) {
                                        var randomPeer = Math.floor(Math.random() * room.roommates.length);
                                        send({
                                            type: 'room',
                                            action: 'cancel',
                                            uid: randomPeer.id,
                                            rid: room.id
                                        });
                                    }
                                    // 2.2.2.3.2 ЕСЛИ Я СОЗДАТЕЛЬ
                                    if (room.creator.indexOf(me.id) != -1) {
                                        // 2.2.2.3.2.1 делаем юзера админом (1/10)
                                        if ((randInt (1, 1000) % 10) == 1) {
                                            var randomPeer = Math.floor(Math.random() * room.roommates.length);
                                            send({
                                                type: 'room',
                                                action: 'toAdmin',
                                                admins: [randomPeer.id],
                                                rid: room.id
                                            });
                                        } else
                                        // 2.2.2.3.2.2 делаем админа юзером (1/10)
                                        if ((randInt (1, 1000) % 10) == 2) {
                                            var randomAdmin = Math.floor(Math.random() * room.admins.length);
                                            send({
                                                type: 'room',
                                                action: 'deAdmin',
                                                roommates: [randomAdmin.id],
                                                rid: room.id
                                            });
                                        } else
                                        // 2.2.2.3.2.3 выгоняем admina (1/10)
                                        if ((randInt (1, 1000) % 10) == 3) {
                                            var randomAdmin = Math.floor(Math.random() * room.admins.length);
                                            send({
                                                type: 'room',
                                                action: 'cancel',
                                                uid: randomAdmin.id,
                                                rid: room.id
                                            });
                                        }
                                    }
                                }
                            }
                        }

                    });
                }

                // Object.keys(rooms).forEach( function(id) {
                //     var room = rooms[id];
                //     var time = Date.now() + rand(5000);
                //
                //     // если комнаты нет
                //     if (rooms != 0) { // if (rooms != 0) неправильно. Обжект.кейс.румсов.ленгс = 0
                //         // в 1/5 случаев создаем
                //         if ((time % 5) == 0) {
                //             send({
                //                 type: "room",
                //                 action: "create",
                //                 creator: me.user.id,
                //                 roomname: rand(9999999)
                //             });
                //             // в 4/5 случае ничего не делаем
                //         } else {console.log ("4/5 cases we don't create room")}
                //         // если комната есть
                //     } else {
                //         // если я в комнате админ
                //         if (room.admins.indexOf(me.id) != -1) {
                //             // если я админ и есть пиры
                //             if (room.roommates) {
                //                 // в 1/6 приглашаем
                //                 if ((time % 6) == 0) {
                //                     var randomUser = Math.floor(Math.random() * me.peers.length);
                //                     send({
                //                         type: 'room',
                //                         action: 'invite',
                //                         invited: [randomUser.id],
                //                         rid: room.id
                //                     });
                //                 } else
                //                 // в 1/6 выгоняем
                //                 if ((time % 6) == 1) {
                //                     var randomPeer = Math.floor(Math.random() * room.roommates.length);
                //                     send({
                //                         type: 'room',
                //                         action: 'cancel',
                //                         uid: randomPeer.id,
                //                         rid: room.id
                //                     });
                //                 }
                //                 // в 4/6 пишем
                //                 else {
                //                     send({
                //                         type: "chat",
                //                         chat: {
                //                             id: room.id,
                //                             text: "i am admin " + me.user.id + "" + room.id
                //                         }
                //                     });
                //                 }
                //             }
                //             // если я админ и нет пиров - приглашаем
                //             else {
                //                 var randomUser = Math.floor(Math.random() * me.peers.length);
                //                 send({
                //                     type: 'room',
                //                     action: 'invite',
                //                     invited: [randomUser.id],
                //                     rid: room.id
                //                 });
                //             }
                //
                //         } else
                //
                //         // если я в комнате пир
                //         if (room.roommates.indexOf(me.id) != -1) {
                //             // в 1/6 приглашаем
                //             if ((time % 6) == 0) {
                //                 var randomUser = Math.floor(Math.random() * me.peers.length);
                //                 send({
                //                     type: 'room',
                //                     action: 'invite',
                //                     invited: [randomUser.id],
                //                     rid: room.id
                //                 });
                //             } else
                //             // в 1/6 уходим
                //             if ((time % 6) == 1) {
                //                 send({
                //                     type: 'room',
                //                     action: 'cancel',
                //                     uid: me.id,
                //                     rid: room.id
                //                 });
                //             }
                //             // в 4/6 пишем
                //             else {
                //                 send({
                //                     type: "chat",
                //                     chat: {
                //                         id: room.id,
                //                         text: "i am peer " + me.user.id + "" + room.id
                //                     }
                //                 });
                //             }
                //         } else
                //         // если меня пригласили
                //         if (room.invited.indexOf(me.id) != -1) {
                //             // отказываем в 1/3
                //             if ((time % 3) == 0) {
                //                 send({
                //                     type: 'room',
                //                     action: 'cancel',
                //                     uid: me.id,
                //                     rid: room.id
                //                 });
                //             }
                //             // в 2/3 принимаем
                //             else {
                //                 send({
                //                     type: 'room',
                //                     action: 'accept',
                //                     rid: room.id
                //                 });
                //             }
                //         }
                //
                //
                //     }
                // });


            }
        }
    }

}

function padLeft(c, n, s) {
    return (new Array(n).join(c) + s).slice(-n);
}

function rand(max) {
  return Math.floor(Math.random() * max);
}

function randInt(min,max) {
    return (Math.random() * (max - min + 1) ) << 0
}

function copy(o) {
    return JSON.parse(JSON.stringify(o));
}
function skip(o, arr) {
    var e = copy(o);
    arr.forEach(function (k) { delete e[k]; });
    return e;
}
function grep(o, arr) {
    var e = {};
    arr.forEach(function (k) { e[k] = o[k]; });
    return e;
}



