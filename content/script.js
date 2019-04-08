'use strict';

// === GLOBAL VARIABLES ================================================================================================

var divLogReg = document.getElementById('divLogReg');
var txtLoginName = document.getElementById('txtLoginName');
var txtPassword1 = document.getElementById('txtPassword1');
var txtPassword2 = document.getElementById('txtPassword2');
var btnLogin = document.getElementById('btnLogin');
var btnRegister = document.getElementById('btnRegister');

var divMain = document.getElementById('divMain');
var divList = document.getElementById('divList');
var btnLogout = document.getElementById('btnLogout');
var btnMyInfo = document.getElementById('btnMyInfo');
var divMyInfo = document.getElementById('divMyInfo');

var divMyUName = document.getElementById('divMyUName');
var divMyFName = document.getElementById('divMyFName');
var divMyLName = document.getElementById('divMyLName');
var divMyPhone = document.getElementById('divMyPhone');
var divMyEMail = document.getElementById('divMyEMail');
var divMyFB = document.getElementById('divMyFB');
var btnConfirm = document.getElementById('btnConfirm');
var btnCancel = document.getElementById('btnCancel');

var txtName = document.getElementById('txtName');
var optStatus = document.getElementById('selectStatus');
var txtURSearch = document.getElementById('txtURSearch');
var btnAddRoom = document.getElementById('btnAddRoom');
var txtRoomName = document.getElementById('txtRoomName');
var btnRCreate = document.getElementById('btnRCreate');
var btnRCancel = document.getElementById('btnRCancel');
var divSearchList = document.getElementById('divSearchList');
// var btnSearch = document.getElementById('btnSearch');
var divChats = document.getElementById('divChats');

var sketch = false; // true for test, false for work
if (sketch) {
    divMain.classList.add("active");
} else {
 divList.innerHTML = "";
 divSearchList.innerHTML="";
 // divChats.innerHTML = "";
}

var me = {};
// var chats = { // one item is a room
//     "id1": { // room id
//         divItem: {}, // pointer to div in the list,
//         divChat: {}  // pointer to chat div with text/input and send
//     },
//     //...
//     "idN": { // or user id
//         divItem: {}, // pointer to div in the list,
//         divChat: {}  // pointer to chat div with text/input and send
//     }
// };
var chats = {};
var searchs = {};
// === WS ==============================================================================================================

var pong;

var ws = new WebSocket(location.origin.replace("http", "ws"), 'mylovelyproto');

function ws_send(msg) {
    var str = JSON.stringify(msg);
    ws.send(str);
    console.log('sent:', str);
}
ws.onopen = function (){
    if (location.hostname != "localhost") { //do not use ping/pong in localhost
        var ping = setInterval(function () {
            pong = setTimeout(function () {
                clearInterval(ping);
                window.location = window.location;
            }, 6000);
            ws_send({type: 'ping'});
        }, 5000);
    }
};
ws.onmessage = function (e) {
    console.log('recv:', e.data);
    var msg = JSON.parse(e.data);
    switch(msg.type) {
        case 'join':
            // console.log('1msg.user:', msg.user);
            if (msg.user) {
                me = msg.user;
                divLogReg.style.display = "none";
                divMain.classList.add("active");
                personalData(me);
                if (msg.reg) // just register
                    divMyInfo.classList.add("active");
                else
                    divChats.classList.add("active");
                changeMe(me);
            } else {
                alert("No user found!");
            }
            break;
        case 'text': // ============================ правим код тут: ==========================================
            writeText(msg.chatId, msg.userId, msg.text);
            break;
        case 'sync':
            chats[msg.chatId].sync = true;
            break;
        case 'user':
            //if (msg.user.state == "peer" || "invite" || "verify" || "reject") {setChat(msg.user);}
            // na samom delete nujno tak
            // if (msg.user.state == "peer"  || msg.user.state == "invite" || ...
            // a mojno tak:
            if (["peer","invite","verify","reject"].indexOf(msg.user.state) >= 0) {setChat(msg.user);}
            else if (msg.user.state == "delete") {setDelete(msg.user);}
            else {console.warn("unexpected user state:", msg.user.state);}
            break;
        case 'room':
            if (msg.action = 'create') {setRoom(msg.room);}
            else {console.warn("unexpected msg.action:", msg.action);}
            break;
        case 'find':
            setSearchList (msg.list);
            break;
        case 'pong':
            clearTimeout(pong);
            break;
        default:
            console.error('unexpected message!!!', msg);
    }
};
ws.onclose = function () {
};
ws.onerror = function (err, p) {
    console.log(err, p);
};

