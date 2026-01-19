import Rpc from 'rpc-engine/index.js'

class Peer extends Rpc {
	constructor (opts = {}) {
		super(opts)
		this.database = opts.database
		this.insecureErrors = true
		this.methods = {
			write: this._write,
			read: this._read,
			list: this._list
		}
	}

	write () {
		return this.call('write', ...arguments)
	}

	_write () {
		return this.database.write(...arguments)
	}
	
	read () {
		return this.call('read', ...arguments)
	}

	_read () {
		return this.database.read(...arguments)
	}

	list () {
		return this.call('list', ...arguments)
	}

	_list () {
		return this.database.list(...arguments)
	}
}

export default Peer
