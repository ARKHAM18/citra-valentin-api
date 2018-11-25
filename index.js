var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');

var rooms = new Map();
var updated = new Map();

app.use(bodyParser.json());
app.enable('trust proxy');

app.get('/lobby', (req, res) => {
  res.json(Array.from(rooms.values()));
});

app.post('/lobby', (req, res) => {
  var delete_room = 'delete' in req.body;
  if (delete_room ||
      ('name' in req.body && 'creator' in req.body && 'port' in req.body &&
       'maxMembers' in req.body && 'netVersion' in req.body &&
       'hasPassword' in req.body)) {
    req.body.ip = req.ip;
    if (delete_room) {
      const uid = `${req.body.ip}:${req.body.delete}`;
      rooms.delete(uid);
      updated.delete(uid);
      console.log(`Room with UID ${uid} removed`);
    } else {
      const uid = `${req.body.ip}:${req.body.port}`;
      rooms.set(uid, req.body);
      updated.set(uid, new Date().getTime());
      console.log(`Room with UID ${uid} added/updated`);
    }
    res.status(200).send('OK');
  } else {
    res.status(400).send('Bad Request');
  }
});

const MAX_TIMEOUT = 20000;

setInterval(() => {
  updated.forEach((v, k, m) => {
    var diff = new Date().getTime() - v;
    if (diff > MAX_TIMEOUT) {
      try {
        rooms.forEach((room) => {
          if (k === room.ip + ':' + room.port) {
            rooms.delete(k);
            updated.delete(k);
            throw 0;
          }
        });
      } catch {
      }
    }
  });
}, 1000);

http.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Listening on port ${process.env.PORT}`);
});
