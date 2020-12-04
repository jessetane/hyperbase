#!/usr/bin/env node

import HyperbaseTransportUnix from 'hyperbase/transport-unix/index.js'
import nacl from 'tweetnacl/nacl.js'
import base64 from 'base64-transcoder/index.js'
import minimist from 'minimist/index.js'

var argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    n: 'numeric',
    l: 'limit',
    r: 'reverse',
    s: 'socket'
  },
  boolean: [
    'help',
    'numeric'
  ]
})
var args = argv._
var cmd = args[0]

if (argv.help) {
  help()
} else {
  connect((err, peer) => {
    if (err) throw err
    if (cmd === 'write') {
      var key = args[1]
      var value = args[2]
      var value = argv.numeric ? parseFloat(value) : value
      peer.call('write', [[ key, value ]], err => {
        if (err) throw err
        process.exit()
      })
    } else if (cmd === 'read') {
      peer.call('read', args[1], (err, data) => {
        if (err) throw err
        console.log(data)
        process.exit()
      })
    } else if (cmd == 'stream') {
      var streamId = 'stream.' + (Math.random() + '').slice(2)
      var opts = { decode: true }
      opts.limit = argv.limit
      opts.reverse = argv.reverse
      opts.gt = argv.gt
      opts.gte = argv.gte
      opts.lt = argv.lt
      opts.lte = argv.lte
      peer.setInterface(streamId, {
        data: data => console.log(data),
        end: () => {
          peer.setInterface(streamId)
          process.exit()
        }
      })
      peer.call('stream', args[1], streamId, opts, err => {
        if (err) throw err
      })
    }
  })
}

function connect (cb) {
  var name = 'client.' + (Math.random() + '').slice(2)
  // console.log(name + ' connecting to ' + argv.socket)
  var unix = new HyperbaseTransportUnix()
  var peer = unix.connect(argv.socket)
  peer.database =  { name }
  peer.addEventListener('ready', peer.auth)
  peer.addEventListener('auth', evt => {
    if (peer.authState !== true) cb(peer.authState)
    else cb(null, peer)
  })
}

function help () {
  console.log(`hyperbase cli version 1.0.0

  -h,--help   print help message
`)
}
