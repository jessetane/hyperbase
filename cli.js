#!/usr/bin/env node

import Hyperbase from 'hyperbase/index.js'
import HyperbaseTransportUnix from 'hyperbase/transport-unix/index.js'
import nacl from 'tweetnacl/nacl.js'
import base64 from 'base64-transcoder/index.js'
import minimist from 'minimist/index.js'

var argv = minimist(process.argv.slice(2), {
  alias: {
    d: 'delimiter',
    h: 'help',
    n: 'numeric',
    l: 'limit',
    r: 'reverse',
    s: 'socket',
    w: 'wildcard',
    o: 'options'
  },
  boolean: [
    'help',
    'numeric'
  ]
})
var args = argv._
var cmd = args[0]
var path = args[1]
var pathDelimiter = argv.delimiter || '/'
var pathWildcard = argv.wildcard || '*'
var options = {}
if (!argv.options) {
  argv.options = []
} else if (!Array.isArray(argv.options)) {
  argv.options = argv.options.split(',')
}
argv.options.forEach(pair => {
  var parts = pair.split(':')
  options[parts[0]] = parts[1]
})

if (argv.help) {
  help()
} else {
  connect((err, peer) => {
    if (err) throw err
    if (cmd === 'write') {
      var data = args[2] || null
      data = argv.numeric ? parseFloat(data) : data
      path = Hyperbase.normalizePath(path, { pathDelimiter, pathWildcard })
      var req = Object.assign({ path, data }, options)
      peer.call('write', [req], err => {
        if (err) throw err
        process.exit()
      })
    } else if (cmd === 'read') {
      if (options.decode === 'false') options.decode = false
      else options.decode = true
      path = Hyperbase.normalizePath(path, { pathDelimiter, pathWildcard })
      peer.call('read', path, options, (err, data) => {
        if (err) throw err
        console.log(data)
        process.exit()
      })
    } else if (cmd == 'stream') {
      if (options.decode === 'false') options.decode = false
      else options.decode = true
      var streamId = 'stream.' + Math.random().toString().slice(2)
      var opts = {}
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
      path = Hyperbase.normalizePath(path, { pathDelimiter, pathWildcard, allowWild: true })
      peer.call('stream', path, streamId, Object.assign(opts, options), err => {
        if (err) throw err
      })
    }
  })
}

function connect (cb) {
  var name = 'client.' + Math.random().toString().slice(2)
  // console.log(name + ' connecting to ' + argv.socket)
  var unix = new HyperbaseTransportUnix()
  var peer = unix.connect(argv.socket)
  peer.database =  { name }
  peer.addEventListener('connect', peer.auth)
  peer.addEventListener('shouldauth', evt => {
    if (peer.authState !== true) cb(peer.authState)
    else cb(null, peer)
  })
  peer.addEventListener('error', evt => {
    throw evt.detail
  })
}

function help () {
  console.log(`hyperbase cli version 1.0.0

  -h,--help   print help message
`)
}