// === LOGIN PAGE ======================================================================================================

txtLoginName.onkeydown = function (event) {
    if (event.keyCode == 13) {
        txtPassword1.focus();
        return false;
    }
};
txtPassword1.onkeydown = function (event) {
    if (event.keyCode == 13) {
        login();
        return false;
    }
};
txtPassword2.onkeydown = function (event) {
    if (event.keyCode == 13) {
        register();
        return false;
    }
};
btnLogin.onclick = login;
btnRegister.onclick = register;

function login () {
    var uname = txtLoginName.value.trim(); //trim = value минус все крайние пробелы
    if (!uname) return alert("Login name must be defined!");
    if (uname.length < 3) return alert("Login name must be at least 3 symbols!");
    var pass1 = txtPassword1.value;
    if (!pass1) return alert("Password must be defined!");
    if (pass1.length < 3) return alert("Password must be at least 3 symbols!");
    ws_send ({
        type: "join",
        uname: uname,
        pass1: pass1
    })
}
function register () {
    var uname = txtLoginName.value.trim(); //trim = value минус все крайние пробелы
    if (!uname) return alert("Login name must be defined!");
    if (uname.length < 3) return alert("Login name must be at least 3 symbols!");
    var pass1 = txtPassword1.value;
    if (!pass1) return alert("Password must be defined!");
    if (pass1.length < 3) return alert("Password must be at least 3 symbols!");
    var pass2 = txtPassword2.value;
    if (!pass2) return alert("Password must be defined!");
    if (pass2.length < 3) return alert("Password must be at least 3 symbols!");
    if (pass1.value != pass2.value) return alert("Passwords are not the same!");
    ws_send ({
        type: "join",
        uname: uname,
        pass1: pass1,
        pass2: pass2
    });
}

// === MAIN PAGE =======================================================================================================

var divChatActive = null;

btnLogout.onclick = function () {
    window.location = window.location;
};
btnMyInfo.onclick = function () {
    divChats.classList.toggle("active");
    divMyInfo.classList.toggle("active");
};
function personalData(me) {
    console.log("personalData activated");
    divMyUName.value = me.name;
    if (me.myFName) {divMyFName.value = me.myFName;}
    if (me.myLName) {divMyLName.value = me.myLName;}
    if (me.myPhone) {divMyPhone.value = me.myPhone;}
    if (me.myEMail) {divMyEMail.value = me.myEMail;}
    if (me.myFB) {divMyFB.value = me.myFB;}
}

btnConfirm.onclick = function () {
    console.log("confirm activated");
    console.log("confirm me", me);
    me.myFName = divMyFName.value;
    me.myLName = divMyLName.value;
    me.myPhone = divMyPhone.value;
    me.myEMail = divMyEMail.value;
    me.myFB = divMyFB.value;
    ws_send({type: 'user', user: me, action: 'status'});
    personalData(me);
};
btnCancel.onclick = function () {
    console.log("cancel activated");
    console.log("cancel me", me);
    personalData(me);
};

txtName.onkeydown = function (event) {
    if (event.keyCode == 13) {
        me.name = txtName.value;
        var msg = {
            type: 'user',
            user: me
        };
        ws_send(msg);
        changeUserName(msg.user);
        return false;
    }
};
optStatus.onchange = function () {
    console.log("optStatus.value: ", optStatus.value);
    me.status = optStatus.value;
    var msg = {
        type: 'user',
        user: me,
        action: 'status'
    };
    console.log("msg(optStatus): ", msg);
    ws_send(msg);
    return false;
};
var searchTimeout;
txtURSearch.onkeyup = function () {
    //hide if name does not contain search text, show otherwise
    var txt = txtURSearch.value.toLowerCase().trim();
    Object.keys(chats).forEach(function (cid) {
        var chat = chats[cid];
        //console.log(chat.info);
        chat.divItem.style.display = (!!txt && chat.info.name.toLowerCase().indexOf(txt) < 0) ? "none" : "";
    });

    clearTimeout(searchTimeout);
    if (!!txt) {
        clearSearch();
        divSearchList.innerHTML = "searching...";
        searchTimeout = setTimeout(function () {
            ws_send({type: 'find', text: txt });
        }, 1500);
    } else {
        clearSearch();
    }

};
function sideActive () {
    btnAddRoom.classList.toggle("active");
    txtRoomName.classList.toggle("active");
    btnRCreate.classList.toggle("active");
    btnRCancel.classList.toggle("active");
    divList.classList.toggle("active");
    txtURSearch.classList.toggle("active");
}
btnAddRoom.onclick = function () {sideActive()};
btnRCancel.onclick = function () {
    txtRoomName.value = "";
    sideActive();
};
btnRCreate.onclick = function () {
    if (txtRoomName.value.trim() == "") return;
    ws_send({
        type: 'room',
        action: 'create',
        admin: me,
        name: txtRoomName.value
    });
    txtRoomName.value = "";
    sideActive();
};
function clearSearch() {
    Object.keys(searchs).forEach(function (id) {
        setDelete(searchs[id].info);
    });
    searchs = {};
    divSearchList.innerHTML = "";
}

