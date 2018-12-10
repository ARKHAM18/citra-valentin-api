var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var request = require('request-promise-native');
var rooms = new Map();

function checkRoomOpen(uid, res) {
  var a = uid.split(':');
  request({url: `http://${a[0]}:${a[1]}/`, timeout: 5000})
      .then((body) => {
        if (res) res.status(200).send('OK');
      })
      .catch((error) => {
        rooms.delete(uid);
        console.log(`Room with UID ${uid} removed`);
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
       'maxMembers' in req.body && 'netVersion' in req.body &&
       'hasPassword' in req.body)) {
    req.body.ip = req.ip;
    if (delete_room) {
      const uid = `${req.body.ip}:${req.body.delete}`;
      rooms.delete(uid);
      console.log(`Room with UID ${uid} removed`);
      res.status(200).send('OK');
    } else {
      const uid = `${req.body.ip}:${req.body.port}`;
      rooms.set(uid, req.body);
      console.log(`Room with UID ${uid} added/updated`);
      checkRoomOpen(uid, res);
    }
  } else {
    res.status(400).send('Bad Request');
  }
});

setInterval(() => {
  rooms.forEach((v, k, m) => {
    checkRoomOpen(k);
  });
}, 20000);

http.listen(80, '0.0.0.0', () => {
  console.log('Listening on port 80');
});
