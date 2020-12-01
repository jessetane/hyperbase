#!/usr/bin/env node

import HyperbaseTransportUnix from 'hyperbase/transport-unix/index.js'
import nacl from 'tweetnacl/nacl.js'
import base64 from 'base64-transcoder/index.js'

// args
var args = process.argv.slice(2)
var socket = args[0]
var cmd = args[1]
var params = args.slice(2)

// connect, auth, execute
var name = 'client.' + (Math.random() + '').slice(2)
var unix = new HyperbaseTransportUnix()
console.log(name + ' connecting to ' + socket)
var peer = unix.connect(socket)
peer.database =  { name }
peer.addEventListener('ready', peer.auth)
peer.addEventListener('auth', evt => {
  if (peer.authState !== true) throw peer.authState
  switch (cmd) {
    case 'write':
      params = [[{ path: params[0], data: params[1] }]]
      break
    case 'stream':
      var streamId = 'stream.' + (Math.random() + '').slice(2)
      params.push(streamId)
      peer.setInterface(streamId, {
        data: data => console.log(data),
        end: () => process.exit(0)
      })
      peer.call(cmd, ...params, (err) => {
        if (err) throw err
      })
      return
  }
  peer.call(cmd, ...params, (err, res) => {
    if (err) throw err
    console.log(res)
    process.exit(0)
  })
})
peer.addEventListener('error', evt => {
	console.error('error', evt.detail)
})