function setSearchList (list) {

    clearSearch();
    list.forEach(function(info) {

        var item = {id: info.id, info: info};
        item.divChat = divChats.appendChild(document.createElement("div"));
        item.divChat.className = "divChat";
        item.divInfo = item.divChat.appendChild(document.createElement("div"));
        item.divInfo.className = "divInfo";
        item.divInfo.innerHTML = "Found " + info.name + ". Invite?";
        item.divText = item.divChat.appendChild(document.createElement("div"));
        item.divText.className = "divText";
        item.divInput = item.divChat.appendChild(document.createElement("div"));
        item.divInput.className = "divInput";
        // кнопки

        item.btnInvite = item.divInput.appendChild(document.createElement("button"));
        item.btnInvite.className = "btnInvite";
        item.btnInvite.type = "reset";
        item.btnInvite.innerHTML = "Invite";
        item.btnInvite.onclick = function () { ws_send({type: 'user', action: 'invite', item: info}); };

        item.divItem = divSearchList.appendChild(document.createElement("div"));
        item.divItem.onclick = function () {
            console.log("ты кликнул");
            chatActivate(searchs, info.id);
        };
        item.divItem.className = "divItem"; //eto poka user
        item.imgStatus = item.divItem.appendChild(document.createElement("img"));
        item.imgStatus.className = "imgStatus";
        item.imgStatus.src = "status-unknown.png";
        item.divName = item.divItem.appendChild(document.createElement("div"));
        item.divName.innerHTML = info.name;
        item.divName.className = "divName";
        item.imgAdd = item.divItem.appendChild(document.createElement("img"));
        item.imgAdd.className = "imgAdd";
        item.imgAdd.src = "status-add.png";
        item.imgAdd.onclick = function () {
            ws_send({type: "user", action: "invite", item: info});
        };
        searchs[info.id] = item;
    });
}

function changeMe(me) {
    optStatus.value = me.status;
    txtName.value = me.name;
}

function changeUserName(usr) {
    var spns = document.getElementsByClassName(usr.id);
    for (var i = 0; i < spns.length; i++) {
        var span = spns[i];
        span.innerHTML = usr.name;
    }
}
function setDelete(info) {
    var tmp1 = chats[info.id];
    if (tmp1 && tmp1.divItem) { tmp1.divItem.remove(); tmp1.divChat.remove(); delete chats[info.id]; }
    var tmp2 = searchs[info.id];
    if (tmp2 && tmp2.divItem) { tmp2.divItem.remove(); tmp2.divChat.remove(); delete searchs[info.id]; }
}

