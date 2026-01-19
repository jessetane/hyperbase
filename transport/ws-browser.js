import Peer from '../peer.js'
import BSON from '../bson.js'
import { utf8, Deferred } from '../util.js'

class TransportWsBrowser extends EventTarget {
  static connect (url) {
    var socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
		socket.remoteUrl = url
    var peer = TransportWsBrowser.setupPeer(socket)
    peer.address = 'ws:' + url
    return peer
  }

  static setupPeer (socket) {
    socket.addEventListener('error', onclose)
    socket.addEventListener('close', onclose)
    function onclose (err) {
      socket.removeEventListener('error', onclose)
      socket.removeEventListener('close', onclose)
      // socket.removeEventListener('message', peer.receive)
      peer.send = null
      if (err) {
        peer.dispatchEvent(new CustomEvent('error', { detail: err }))
      }
      peer.close()
    }
    // rpc interface
    var peer = new HyperbasePeer()
    peer.address = 'ws:' + socket.remoteUrl
    peer.serialize = req => {
      // console.log('sending rpc:', req)
      req = new Uint8Array(utf8.encode(JSON.stringify(BSON.encode(req))))
      return req
    }
    peer.deserialize = res => {
      // console.log('receiving rpc:', res)
      res = BSON.decode(JSON.parse(utf8.decode(new Uint8Array(res))))
      return res
    }
    socket.addEventListener('message', evt => {
      peer.receive(evt.data)
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
    socket.addEventListener('open', () => {
      peer.dispatchEvent(new Event('ready'))
    })
    return peer
  }
}

export default TransportWsBrowser
