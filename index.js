var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var request = require('request-promise-native');
var Discord = require('discord.js');
var client = new Discord.Client();
var reaction_numbers = [
  '\u0030\u20E3', '\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3',
  '\u0034\u20E3', '\u0035\u20E3', '\u0036\u20E3', '\u0037\u20E3',
  '\u0038\u20E3', '\u0039\u20E3'
];
var rooms = new Map();

function checkRoomOpen(uid, res, open) {
  var a = uid.split(':');
  request({url: `http://${a[0]}:${a[1]}/`, timeout: 5000})
      .then((body) => {
        if (open) open();
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
      checkRoomOpen(uid, res, () => {
        rooms.set(uid, req.body);
        console.log(`Room with UID ${uid} added/updated`);
      });
    }
  } else
    res.status(400).send('Bad Request');
});

async function afterLogin() {
  console.log('Logged in as %s', client.user.tag);
  console.log('Getting channels...');
  var channel = client.channels.get('520661422137671699');
  var logschannel = client.channels.get('520706462834753536');
  console.log('Getting channels... OK');
  console.log('Deleting messages...');
  var fetched = await channel.fetchMessages({limit: 1});
  channel.bulkDelete(fetched);
  console.log('Deleting messages... OK');
  channel
      .send(
          '\u200B\nWelcome to our 24/7/365 support channel!\nReact with :one: if you have a fatal error\nReact with :two: if you want to check a log **(ONLY CHECKS IF FILE IS CORRUPTED)**')
      .then(async function(m) {
        await m.react(reaction_numbers[1]);
        await m.react(reaction_numbers[2]);
        client.on('messageReactionAdd', async function(reaction, user) {
          if (reaction.message.channel.id == '520661422137671699') {
            if (!user.bot) {
              switch (reaction.emoji.name) {
                case reaction_numbers[1]:  // Fatal error
                  await user.send(
                      'Common Fatal Errors\nWhen trying to play MHXX (English Patched v4): Use v5.');
                  break;
                case reaction_numbers[2]:  // Check log
                  await user.send('Drag & drop your log here.');
                  break;
              }
              await reaction.remove(user);
            }
          }
        });
      });
  client.on('message', (m) => {
    if (m.channel.type === 'text' && m.channel.id === '519577449810624515' &&
        m.content !== '?join')
      m.delete();
    else if (m.channel.type === 'dm' && m.attachments.size === 1) {
      var a = m.attachments.first();
      if (a.filename === 'log.txt')
        request(a.url)
            .then((text) => {
              var issues = [];
              if (text.includes('Unable to read RomFS'))
                issues.push(
                    'The file you\'re attempting to run is corrupted. Look here for instructions on how to properly dump programs from your console. <https://github.com/valentinvanelslande/citra/wiki/Dumping-Installed-Programs>');
              if (issues.length === 0) {
                logschannel.send(`From ${m.author.tag}`, {
                  files: [{attachment: Buffer.from(text), name: 'log.txt'}]
                });
                m.channel.send(
                    'I didn\'t find anything wrong in your log file. A human will contact you soon.');
              } else
                m.channel.send(
                    `I found some issues in that log that need resolving:\n- ${
                        issues.join('\n-')}`);
            })
            .catch((e) => {
              console.log(e);
              m.channel.send('Failed to check log.');
            });
    }
  });
  console.log('Bot initialized');
};

setInterval(() => {
  rooms.forEach((v, k, m) => {
    checkRoomOpen(k);
  });
}, 20000);

http.listen(process.env.PORT, '0.0.0.0', () => {
  console.log('API initialized');
  client.login(process.env.TOKEN).then(afterLogin);
});