function setRoom (info) { // info = msg.room
    setDelete(info);
    var chat = chats[info.id];
    if (!chat) {  // does not exist, we will create it once
        chat = {id: info.id, info: info};
        // if (info.state == "invite" || info.state == "verify" || info.state == "reject") {chat = {id: info.id, info: info};}
        // else if (info.state == "peer") {chat = {id: info.id, info: info, sync: false};}
        // else {console.warn("unexpected user state:", info.state);}
        chat.divChat = divChats.appendChild(document.createElement("div"));
        chat.divChat.className = "divChat";
        chat.divInfo = chat.divChat.appendChild(document.createElement("div"));
        chat.divInfo.className = "divInfo";
        chat.divInfo.innerHTML = "You're in room: " + info.name;
        chat.btnInfo = chat.divInfo.appendChild(document.createElement("button"));
        chat.btnInfo.className = "btnInfo";
        chat.btnInfo.type = "reset";
        chat.btnInfo.innerHTML = "Info";

        chat.divRoom = chat.divChat.appendChild(document.createElement("div"));
        chat.divRoom.className = "divUser";
        chat.btnRemove = chat.divRoom.appendChild(document.createElement("button"));
        chat.btnRemove.className = "btnRemove";
        chat.btnRemove.type = "reset";
        chat.btnRemove.innerHTML = "Cancel the Room";
        chat.btnRemove.onclick = function () { ws_send({type: 'room', action: 'cancel', item: info}); };
        // console.log("me", me);
        // console.log("info.admins[me.id]", info.admins[me.id]);
        if (me.id == info.admins[me.id].id) {
            chat.btnDelRoom = chat.divRoom.appendChild(document.createElement("button"));
            chat.btnDelRoom.className = "btnRemove";
            chat.btnDelRoom.type = "reset";
            chat.btnDelRoom.innerHTML = "Delete the Room";
            chat.btnDelRoom.onclick = function () { ws_send({type: 'room', action: 'delete', item: info}); };
        } else {console.warn("me.id == info.admins[me.id].id", me.id == info.admins[me.id].id)}

        chat.btnAddRoommate = chat.divRoom.appendChild(document.createElement("button"));
        chat.btnAddRoommate.className = "btnRemove";
        chat.btnAddRoommate.type = "reset";
        chat.btnAddRoommate.innerHTML = "Add roommate";
        chat.btnAddRoommate.onclick = function () {
            //////////////////////////////////////////////////////////////////////////
            chat.divItem.id = info.id;
            chat.divItem.className = "divItem";
            chat.divItem.classList.add(info.status);
            chat.imgStatus = chat.divItem.appendChild(document.createElement("img"));
            chat.imgStatus.className = "imgStatus";
            chat.imgStatus.src = "status-" + info.status + ".png";
            chat.divName = chat.divItem.appendChild(document.createElement("div"));
            chat.divName.innerHTML = info.name;
            chat.divName.className = "divName";
            chat.divItemInfo = chat.divItem.appendChild(document.createElement("div"));
            chat.divItemInfo.className = "divInfo";
        //     switch (info.state) {
        //         case "peer":
        //             chat.divItemInfo.innerHTML = 1;
        //             break;
        //         case "invite":
        //             chat.imgReject = chat.divItem.appendChild(document.createElement("img"));
        //             chat.imgReject.className = "imgAdd";
        //             chat.imgReject.src = "status-reject.png";
        //             chat.imgReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };
        //             break;
        //         case "verify":
        //             chat.imgReject = chat.divItem.appendChild(document.createElement("img"));
        //             chat.imgReject.className = "imgAdd";
        //             chat.imgReject.src = "status-reject.png";
        //             chat.imgReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };
        //             chat.imgAccept = chat.divItem.appendChild(document.createElement("img"));
        //             chat.imgAccept.className = "imgAdd";
        //             chat.imgAccept.src = "status-accept.png";
        //             chat.imgAccept.onclick = function () { ws_send({type: 'user', action: 'accept', item: info}); };
        //             break;
        //         case "reject":
        //             chat.imgReject = chat.divItem.appendChild(document.createElement("img"));
        //             chat.imgReject.className = "imgAdd";
        //             chat.imgReject.src = "status-reject.png";
        //             chat.imgReject.onclick = function () { ws_send({type: 'user', action: 'cancel', item: info}); };
        //             chat.imgAccept = chat.divItem.appendChild(document.createElement("img"));
        //             chat.imgAccept.className = "imgAdd";
        //             chat.imgAccept.src = "status-add.png";
        //             chat.imgAccept.onclick = function () { ws_send({type: 'user', action: 'invite', item: info}); };
        //             break;
        //         default: console.warn("unexpected user state:", info.state);
        // };
        };

        //////////////////////////////////////////////////


        chat.br = chat.divRoom.appendChild(document.createElement("br"));
        chat.divRoomInfo = chat.divRoom.appendChild(document.createElement("table"));
        chat.divRoomInfo.className = "divUserInfo"; // надо будет поменять класс
        var table = chat.divRoomInfo;

        // // 1 строка
        // var row1 = table.insertRow(0);
        // var cell1_1 = row1.insertCell(0);
        // cell1_1.className ="label";
        // cell1_1.innerHTML ="User name";
        // var cell1_2 = row1.insertCell(1);
        // cell1_2.id = "divItemUName";
        // cell1_2.className ="text";
        // cell1_2.innerHTML = info.name;
        //
        // // 2 строка
        // var row2 = table.insertRow(1);
        // var cell2_1 = row2.insertCell(0);
        // cell2_1.className ="label";
        // cell2_1.innerHTML ="First Name";
        // var cell2_2 = row2.insertCell(1);
        // cell2_2.id = "divItemFName";
        // cell2_2.className ="text";
        // cell2_2.innerHTML = "test FirstName";
        //
        // // 3 строка
        // var row3 = table.insertRow(2);
        // var cell3_1 = row3.insertCell(0);
        // cell3_1.className ="label";
        // cell3_1.innerHTML ="Last Name";
        // var cell3_2 = row3.insertCell(1);
        // cell3_2.id = "divItemLName";
        // cell3_2.className ="text";
        // cell3_2.innerHTML = "test LastName";
        //
        // // 4 строка
        // var row4 = table.insertRow(3);
        // var cell4_1 = row4.insertCell(0);
        // cell4_1.className ="label";
        // cell4_1.innerHTML ="Phone number";
        // var cell4_2 = row4.insertCell(1);
        // cell4_2.id = "divItemPhone";
        // cell4_2.className ="link";
        // var a4 = cell4_2.appendChild(document.createElement("a"));
        // a4.href = "tel:1234567890";
        // // a4.target = "_blank";
        // a4.innerHTML = "test call 1234567890";
        //
        // // 5 строка
        // var row5 = table.insertRow(4);
        // var cell5_1 = row5.insertCell(0);
        // cell5_1.className ="label";
        // cell5_1.innerHTML ="E-mail";
        // var cell5_2 = row5.insertCell(1);
        // cell5_2.id = "divItemEMail";
        // cell5_2.className ="link";
        // var a5 = cell5_2.appendChild(document.createElement("a"));
        // a5.href = "mailto:abc@xyz.com";
        // a5.target = "_blank";
        // a5.innerHTML = "test mail abc@xyz.com";
        //
        // // 6 строка
        // var row6 = table.insertRow(5);
        // var cell6_1 = row6.insertCell(0);
        // cell6_1.className ="label";
        // cell6_1.innerHTML ="Facebook";
        // var cell6_2 = row6.insertCell(1);
        // cell6_2.id = "divItemFB";
        // cell6_2.className ="link";
        // var a6 = cell6_2.appendChild(document.createElement("a"));
        // a6.href = "https://www.facebook.com/";
        // a6.target = "_blank";
        // a6.innerHTML = "test link Facebook in a new tab";


        chat.divConv = chat.divChat.appendChild(document.createElement("div"));
        chat.divConv.className = "divConv active";

        chat.divText = chat.divConv.appendChild(document.createElement("div"));
        chat.divText.className = "divText";
        chat.divInput = chat.divConv.appendChild(document.createElement("div"));
        chat.divInput.className = "divInput";

        chat.txtInput = chat.divInput.appendChild(document.createElement("textarea"));
        chat.txtInput.className = "txtInput";
        chat.txtInput.rows = "3";
        chat.txtInput.onkeydown = function (event) {
            if (event.keyCode == 13) {
                addText(info.id);
                return false;
            }
        };
        chat.btnInfo.onclick = function () {
            chat.divRoom.classList.toggle("active");
            chat.divConv.classList.toggle("active");
        };

        chat.divItem = divList.appendChild(document.createElement("div"));
        chat.divItem.onclick = function () {
            // вот надо подумать с чатАктивэйт
            chatActivate(chats, info.id);  // разобраться с этим!
        };

        if (info.id[0] == "r") { // this is room chat
            chat.divItem.id = info.id;
            chat.divItem.className = "divItem";
            // chat.divItem.classList.add(info.status);
            // chat.imgStatus = chat.divItem.appendChild(document.createElement("img"));
            // chat.imgStatus.className = "imgStatus";
            // chat.imgStatus.src = "status-" + info.status + ".png";
            chat.divName = chat.divItem.appendChild(document.createElement("div"));
            chat.divName.innerHTML = info.name;
            chat.divName.className = "divName";
            chat.divItemInfo = chat.divItem.appendChild(document.createElement("div"));
            chat.divItemInfo.className = "divInfo";
            chat.divItemInfo.innerHTML = 1;


        } else
        if (info.id[0] == "u") { // this is room chat
            chat.divItem.class = "divRoom";
        } else { //this is unknown
            console.warn("unknown chat type!!!!!");
        }
        chats[info.id] = chat;
    } else { // exists, we need to modify states only
        if (info.id[0] == "r") {
            // chat.divItem.classList.remove("online");
            // chat.divItem.classList.remove("away");
            // chat.divItem.classList.remove("offline");
            // chat.divItem.classList.add(info.status);
            // chat.imgStatus.src = "status-" + info.status + ".png";
        } else
        if (info.id[0] == "u") { // this is room chat
        } else { //this is unknown
            console.warn("unknown chat type!!!!!");
        }
    }
    // auto activate first chat
    // var ids = Object.keys(chats);
    // if (ids.length == 1) chatActivate(chats, ids[0]);
}

