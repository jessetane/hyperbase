import Rpc from 'rpc-engine/index.js'
import Event from 'xevents/event.js'
import EventTarget from 'xevents/event-target.js'
import CustomEvent from 'xevents/custom-event.js'

class HyperbasePeer extends Rpc {
  constructor (opts = {}) {
    super(opts)
    this.name = opts.name || Math.random().toString().slice(2)
    this.timeout = opts.timeout || 1000
    this.database = opts.database
    this.authState = null 
    this.setInterface({ auth: this._auth })
  }

  _auth (name, cb) {
    if (typeof cb !== 'function') return
    this._onauth(null, name, cb)
  }

  _onauth (err, name, cb) {
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
    this.dispatchEvent(new Event('shouldauth'))
    if (this.authState === true) {
      this.setInterface({
        write: this._write,
        read: this._read,
        stream: this._stream,
        watch: this._watch,
        unwatch: this._unwatch
      })
      if (cb) cb(null, this.database.name)
      this.dispatchEvent(new Event('auth'))
    } else {
      this.setInterface({ auth: this._auth })
      if (this.authState instanceof Error === false) {
        this.authState = new Error('unknown auth error')
      }
      this.dispatchEvent(new CustomEvent('error', { detail: this.authState }))
      if (cb) cb(this.authState, this.database.name)
    }
  }

  _write (path, data, cb) {
    if (data !== undefined && typeof data !== 'function') {
      var batch = [{ path, data }]
    } else {
      if (Array.isArray(path)) {
        batch = path
      } else {
        batch = [path]
      }
      cb = data
    }
    var err = null
    if (!this.self) {
      err = batch.find(res => {
        if (!res.id) return new Error('peers cannot create data')
      })
    }
    if (err) {
      if (cb) cb(err)
    } else {
      this.database.write(batch, err => {
        if (!cb) return
        if (err) cb(err)
        else cb()
      })
    }
  }

  _read (path, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    if (opts && !this.self) {
      delete opts.decode
    }
    this.database.read(...arguments)
  }

  _stream (path, streamId, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    } else if (typeof cb !== 'function') {
      cb = () => {}
      if (!this.self) {
        delete opts.decode
      }
    }
    if (!streamId || typeof streamId !== 'string') {
      cb(new Error('bad stream id'))
      return
    }
    try {
      var stream = this.database.stream(path, opts)
    } catch (err) {
      cb(err)
      return
    }
    stream.addEventListener('data', evt => this.call(`${streamId}.data`, evt.detail))
    stream.addEventListener('end', () => this.call(`${streamId}.end`))
    stream.addEventListener('error', evt => {
      var err = evt.detail
      var error = {}
      if (err.message) error.message = err.message
      if (err.code) error.code = err.code
      if (err.data) error.data = err.data
      this.call(`${streamId}.error`, error)
    })
    cb()
  }
  
  _watch (paths, cb) {
    if (typeof cb !== 'function') cb = () => {}
    try {
      this.database.watch(paths, this, msg => {
        if (!this.self) delete msg.rawData
        this.call('write', msg, err => {
          if (err) {
            // XXX TODO FIXME
            console.error('peer.watch: failed to write', this.name, err)
          }
        })
      })
    } catch (err) {
      cb(err)
      return
    }
    cb()
  }

  _unwatch (paths, cb) {
    if (typeof cb !== 'function') cb = () => {}
    try {
      this.database.unwatch(paths, this)
    } catch (err) {
      cb(err)
      return
    }
    cb()
  }

  auth () {
    if (this.authState === true || this.authenticating) return
    this.authenticating = true
    this.call('auth', this.database.name, (err, name) => {
      this.authenticating = false
      this._onauth(err, name)
    })
  }

  write () {
    return new Promise((res, rej) => {
      this.call('write', ...arguments, err => {
        if (err) rej(err)
        else res()
      })
    })
  }

  read () {
    return new Promise((res, rej) => {
      this.call('read', ...arguments, (err, r) => {
        if (err) rej(err)
        else res(r)
      })
    })
  }

  watch () {
    return new Promise((res, rej) => {
      this.call('watch', ...arguments, err => {
        if (err) rej(err)
        else res()
      })
    })
  }

  unwatch () {
    return new Promise((res, rej) => {
      this.call('unwatch', ...arguments, err => {
        if (err) rej(err)
        else res()
      })
    })
  }

  stream (path, opts = {}) {
    var s = new EventTarget()
    var id = Math.random().toString().slice(2)
    this.call('stream', path, id, opts, err => {
      if (err) return s.dispatchEvent(new CustomEvent('error', { detail: err }))
      var timeout = setTimeout(() => {
        this.setInterface(id, null)
        s.dispatchEvent(new CustomEvent('error', { detail: new Error('timed out') }))
      }, opts.timeout || this.timeout || 1000)
      this.setInterface(id, {
        data: entry => {
          s.dispatchEvent(new CustomEvent('data', { detail: entry }))
        },
        end: () => {
          clearTimeout(timeout)
          this.setInterface(id, null)
          s.dispatchEvent(new Event('end'))
        }
      })
    })
    return s
  }

  page (path, opts) {
    return new Promise((res, rej) => {
      var id = Math.random().toString().slice(2)
      var items = []
      this.call('stream', path, id, opts, err => {
        if (err) return rej(err)
        var timeout = setTimeout(() => {
          this.setInterface(id, null)
          rej(new Error('timed out'))
        }, opts.timeout || this.timeout || 1000)
        this.setInterface(id, {
          data: item => items.push(item),
          end: () => {
            clearTimeout(timeout)
            this.setInterface(id, null)
            res(items)
          }
        })
      })
    })
  }

  clear (path, opts) {
    return new Promise((res, rej) => {
      var id = Math.random().toString().slice(2)
      var i = 0
      var n = 0
      var ended = false
      this.call('stream', path, id, opts, err => {
        if (err) return rej(err)
        var timeout = setTimeout(() => {
          timeout = null
          this.setInterface(id, null)
          rej(new Error('timed out'))
        }, opts.timeout || this.timeout || 1000)
        this.setInterface(id, {
          data: item => {
            i++
            n++
            this.write(item.path, null).then(() => {
              if (timeout === null) return
              if (--n > 0) return
              if (ended) res(i)
            }).catch(err => {
              if (timeout === null) return
              clearTimeout(timeout)
              timeout = null
              this.setInterface(id, null)
              rej(err)
            })
          },
          end: () => {
            clearTimeout(timeout)
            this.setInterface(id, null)
            ended = true
          }
        })
      })
    })
  }
}

export default HyperbasePeer
