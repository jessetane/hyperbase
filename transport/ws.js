import WebSocket from 'ws'
import Peer from '../peer.js'
import BSON from '../bson.js'
import { utf8, Deferred } from '../util.js'

class TransportWs extends EventTarget {
  constructor (opts = {}) {
    super()
    this.host = opts.host || '::1'
    this.port = opts.port || '8453'
  }

  static connect (url) {
    var socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
		socket.remoteUrl = url
    var peer = TransportWs.setupPeer(socket)
    return peer
  }

  static setupPeer (socket) {
    socket.on('error', onclose)
    socket.on('close', onclose)
    function onclose (err) {
      socket.removeListener('error', onclose)
      socket.removeListener('close', onclose)
      socket.removeListener('message', peer.receive)
      peer.send = null
      if (err) {
        peer.dispatchEvent(new CustomEvent('error', { detail: err }))
      }
      peer.close()
    }
    // rpc interface
    var peer = new HyperbasePeer()
    peer.address = 'ws:' + (socket.remoteUrl || peer.name)
    peer.serialize = req => {
      // console.log('sending rpc:', req)
      req = utf8.encode(JSON.stringify(BSON.encode(req)))
      return req
    }
    peer.deserialize = res => {
      // console.log('receiving rpc:', res)
      res = BSON.decode(JSON.parse(utf8.decode(res)))
      return res
    }
    socket.on('message', evt => {
		  peer.receive(evt)
		})
    peer.send = data => {
      socket.send(data)
    }
    peer.close = function (err) {
      if (peer.closed) return
      peer.closed = true
      socket.close()
      peer.constructor.prototype.close.call(peer)
      peer.dispatchEvent(new Event('close'))
    }
    socket.on('open', () => {
      peer.dispatchEvent(new Event('ready'))
    })
    return peer
  }


  listen () {
    if (this.listening) return
    this.listening = true
    this.server = new WebSocket.Server({ port: this.port, host: this.host }, err => {
      if (err) {
        throw err
      } else {
        this.dispatchEvent(new Event('listen'))
      }
    })
    this.server.on('connection', this.accept)
  }

  accept = socket => {
    var peer = this.setupPeer(socket)
    this.dispatchEvent(new CustomEvent('accept', { detail: peer }))
  }


  close () {
    if (!this.listening) return
    this.listening = false
    this.server.removeEventListener('connection', this.accept)
    this.server.close()
    delete this.server
  }
}

export default TransportWs