function setChat(info) {
    setDelete(info);
    var chat = chats[info.id];
    if (!chat) {  // does not exist, we will create it once
        if (info.state == "invite" || info.state == "verify" || info.state == "reject") {chat = {id: info.id, info: info};}
        else if (info.state == "peer") {chat = {id: info.id, info: info, sync: false};}
        else {console.warn("unexpected user state:", info.state);}
        chat.divChat = divChats.appendChild(document.createElement("div"));
        chat.divChat.className = "divChat";
        chat.divInfo = chat.divChat.appendChild(document.createElement("div"));
        chat.divInfo.className = "divInfo";
        switch (info.state) {
            case "peer": chat.divInfo.innerHTML = "You're in dialog with: " + info.name; break;
            case "invite": chat.divInfo.innerHTML = "Invite to " + info.name + ". Waiting..."; break;
            case "verify": chat.divInfo.innerHTML = "Invite from " + info.name; break;
            case "reject": chat.divInfo.innerHTML = "Invite to " + info.name + " rejected"; break;
            default: console.warn("unexpected user state:", info.state);
        }
        chat.btnInfo = chat.divInfo.appendChild(document.createElement("button"));
        chat.btnInfo.className = "btnInfo";
        chat.btnInfo.type = "reset";
        chat.btnInfo.innerHTML = "Info";

        chat.divUser = chat.divChat.appendChild(document.createElement("div"));
        chat.divUser.className = "divUser";
        chat.btnRemove = chat.divUser.appendChild(document.createElement("button"));
        chat.btnRemove.className = "btnRemove";
        chat.btnRemove.type = "reset";
        chat.btnRemove.innerHTML = "Delete user";

        chat.btnRemove.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };

        chat.br = chat.divUser.appendChild(document.createElement("br"));
        chat.divUserInfo = chat.divUser.appendChild(document.createElement("table"));
        chat.divUserInfo.className = "divUserInfo";
        var table = chat.divUserInfo;

        // 1 строка
        var row1 = table.insertRow(0);
        var cell1_1 = row1.insertCell(0);
        cell1_1.className ="label";
        cell1_1.innerHTML ="User name";
        var cell1_2 = row1.insertCell(1);
        cell1_2.id = "divItemUName";
        cell1_2.className ="text";
        cell1_2.innerHTML = info.name;

        // 2 строка
        var row2 = table.insertRow(1);
        var cell2_1 = row2.insertCell(0);
        cell2_1.className ="label";
        cell2_1.innerHTML ="First Name";
        var cell2_2 = row2.insertCell(1);
        cell2_2.id = "divItemFName";
        cell2_2.className ="text";
        cell2_2.innerHTML = "test FirstName";

        // 3 строка
        var row3 = table.insertRow(2);
        var cell3_1 = row3.insertCell(0);
        cell3_1.className ="label";
        cell3_1.innerHTML ="Last Name";
        var cell3_2 = row3.insertCell(1);
        cell3_2.id = "divItemLName";
        cell3_2.className ="text";
        cell3_2.innerHTML = "test LastName";

        // 4 строка
        var row4 = table.insertRow(3);
        var cell4_1 = row4.insertCell(0);
        cell4_1.className ="label";
        cell4_1.innerHTML ="Phone number";
        var cell4_2 = row4.insertCell(1);
        cell4_2.id = "divItemPhone";
        cell4_2.className ="link";
        var a4 = cell4_2.appendChild(document.createElement("a"));
        a4.href = "tel:1234567890";
        // a4.target = "_blank";
        a4.innerHTML = "test call 1234567890";

        // 5 строка
        var row5 = table.insertRow(4);
        var cell5_1 = row5.insertCell(0);
        cell5_1.className ="label";
        cell5_1.innerHTML ="E-mail";
        var cell5_2 = row5.insertCell(1);
        cell5_2.id = "divItemEMail";
        cell5_2.className ="link";
        var a5 = cell5_2.appendChild(document.createElement("a"));
        a5.href = "mailto:abc@xyz.com";
        a5.target = "_blank";
        a5.innerHTML = "test mail abc@xyz.com";

        // 6 строка
        var row6 = table.insertRow(5);
        var cell6_1 = row6.insertCell(0);
        cell6_1.className ="label";
        cell6_1.innerHTML ="Facebook";
        var cell6_2 = row6.insertCell(1);
        cell6_2.id = "divItemFB";
        cell6_2.className ="link";
        var a6 = cell6_2.appendChild(document.createElement("a"));
        a6.href = "https://www.facebook.com/";
        a6.target = "_blank";
        a6.innerHTML = "test link Facebook in a new tab";




        chat.divConv = chat.divChat.appendChild(document.createElement("div"));
        chat.divConv.className = "divConv active";

        chat.divText = chat.divConv.appendChild(document.createElement("div"));
        chat.divText.className = "divText";
        chat.divInput = chat.divConv.appendChild(document.createElement("div"));
        chat.divInput.className = "divInput";
        switch (info.state) {
            case "peer":
                chat.txtInput = chat.divInput.appendChild(document.createElement("textarea"));
                chat.txtInput.className = "txtInput";
                chat.txtInput.rows = "3";
                chat.txtInput.onkeydown = function (event) {
                    if (event.keyCode == 13) {
                        addText(info.id);
                        return false;
                    }
                };
                chat.btnInput = chat.divInput.appendChild(document.createElement("button"));
                chat.btnInput.className = "btnInput";
                chat.btnInput.type = "reset";
                chat.btnInput.innerHTML = "Send";
                chat.btnInput.onclick = function () { addText(info.id); };
                break;
            case "invite":
                chat.btnReject = chat.divInput.appendChild(document.createElement("button"));
                chat.btnReject.className = "btnReject";
                chat.btnReject.type = "reset";
                chat.btnReject.innerHTML = "Cancel";
                chat.btnReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };
                break;
            case "verify":
                chat.btnAccept = chat.divInput.appendChild(document.createElement("button"));
                chat.btnAccept.className = "btnAccept";
                chat.btnAccept.type = "reset";
                chat.btnAccept.innerHTML = "Accept";
                chat.btnAccept.onclick = function () { ws_send({type: 'user', action: 'accept', item: info}); };

                chat.btnReject = chat.divInput.appendChild(document.createElement("button"));
                chat.btnReject.className = "btnReject";
                chat.btnReject.type = "reset";
                chat.btnReject.innerHTML = "Reject";
                chat.btnReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };

                break;
            case "reject":
                chat.btnReject = chat.divInput.appendChild(document.createElement("button"));
                chat.btnReject.className = "btnReject";
                chat.btnReject.type = "reset";
                chat.btnReject.innerHTML = "Cancel";
                chat.btnReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };
                break;
            default: console.warn("unexpected user state:", info.state);
        }

        chat.btnInfo.onclick = function () {
            chat.divUser.classList.toggle("active");
            chat.divConv.classList.toggle("active");
        };

        chat.divItem = divList.appendChild(document.createElement("div"));
        chat.divItem.onclick = function () {
            chatActivate(chats, info.id);
        };

        if (info.id[0] == "u") { // this is user chat
            chat.divItem.id = info.id;
            chat.divItem.className = "divItem";
            chat.divItem.classList.add(info.status);
            chat.imgStatus = chat.divItem.appendChild(document.createElement("img"));
            chat.imgStatus.className = "imgStatus";
            chat.imgStatus.src = "status-" + info.status + ".png";
            chat.divName = chat.divItem.appendChild(document.createElement("div"));
            chat.divName.innerHTML = info.name;
            chat.divName.className = "divName";
            chat.divItemInfo = chat.divItem.appendChild(document.createElement("div"));
            chat.divItemInfo.className = "divInfo";
            switch (info.state) {
                case "peer":
                    chat.divItemInfo.innerHTML = 1;
                    break;
                case "invite":
                    chat.imgReject = chat.divItem.appendChild(document.createElement("img"));
                    chat.imgReject.className = "imgAdd";
                    chat.imgReject.src = "status-reject.png";
                    chat.imgReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };
                    break;
                case "verify":
                    chat.imgReject = chat.divItem.appendChild(document.createElement("img"));
                    chat.imgReject.className = "imgAdd";
                    chat.imgReject.src = "status-reject.png";
                    chat.imgReject.onclick = function () { ws_send({type: 'user', action: 'reject', item: info}); };
                    chat.imgAccept = chat.divItem.appendChild(document.createElement("img"));
                    chat.imgAccept.className = "imgAdd";
                    chat.imgAccept.src = "status-accept.png";
                    chat.imgAccept.onclick = function () { ws_send({type: 'user', action: 'accept', item: info}); };
                    break;
                case "reject":
                    chat.imgReject = chat.divItem.appendChild(document.createElement("img"));
                    chat.imgReject.className = "imgAdd";
                    chat.imgReject.src = "status-reject.png";
                    chat.imgReject.onclick = function () { ws_send({type: 'user', action: 'cancel', item: info}); };
                    chat.imgAccept = chat.divItem.appendChild(document.createElement("img"));
                    chat.imgAccept.className = "imgAdd";
                    chat.imgAccept.src = "status-add.png";
                    chat.imgAccept.onclick = function () { ws_send({type: 'user', action: 'invite', item: info}); };
                    break;
                default: console.warn("unexpected user state:", info.state);
            }


        } else
        if (info.id[0] == "r") { // this is room chat
            chat.divItem.class = "divRoom";
        } else { //this is unknown
            console.warn("unknown chat type!!!!!");
        }
        chats[info.id] = chat;
    } else { // exists, we need to modify states only
        if (info.id[0] == "u") {
            chat.divItem.classList.remove("online");
            chat.divItem.classList.remove("away");
            chat.divItem.classList.remove("offline");
            chat.divItem.classList.add(info.status);
            chat.imgStatus.src = "status-" + info.status + ".png";
        } else
        if (info.id[0] == "r") { // this is room chat
        } else { //this is unknown
            console.warn("unknown chat type!!!!!");
        }
    }
    // auto activate first chat
    // var ids = Object.keys(chats);
    // if (ids.length == 1) chatActivate(chats, ids[0]);
}

