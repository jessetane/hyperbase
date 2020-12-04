import EventTarget from 'xevents/event-target.js'
import CustomEvent from 'xevents/custom-event.js'

function random () {
  return (Math.random() + '').slice(2)
}

function P (cb) {
  var res = null
  var rej = null
  var p = new Promise((a, b) => {
    res = a
    rej = b
  })
	if (typeof cb === 'function') {
		p = p.then(() => cb(null, ...arguments)).catch(cb)
	}
  p.resolve = res
  p.reject = rej
  return p
}

function unicodeShift (string, shift) {
  var unicode = Array.from(string)
  var last = unicode.length - 1
  unicode[last] = String.fromCodePoint(unicode[last].codePointAt(0) + shift)
  return unicode.join('')
}

class Hyperbase extends EventTarget {
  constructor (opts = {}) {
    super()
    this.name = opts.name || random()
    this.store = opts.store
    this.codecs = opts.codecs || {}
    this.timeout = opts.timeout || 1000
    this.pathDelimiter = opts.pathDelimiter || '/'
    this.pathWildcard = opts.pathWildcard || '*'
    this.messageLifetime = opts.messageLifetime || 1000 * 15
    this.messages = {}
    this.queue = []
    this.watchers = { children: new Map() }
    this.addEventListener('write', this.onwrite.bind(this))
  }

  run () {
    if (this.running || this.queue.length === 0) return
    this.running = true
    var job = this.queue.shift()
    var cb = this.queue.shift()
    var self = this
    var timeout = setTimeout(() => {
      done(new Error('timed out'))
    }, this.timeout)
    job(done)
    function done () {
      if (timeout === null) return
      clearTimeout(timeout)
      timeout = null
      self.running = false
      cb.apply(null, arguments)
      self.run()
      // queueMicrotask(() => self.run())
    }
  }

  async write (batch, cb) {
    var p = new P(cb)
    if (!Array.isArray(batch)) {
      p.reject(new Error('batch must be an array'))
      return p
    }
    var self = this
    var q = []
    var dupes = {}
    var filtered = []
    var now = null
    var err = null
		batch.find((req, i) => {
      if (req.id) {
        if (now === null) {
          now = +new Date()
          for (var id in this.messages) {
            var then = this.messages[id]
            if (now - then > this.messageLifetime) {
              delete this.messages[id]
            }
          }
        }
        if (this.messages[req.id]) {
          return
        } else {
          this.messages[req.id] = now
        }
      }
      filtered.push(req)
      var path = this.normalizePath(req.path)
      if (!path || path.length === 0) {
        err = new Error('invalid path')
				return true
      }
      req.path = path
      var codecName = path[path.length - 1].split('.')[0]
      var codec = this.codecs[codecName]
      if (!codec) {
        err = new Error('unknown codec ' + codecName)
				return true
      }
      q.push(cb => {
        if (req.id) {
          this.store.read(req.path, (err, res) => {
            if (err) return cb(err)
            if (res.data !== undefined) {
              req.existingData = res.data
            }
            codec.write(req, cb)
          })
        } else {
          codec.write(req, err => {
            if (err) return cb(err)
            req.id = random()
            if (now === null) now = +new Date()
            this.messages[req.id] = now
            cb(null, req)
          })
        }
      })
    })
    if (err) {
      p.reject(err)
      return p
    }
    batch = filtered
    if (batch.length === 0) {
      p.resolve(batch)
      return p
    }
    this.queue.push(cb => {
      var n = q.length
      q.forEach(job => {
        job((err, req) => {
          if (!cb) return
          if (err) {
            cb(err)
            cb = null
          } else {
            var hash = JSON.stringify(req.path)
            if (dupes[hash]) {
              cb(new Error(`${hash} path can only be written once per batch`))
              cb = null
              return
            } else {
              dupes[hash] = true
            }
            if (--n === 0) {
              cb()
              cb = null
            }
          }
        })
      })
    }, err => {
      if (err) {
        p.reject(err)
        return
      }
      this.queue.unshift(cb => this.store.write(batch, cb), done)
    })
    this.run()
    function done (err) {
      if (err) {
        p.reject(err)
      } else {
        p.resolve(batch)
        queueMicrotask(() => {
          self.dispatchEvent(new CustomEvent('write', { detail: batch }))
        })
      }
    }
    return p
  }

