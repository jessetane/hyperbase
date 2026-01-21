import fs from 'fs'
import net from 'net'
import TransportStream from './stream.js'

class TransportUnix extends TransportStream {
	constructor (opts = {}) {
		super()
		this.database = opts.database
		this.file = opts.file || '/tmp/hyperbase.sock'
	}

	static createSocket (opts = {}) {
		const socket = net.connect(opts.file)
		socket.meta = { file: opts.file }
		return socket
	}

	static connect (file = '/tmp/hyperbase.sock', opts = {}) {
		const socket = this.createSocket({ file })
		return super.connect(socket, opts)
	}

	static setupPeer (socket, peer) {
		peer = super.setupPeer(socket, peer)
		const file = socket.meta?.file || socket.server._pipeName
		peer.address = file
		peer.file = file
		return peer
	}

	listen () {
		const d = super.listen()
		if (d) {
			fs.unlink(this.file, err => {
				this.server.listen(this.file, err => {
					if (err) {
						d.reject(err)
					} else {
						this.dispatchEvent(new Event('listen'))
						d.resolve()
					}
				})
			})
		}
		return d
	}
}

export default TransportUnix