function chatActivate(list, id) {
    console.log(list, id);
    // 0. hide myInfo if visible and activate chats
    if (!divChats.classList.contains("active")) divChats.classList.toggle("active");
    if (divMyInfo.classList.contains("active")) divMyInfo.classList.toggle("active");
    // 1. hide active chat
    if (divChatActive) divChatActive.classList.toggle("active");
    // 2. activate chat by id
    var item = list[id];
    if (item.state =="peer" && !item.sync) {
        ws_send({type: 'sync', chatId: id, userId: me.id}); // добавил, чтобы на сервере можно было roomIdCreate
    }
    divChatActive = item.divChat;
    divChatActive.classList.toggle("active");

}

function addText(chatId) {
    var chat = chats[chatId];
    if (chat.txtInput.value.trim() == "") return;
    ws_send({
        type: 'text',
        userId: me.id,
        chatId: chatId,
        text: chat.txtInput.value
    });
    chat.txtInput.value = null;
}

function writeText(chatId, userId, txt) {
    var info;
    if (chatId[0] == "u") {
        info = chats[userId] ? chats[userId].info : me;
    } else
    if (chatId[0] == "r") {
        info = {id: 0, name:"some user"}; // затычка
    } else {
        return console.warn("invalid type, must be R or U");
    }
    var chat = chats[chatId];
    chat.divText.innerHTML += '<span class = ' + info.id + '>' + info.name + '</span>: ' + txt + '<br/>';
    chat.divText.scrollTop += 1000000;
}


