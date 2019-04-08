
db.users.drop();
db.rooms.drop();
db.messages.drop();

db.createCollection("users", {
    validator: {
        $and: [
            {uname: {"$exists": true, "$type": 2}},
            {passw: {"$exists": true, "$type": 2}}
        ]
    },
    validationAction: "warn"
});
db.users.createIndex({"uname": 1}, { name: "users_uname", unique: true });


db.createCollection("rooms", {});
db.createCollection("messages", {});
db.createCollection("logs", {});

///////////////////////////////////////////


// новая функциональная конструкция д.Мити:
// function make(m, p, meta) {
//     var r = m || {};
//     forEach(meta, function (v, n) {
//         var e = addElement(v[0], v[1], v[2]);
//         if (p) p.appendChild(e);
//         if (Array.isArray(r)) {
//             var o = {}; o[n] = e; r.push(o);
//             if (v[3]) make(o, e, v[3]);
//         } else {
//             r[n] = e;
//             if (v[3]) make(r, e, v[3]);
//         }
//     });
//     return r;
// }
// function addElement(tag, props, events) {
//     function setProp(e, props) {
//         forEach(props, function (value, name) {
//             if (typeof value === 'object' && value !== null) setProp(e[name], value);
//             else e[name] = value;
//         });
//     }
//     var element = document.createElement(tag);
//     if (props) setProp(element, props);
//     if (events) forEach(events, function (value, name) {
//         element.addEventListener(name, value[0], value[1]);
//     });
//     return element;
// }
// function forEach(o, f) {
//     Object.keys(o).forEach(function(k) { f(o[k], k) });
// }
//
// function init(msg) {
//     console.log(msg);
//     divInstances.innerHTML = '';
//     instances = {server:{items:[]}, client:{items:[]}};
//     make(instances.server, divInstances, {
//         head: ['div', {className: 'head', innerHTML: 'ServerInstances:'}, {}, {
//             lb1: ['div', {innerHTML: 'available:'}, {}, {}],
//             cnt: ['div', {className: 'cnt', innerHTML: msg.serverInstances.length}, {}, {}],
//             lb2: ['div', {innerHTML: 'running:'}, {}, {}],
//             run: ['input', {className: 'run', value: msg.serverInstances.filter(function(v){return v.state=='running'}).length}, {
//                 'change':[function(){ ws_send({serverInstancesRun:this.value}) }, false]
//             }, {}]
//         }],
//         list: ['div', {className: 'list'}, {},{}]
//     });
//     msg.serverInstances.forEach(function (v) {
//         make(instances.server.items, instances.server.list, {
//             inst: ['div', {className: 'inst', id: v.id}, {},{
//                 id: ['div', {className: 'id', innerHTML: v.id}, {},{}],
//                 state: ['div', {className: 'state', innerHTML: 'state:'+v.state}, {},{}],
//                 agent: ['div', {className: 'agent', innerHTML: 'agent:'+v.agent}, {},{}]
//             }]
//         });
//     });
//     make(instances.client, divInstances, {
//         head: ['div', {className: 'head', innerHTML: 'ClientInstances:'}, {}, {
//             lb1: ['div', {innerHTML: 'available:'}, {}, {}],
//             cnt: ['div', {className: 'cnt', innerHTML: msg.clientInstances.length}, {}, {}],
//             lb2: ['div', {innerHTML: 'running:'}, {}, {}],
//             run: ['input', {className: 'run', value: msg.serverInstances.filter(function(v){return v.state=='running'}).length}, {
//                 'change':[function(){ ws_send({clientInstancesRun:this.value}) }, false]
//             }, {}]
//         }],
//         list: ['div', {className: 'list'}, {},{}]
//     });
//     msg.clientInstances.forEach(function (v) {
//         make(instances.client.items, instances.client.list, {
//             inst: ['div', {className: 'inst', id: v.id}, {},{
//                 id: ['div', {className: 'id', innerHTML: v.id}, {},{}],
//                 state: ['div', {className: 'state', innerHTML: 'state:'+v.state}, {},{}],
//                 agent: ['div', {className: 'agent', innerHTML: 'agent:'+v.agent}, {},{}]
//             }]
//         });
//     });
// }