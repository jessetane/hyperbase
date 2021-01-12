#!/usr/bin/env node

import Hyperbase from 'hyperbase/index.js'
import HyperbaseStoreLevel from 'hyperbase/store-level/index.js'
import HyperbaseCodecJson from 'hyperbase/codec-json/index.js'
import HyperbaseCodecHashSha512 from 'hyperbase/codec-hash-sha512/index.js'
import HyperbaseCodecHashSha512Json from 'hyperbase/codec-hash-sha512-json/index.js'
import HyperbaseCodecHashSha512EncryptXSalsa20Poly1305 from 'hyperbase/codec-hash-sha512-encrypt-xsalsa20-poly1305/index.js'
import HyperbaseCodecHashSha512EncryptXSalsa20Poly1305Json from 'hyperbase/codec-hash-sha512-encrypt-xsalsa20-poly1305-json/index.js'
import HyperbaseCodecSignEd25519Json from 'hyperbase/codec-sign-ed25519-json/index.js'
import HyperbaseCodecSignEd25519EncryptXSalsa20Poly1305Json from 'hyperbase/codec-sign-ed25519-encrypt-xsalsa20-poly1305-json/index.js'
import HyperbaseNode from 'hyperbase/node.js'
import HyperbaseTransportUnix from 'hyperbase/transport-unix/index.js'
import HyperbaseTransportTcp from 'hyperbase/transport-tcp/index.js'
//import HyperbaseTransportWs from 'hyperbase/transport-ws/index.js'
import nacl from 'tweetnacl/nacl.js'
import base64 from 'base64-transcoder/index.js'
import fs from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

var __dirname = dirname(fileURLToPath(import.meta.url));
var configFilename = process.env.CONFIG || (__dirname + '/config.json')
var config = JSON.parse(fs.readFileSync(configFilename, 'utf8'))
var secretKey = config.secret
var ed25519 = secretKey
  ? nacl.sign.keyPair.fromSecretKey(base64.decode(secretKey, 'url'))
  : nacl.sign.keyPair()
var publicKey = base64.encode(ed25519.publicKey, 'url')
if (!secretKey) {
  console.log('generated new secret key: ' + base64.encode(ed25519.secretKey, 'url'))
}

// database setup
var database = new Hyperbase({
  store: new HyperbaseStoreLevel({ filename: `${publicKey}.level` }),
	codecs: {
    json: new HyperbaseCodecJson(),
    'hash-sha512': new HyperbaseCodecHashSha512(),
    'hash-sha512-json': new HyperbaseCodecHashSha512Json(),
    'hash-sha512-encrypt-xsalsa20-poly1305': new HyperbaseCodecHashSha512EncryptXSalsa20Poly1305(),
    'hash-sha512-encrypt-xsalsa20-poly1305-json': new HyperbaseCodecHashSha512EncryptXSalsa20Poly1305Json(),
    'sign-ed25519-json': new HyperbaseCodecSignEd25519Json({ identity: ed25519 }),
    'sign-ed25519-encrypt-xsalsa20-poly1305-json': new HyperbaseCodecSignEd25519EncryptXSalsa20Poly1305Json({ identity: ed25519 })
  }
})
database.addEventListener('write', evt => console.log('database write:', evt.detail))
console.log('storage initialized:', database.store.filename)

// transport setup
var unix = new HyperbaseTransportUnix({ socket: config.unixSocket })
unix.addEventListener('listen', () => {
  console.log('unix transport listening:', unix.server.address())
})
var tcp = new HyperbaseTransportTcp({ port: config.tcpPort })
tcp.addEventListener('listen', () => {
  console.log('tcp transport listening:', tcp.server.address())
})
/*
var ws = new HyperbaseTransportWs({ port: config.wsPort })
ws.addEventListener('listen', () => {
  console.log('ws transport listening:', ws.server.address())
})
*/

// node setup
var node = new HyperbaseNode({
  database,
  transports: { unix, tcp },
  knownAddresses: config.knownAddresses
})
;[
  'accept',
  'connect',
  'disconnect',
  'auth'
].forEach(name => node.addEventListener(name, evt => {
  var peer = evt.detail
  console.log(name + ':', peer.name, peer.address, peer.authState)
  if (peer.self) return
  if (name === 'auth') {
    // do stuff
  }
}))
node.listen()
node.connect()