  async read (path, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    } else if (opts === undefined) {
      opts = {}
    }
    var p = new P(cb)
    if (!opts || typeof opts !== 'object') {
      p.reject(new Error('read: invalid options'))
      return p
    }
    path = this.normalizePath(path)
    if (!path || path.length === 0) {
      p.reject(new Error('invalid path'))
      return p
    }
    this.store.read(path, (err, res) => {
      if (err) {
        p.reject(err)
        return
      }
      if (res.data === undefined || !opts.decode) {
        p.resolve(res)
      } else {
        var codecName = path[path.length - 1].split('.')[0]
        var codec = this.codecs[codecName]
        if (!codec) {
          p.reject(new Error('unknown codec ' + codecName))
          return
        }
        for (var key in opts) {
          res[key] = opts[key]
        }
        codec.read(res, err => {
          if (err) r.reject(err)
          else r.resolve(res)
        })
      }
    })
    return p
  }

  stream (path = [], opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new Error('stream: invalid options ' + JSON.stringify(opts))
    }
    path = this.normalizePath(path, true)
    // console.log('valid?', path, opts)
    if (!path || path.length === 0) {
      throw new Error('invalid path')
    }
    if (path[path.length - 2] === null) {
      if (opts.gt) opts.gt = unicodeShift(opts.gt, 1)
      if (opts.lte) opts.lte = unicodeShift(opts.lte, 1)
    }
    var stream = new EventTarget()
    this.store.stream(path, opts, res => {
      if (res === undefined) {
        stream.dispatchEvent(new CustomEvent('end'))
        return
      }
      if (!opts.decode) {
        stream.dispatchEvent(new CustomEvent('data', { detail: res }))
      } else {
        var codecName = res.path[res.path.length - 1].split('.')[0]
        var codec = this.codecs[codecName]
        if (!codec) {
          stream.dispatchEvent(new CustomEvent('error', { detail: new Error('unknown codec ' + codecName) }))
          return
        }
        for (var key in opts.readOpts) {
          res[key] = opts.readOpts[key]
        }
        codec.read(res, err => {
          if (err) {
            stream.dispatchEvent(new CustomEvent('error', { detail: err }))
          } else {
            stream.dispatchEvent(new CustomEvent('data', { detail: res }))
          }
        })
      }
    })
    return stream
  }

  watch (paths, listener, fn) {
    if (!Array.isArray(paths)) paths = [paths]
    paths = paths.map(path => {
      path = this.normalizePath(path, true)
      if (!path) throw new Error('invalid path')
      return path
    })
    paths.forEach(path => {
      var len = path.length
      var i = 0
      var head = this.watchers
      while (i < len) {
        var p = path[i++]
        var watcher = head.children.get(p)
        if (!watcher) {
          watcher = {
            children: new Map(),
            listeners: new Map() 
          }
          head.children.set(p, watcher)
        }
        head = watcher
      }
      watcher.listeners.set(listener, fn)
    })
  }

  unwatch (paths, listener) {
    if (!Array.isArray(paths)) paths = [paths]
    paths = paths.map(path => {
      path = this.normalizePath(path, true)
      if (!path) throw new Error('invalid path')
      return path
    })
    paths.forEach(path => {
      var len = path.length
      var i = 0
      var head = this.watchers
      var watchers = []
      while (i < len) {
        var p = path[i++]
        var watcher = head.children.get(p)
        if (!watcher) return
        watchers.push(watcher)
        head = watcher
      }
      watcher.listeners.delete(listener)
      var i = len - 1
      while (i > 0) {
        p = path[i]
        watcher = watchers[i]
        if (watcher.listeners.size > 0) return
        head = watchers[i - 1]
        head.children.delete(p)
        i--
      }
    })
  }

  onwrite (evt) {
    var batch = evt.detail
    batch.forEach(req => {
      var heads = [this.watchers]
      var path = req.path
      var len = path.length
      var i = 0
      while (i < len) {
        var p = path[i]
        var newHeads = []
        heads.forEach(head => {
          var children = head.children
          if (!children) return
          var exact = children.get(p)
          if (exact) newHeads.push(exact)
          var wild = children.get(null)
          if (wild) newHeads.push(wild)
        })
        if (!newHeads.length) return
        heads = newHeads
        i++
      }
      heads.forEach(watcher => {
        watcher.listeners.forEach((fn, listener) => {
          if (req.source === listener.name) return
          req = Object.assign({}, req, { source: this.name })
          fn(req)
        })
      })
    })
  }

  normalizePath (path, allowWild) {
    if (typeof path === 'string') {
      path = path.split(this.pathDelimiter)
    }
    path = path.map(part => part === this.pathWildcard ? null : part)
    var i = 0
    var wild = false
    while (i < path.length) {
      var part = path[i]
      if (part === null) {
        if (allowWild) {
          wild = true
        } else {
          return
        }
      } else if (wild) {
        return
      }
      i++
    }
    return path
  }
}

export default Hyperbase