// ЗАДАНИЯ: ------------------------------------------------------------------------

// !5) чтобы юзер мог менять password
// !7) добавить время сообщения кто когда писал
// !13) от alex: добавить возможность писать не одним предложением а несколько. как в скайпе скажем. через контрол +enter
// !15) сделать нотификейшн, что поменялось имя

// 1) не отправлять пароли других юзеров
// 6) чтобы юзер мог добавить аватарку
// 8) чтобы юзер мог исправлять опечатки в предыдущих сообщениях
// 10) чтобы можно было писать только отдельному юзеру
// 11) notification, что новое непрочитанное сообщение -  https://developer.mozilla.org/en-US/docs/Web/API/notification
// !12) от alex: Звук отправления и получения сообщения. неясно отправил или нет. надо смотреть в чать. если народу много - не увидишь
// 14) от Насти: js подключен. просто у пользователя может стоять в браузере параметр не загружать скрипты, тогда все
//     не заработает. поэтому надо предусматривать, чтобы сайт работал без скриптов, либо выводить сообщение, выкидывать
//     на страницу, что ничего без включения js сделать нельзя
// 17) имена разного цвета (или хотя бы свое чтоб выделялось)
// 18) еще отоброжаемое имя и логин можно чтобы отличались - но это даже не знаю, стОит ли

// +2) под My name - выпадающее окошко с выбором статуса (желаемого), который записывается в поле "status"
// +3) сделать решения, чтоб если юзер на самом деле оффлайн, то вне зависимости от желаемого статуса, показывался всегда "оффлайн"
// +4) сделать logout
// +9) исправить ошибки
// +16) padding в поле для ввода и в сообщениях
// +19) чтобы вся история сообщений показывалась вместе с моими сообщениями
// +20) оменять местами дивлист и дивчат
// +21) сделать работающими точки online и offline

//----------------------------------------------------------------------------------