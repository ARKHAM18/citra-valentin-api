var fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var request = require('request-promise-native');
var rooms = new Map();

function load() {
  if (fs.existsSync('rooms.json')) {
    var json = JSON.parse(fs.readFileSync('rooms.json'));
    for (var i = 0; i < json.length; ++i) {
      var room = json[i];
      const uid = `${room.ip}:${room.port}`;
      checkRoomOpen(uid, null, () => {
        rooms.set(uid, room);
      });
    }
  }
}

function save() {
  fs.writeFileSync('rooms.json', JSON.stringify(Array.from(rooms.values())));
}

function checkRoomOpen(uid, res, open) {
  var a = uid.split(':');
  request({url: `http://${a[0]}:${a[1]}/`, timeout: 5000})
      .then((body) => {
        if (open) open();
        if (res) res.status(200).send('OK');
      })
      .catch((error) => {
        rooms.delete(uid);
        save();
        console.log(`Room ${uid}: host didn't port forward`);
        if (res)
          res.status(200).send(
              'You need to open both TCP & UDP ports to create a public room.');
      });
}

app.use(bodyParser.json());
app.enable('trust proxy');

app.get('/lobby', (req, res) => {
  res.json(Array.from(rooms.values()));
});

app.post('/lobby', (req, res) => {
  var delete_room = 'delete' in req.body;
  if (delete_room ||
      ('name' in req.body && 'creator' in req.body && 'port' in req.body &&
       'max_members' in req.body && 'net_version' in req.body &&
       'has_password' in req.body)) {
    req.body.ip = req.ip;
    if (delete_room) {
      const uid = `${req.body.ip}:${req.body.delete}`;
      rooms.delete(uid);
      save();
      console.log(`Room ${uid} removed`);
      res.status(200).send('OK');
    } else {
      const uid = `${req.body.ip}:${req.body.port}`;
      checkRoomOpen(uid, res, () => {
        rooms.set(uid, req.body);
        save();
        console.log(`Room ${uid} added/updated`);
      });
    }
  } else
    res.status(400).send('Bad Request');
});

setInterval(() => {
  rooms.forEach((v, k, m) => {
    checkRoomOpen(k);
  });
}, 20000);

http.listen(process.env.PORT, '0.0.0.0', () => {
  load();
  console.log('API initialized');
});
