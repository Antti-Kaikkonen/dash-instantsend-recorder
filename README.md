# Dash InstantSend Recorder

## Installation

npm install dash-instantsend-recorder -g

Add zmqpubhashtxlock=tcp://127.0.0.1:28332 to your dash.conf

Make sure that you have [zeromq](http://zeromq.org/intro:get-the-software) installed on your system. Otherwise the program will run but it will not detect any InstantSend transactions.

## Running

./dash-instantsend-recorder [-port=portnumber] [-zmq=endpoint]

example 1): ./dash-instantsend-recorder (will listen port 3000 and connect zmq endpoint at tcp://127.0.0.1:28332)

example 2): ./dash-instantsend-recorder -port=3001 -zmq=tcp://127.0.0.1:28333 (will listen port 3001 and connect zmq endpoint at tcp://127.0.0.1:28333)


## HTTP api

### /transactions

optional arguments: 
* from 
* to

examples:
* /transactions
* /transactions?from=2018-03-01
* /transactions?from=2018-03-01&to=2018-03-01T16:30

returns an array of [UTC time, txid] pairs.

### /gettime/:txid

examples
* /gettime/ee547e79bcbb7554aaabe0b4df274eee35b737e46d666d159e9dd67164f7a82e

returns the UTC time when this transaction was recorded or "Not Found".