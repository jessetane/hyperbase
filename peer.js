import Rpc from 'rpc-engine/index.js'
import Event from 'xevents/event.js'
import CustomEvent from 'xevents/custom-event.js'

class HyperbasePeer extends Rpc {
  constructor (opts = {}) {
    super(opts)
    this.name = opts.name || (Math.random() + '').slice(2)
    this.timeout = opts.timeout || 1000
    this.database = opts.database
    this.authState = null 
    this.setInterface({ auth: this._auth })
  }

  auth () {
    if (this.authState === true || this.authenticating) return
    this.authenticating = true
    this.call('auth', this.database.name, (err, name) => {
      this.authenticating = false
      this.onauth(err, name)
    })
  }

  _auth (name, cb) {
    if (typeof cb !== 'function') return
    this.onauth(null, name, cb)
  }
  
  onauth (err, name, cb) {
    this.authState = null
    if (err) {
      err.data = { name }
    } else if (!name) {
      err = new Error('missing name')
    } else if (name === this.database.name) {
      err = new Error('peer is self')
    }
    if (err) {
      this.authState = err
    } else {
      this.authState = true
      this.name = name
    }
    this.dispatchEvent(new Event('auth'))
    if (this.authState === true) {
      this.setInterface({
        auth: this.auth,
        write: this.write,
        read: this.read,
        stream: this.stream,
        watch: this.watch,
        unwatch: this.unwatch
      })
      if (cb) cb(null, this.database.name)
    } else {
      this.setInterface({ auth: this._auth })
      if (this.authState instanceof Error === false) {
        this.authState = new Error('unknown auth error')
      }
      this.dispatchEvent(new CustomEvent('error', { detail: this.authState }))
      if (cb) cb(this.authState, this.database.name)
    }
  }

  write (batch, cb) {
    if (typeof cb !== 'function') cb = () => {}
		var err = null
		if (!this.self) {
			err = batch.find(res => {
				if (!res.id) return new Error('peers cannot create data')
			})
		}
    if (err) {
      cb(err)
    } else {
      this.database.write(batch, cb)
    }
  }

  read (path, opts, cb) {
		if (typeof opts === 'function') {
		  cb = opts
			opts = {}
		} else if (typeof cb !== 'function') {
			cb = () => {}
		}
		if (!opts) {
			opts = { decode: this.self }
		} else if (!this.self) {
			delete opts.decode
		}
    this.database.read(...arguments)
  }

  stream (path, streamId, opts, cb) {
	  if (typeof opts === 'function') {
			cb = opts
			opts = {}
		} else if (typeof cb !== 'function') {
			cb = () => {}
		}
    if (!streamId || typeof streamId !== 'string') {
      cb(new Error('bad stream id'))
      return
    }
		if (!opts) {
			opts = { decode: this.self }
		} else if (!this.self) {
			delete opts.decode
		}
    try {
      var stream = this.database.stream(path, opts)
    } catch (err) {
      cb(err)
      return
    }
    stream.addEventListener('data', evt => this.call(`${streamId}.data`, evt.detail))
    stream.addEventListener('error', evt => this.call(`${streamId}.error`, evt.detail))
    stream.addEventListener('end', () => this.call(`${streamId}.end`))
    cb()
  }
  
  watch (paths, cb) {
    if (typeof cb !== 'function') cb = () => {}
    try {
      this.database.watch(paths, this, req => {
        this.call('write', req, err => {
          if (err) {
            // XXX TODO FIXME
            console.error('peer.watch: failed to write', this.name)
          }
        })
      })
    } catch (err) {
      cb(err)
      return
    }
    cb()
  }

  unwatch (paths, cb) {
    if (typeof cb !== 'function') cb = () => {}
    try {
      this.database.unwatch(paths, this)
    } catch (err) {
      cb(err)
      return
    }
    cb()
  }
}

export default HyperbasePeer
