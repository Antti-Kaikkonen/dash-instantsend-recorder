var express = require('express');
var level = require('level');
var zmq = require('zeromq');
var HttpStatus = require('http-status-codes');
var lexi = require('lexint');

const DB_TX_PREFIX = "tx/"; //txid => timestamp
const DB_TX_BY_TIME_PREFIX = "tx_by_time/";//timestamp/index => txid
const DB_ACTIVE_PREFIX = "active/";
const DB_TX_COUNT = "tx_count";
const ACTIVE_UPDATE_INTERVAL = 1000;
const DEFAULT_LISTEN_PORT = 3000;

let listenPort = DEFAULT_LISTEN_PORT;

process.argv.forEach(function (val) {
  let arr = val.split("=");
  if (arr.length === 2 && arr[0] === "-port") {
    listenPort = arr[1];
  }
});

var db = level('./db', {keyEncoding: "binary"})

var sock = zmq.socket('sub');
sock.connect('tcp://127.0.0.1:28332');
sock.subscribe('hashtxlock');


let txCount;

async function run() {
  txCount = await getTxCount();
  console.log("Listening for InstantSend transactions. You can view recorded transactions at http://localhost:"+listenPort+"/transactions.");
  sock.on('message', async function(topic, message) {
    let topicStr = topic.toString('ascii');
    if (topicStr === "hashtxlock") {
      let txid = message.toString('hex');
      let date = new Date();
  
      txCount++;
      await db.batch([
        {type: "put", key: Buffer.from(DB_TX_PREFIX+txid), value: date.getTime()},
        {type: "put", key: Buffer.concat([Buffer.from(DB_TX_BY_TIME_PREFIX), lexi.encode(date.getTime()), lexi.encode(txCount-1)]), value: txid},
        {type: "put", key: Buffer.from(DB_TX_COUNT), value: txCount}
      ], {keyEncoding: "binary"});
      console.log("tx saved", txid, date);
    }
  });
}

async function getTxCount() {
  try {
    return await db.get(DB_TX_COUNT);
  } catch(err) {
    if (err.notFound) {
      return 0;
    } else {
      throw err;
    }
  }
}

run();

var app = express();

app.get('/gettime/:txid', async function (req, res) {
  let txid = req.params.txid;
  try {
    let timestamp = new Number(await db.get(DB_TX_PREFIX+txid));
    res.send(new Date(timestamp));
  } catch(error) {
    if (error.notFound) {
      res.sendStatus(HttpStatus.NOT_FOUND);
    } else {
      res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
});


app.get('/transactions', function (req, res) {
  let fromAsNumber = new Number(req.query.from).valueOf();
  let from = Number.isInteger(fromAsNumber) ? fromAsNumber : new Date(req.query.from).getTime();

  let toAsNumber = new Number(req.query.to).valueOf();
  let to = Number.isInteger(toAsNumber) ? toAsNumber : new Date(req.query.to).getTime();

  let gte;
  if (Number.isInteger(from)) {
    gte = Buffer.concat([Buffer.from(DB_TX_BY_TIME_PREFIX), lexi.encode(from)]);
  } else {
    gte = Buffer.from(DB_TX_BY_TIME_PREFIX);
  }
  let lte;
  if (Number.isInteger(to)) {
    lte = Buffer.concat([Buffer.from(DB_TX_BY_TIME_PREFIX), lexi.encode(to)]);
  } else {
    lte = Buffer.concat([Buffer.from(DB_TX_BY_TIME_PREFIX), lexi.encode(Number.MAX_SAFE_INTEGER)]);
  }
  let result = [];
  let stream = db.createReadStream({gte:gte, lte: lte});
  stream.on('data', function (data) {
    let prefixRemoved = data.key.slice(DB_TX_BY_TIME_PREFIX.length);
    let time = lexi.decode(prefixRemoved).value;
    result.push([new Date(time).toJSON(), data.value]);
  })
  .on('error', function (err) {
    res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
  })
  .on('close', function () {
    res.send(result);
  });
});

app.listen(listenPort);

let startTime = (new Date()).getTime();
let currentTime = startTime;

setInterval(() => {
  let previousCurrent = currentTime;
  currentTime = (new Date()).getTime();
  let activeDuration = currentTime-startTime;
  db.batch([
    {type: "put", key: DB_ACTIVE_PREFIX+currentTime, value: activeDuration},
    {type: "del", key: DB_ACTIVE_PREFIX+previousCurrent}
  ]);
}, ACTIVE_UPDATE_INTERVAL);