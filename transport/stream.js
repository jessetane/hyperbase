import net from 'net'
import TerminalStream from 'terminal-stream'
import { pack, unpack } from 'msgpackr'
import Peer from '../peer.js'
import { Deferred } from '../util.js'

class TransportStream extends EventTarget {
	static connect (socket, opts = {}) {
		const p = new Deferred()
		const peer = this.setupPeer(socket)
		peer.reconnectTimeout = opts.reconnectTimeout || 5 * 1000
		peer.promise = p
		return opts.nowait ? peer : peer.promise
	}

	static setupPeer (socket, peer) {
		// unix/tcp socket
		socket.on('error', onclose)
		socket.on('close', onclose)
		const Class = this
		function onclose (err) {
			peer.send = null
			stream._send = null
			socket.removeListener('data', stream.receive)
			socket.removeListener('error', onclose)
			socket.removeListener('close', onclose)
			stream.removeEventListener('message', peer.receive)
			peer.dispatchEvent(new CustomEvent('disconnect', { detail: err }))
			if (peer.closed) return
			if (peer.reconnectTimeout) {
				peer.reconnectTimer = setTimeout(() => {
					const socket = Class.createSocket(peer)
					Class.setupPeer(socket, peer)
				}, peer.reconnectTimeout)
			} else {
				peer.close(err)
			}
		}
		// message stream
		const stream = new TerminalStream()
		stream.send = stream.send.bind(stream)
		stream.receive = stream.receive.bind(stream)
		stream._send = socket.write.bind(socket)
		socket.on('data', stream.receive)
		// rpc interface
		if (!peer) {
			peer = new Peer()
			peer.serialize = pack
			peer.deserialize = unpack
			peer.close = function (err) {
				if (peer.closed) return
				peer.closed = true
				clearTimeout(peer.reconnectTimer)
				peer.socket?.destroy(err)
				peer.promise?.reject(err)
				peer.constructor.prototype.close.call(peer)
				peer.dispatchEvent(new Event('close'))
			}
		}
		peer.socket = socket
		peer.send = stream.send
		stream.addEventListener('message', evt => {
			peer.receive(evt.data)
		})
		socket.on('connect', () => {
			peer.promise?.resolve(peer)
			peer.dispatchEvent(new Event('connect'))
		})
		return peer
	}

	listen () {
		if (this.listening) return
		this.listening = true
		this.server = new net.Server()
		this.server.on('connection', this.accept)
		return new Deferred()
	}

	accept = socket => {
		const peer = this.constructor.setupPeer(socket)
		peer.database = this.database
		this.dispatchEvent(new CustomEvent('accept', { detail: peer }))
	}

	close () {
		if (!this.listening) return
		this.listening = false
		this.server.removeListener('connection', this.accept)
		this.server.close()
		delete this.server
	}
}

export default TransportStream
