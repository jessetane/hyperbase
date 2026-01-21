import net from 'net'
import TransportStream from './stream.js'

class TransportTcp extends TransportStream {
	constructor (opts = {}) {
		super()
		this.database = opts.database
		this.host = opts.host || '::1'
		this.port = opts.port || '3000'
	}

	static createSocket (opts = {}) {
		const socket = net.connect(opts.port, opts.host)
		socket.meta = { host: opts.host, port: opts.port }
		return socket
	}

	static connect (remoteAddress, opts = {}) {
		const parts = remoteAddress.split(':')
		const host = parts.slice(0, -1).join(':')
		const port = parts.at(-1)
		const socket = this.createSocket({ host, port })
		return super.connect(socket, opts)
	}

	static setupPeer (socket, peer) {
		peer = super.setupPeer(socket, peer)
		const host = socket.remoteAddress || socket.meta.host
		const port = socket.remotePort || socket.meta.port
		peer.address = host + ':' + port
		peer.host = host
		peer.port = port
		return peer
	}

	listen () {
		const d = super.listen()	
		if (d) {
			this.server.listen(this.port, this.host, err => {
				if (err) {
					d.reject(err)
				} else {
					this.dispatchEvent(new Event('listen'))
					d.resolve()
				}
			})
		}
		return d
	}
}

export default TransportTcp
