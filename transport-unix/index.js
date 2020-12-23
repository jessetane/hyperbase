import EventTarget from 'xevents/event-target.js'
import Event from 'xevents/event.js'
import CustomEvent from 'xevents/custom-event.js'
import fs from 'fs'
import unix from 'net'
import TerminalStream from 'terminal-stream'
import HyperbasePeer from 'hyperbase/peer.js'
import utf8 from 'utf8-transcoder'
import BSON from 'hyperbase/bson.js'

class HyperbaseTransportUnix extends EventTarget {
  constructor (opts = {}) {
    super()
    this.accept = this.accept.bind(this)
		this.socket = opts.socket || '/tmp/hyperbase.sock'
	}

  listen () {
    if (this.listening) return
    this.listening = true
    this.server = new unix.Server()
    this.server.on('connection', this.accept)
		fs.unlink(this.socket, err => {
			this.server.listen(this.socket, err => {
				if (err) {
					throw err
				} else {
					this.dispatchEvent(new Event('listen'))
				}
			})
		})
  }

  accept (socket) {
    var peer = this.setupPeer(socket)
    this.dispatchEvent(new CustomEvent('accept', { detail: peer }))
    peer.dispatchEvent(new Event('ready'))
  }

  connect (file = '/tmp/hyperbase.sock') {
    var socket = unix.connect(file)
    var peer = this.setupPeer(socket)
    peer.address = 'unix|' + file
    socket.on('connect', () => {
      peer.dispatchEvent(new Event('ready'))
    })
    return peer
  }

  setupPeer (socket) {
    socket.on('error', onclose)
    socket.on('close', onclose)
    function onclose (err) {
      stream._send = null
      socket.removeListener('data', stream.receive)
      socket.removeListener('error', onclose)
      socket.removeListener('close', onclose)
      peer.send = null
      stream.removeEventListener('message', peer.receive)
      if (err) {
        peer.dispatchEvent(new CustomEvent('error', { detail: err }))
      }
      peer.close()
    }
    // message stream
    var stream = new TerminalStream()
    stream.send = stream.send.bind(stream)
    stream.receive = stream.receive.bind(stream)
    stream._send = socket.write.bind(socket)
    socket.on('data', stream.receive)
    // rpc interface
    var peer = new HyperbasePeer()
		peer.self = true
    peer.address = 'unix|' + peer.name
    peer.serialize = req => {
      //console.log('sending rpc:', req)
      req = utf8.encode(JSON.stringify(BSON.encode(req)))
      return req
    }
    peer.deserialize = res => {
      //console.log('receiving rpc:', res)
      res = BSON.decode(JSON.parse(utf8.decode(res)))
      return res
    }
    peer.send = stream.send
    stream.addEventListener('message', evt => {
      peer.receive(evt.detail)
    })
    peer.close = function (err) {
      if (peer.closed) return
      peer.closed = true
      socket.destroy()
      peer.constructor.prototype.close.call(peer)
      peer.dispatchEvent(new Event('close'))
    }
    return peer
  }

  close () {
    if (!this.listening) return
    this.listening = false
    this.server.removeEventListener('connection', this.accept)
    this.server.close()
    delete this.server
  }
}

export default HyperbaseTransportUnix
