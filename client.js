module.exports = Client

var inherits = require('inherits')
var TerminalStream = require('terminal-stream')

inherits(Client, TerminalStream)

function Client (opts) {
  if (!(this instanceof Client)) {
    return new Client(opts)
  }

  this.timeout = opts && opts.timeout || 2500
  this._session = this._session ? ++this._session : 1
  this._pending = {}
  this._listeners = this._listeners || {}
  this._callbacks = this._callbacks || {}
  this._cache = this._cache || {}
  this._queue = this._queue || []

  this.once('unpipe', this._reset.bind(this))

  TerminalStream.call(this, this.onmessage)
}

Client.prototype.send = function (message) {
  var cbid = message.cb = message.cb || this.registerCallback(noop)

  TerminalStream.prototype.send.call(this, JSON.stringify(message))

  setupTimeout.call(this, this._session)

  function setupTimeout (session) {
    if (this._callbacks[cbid]) {
      if (session === this._session) {
        setTimeout(setupTimeout.bind(this, session), this._timeout)
      } else {
        this.send(message)
      }
    }
  }
}

Client.prototype.onmessage = function (message) {
  message = JSON.parse(message)

  if (message.id) {
    var cb = this._callbacks[message.id]
    if (cb) {
      cb.call(message.error ? new Error(message.error) : null)
      delete this._callbacks[message.id]
    }
  } else if (message.method === 'event') {
    if (this._updateCache(message.params)) {
      this.dispatchEvent(message.params)
    }
  }
}

Client.prototype._updateCache = function (params) {
  var lookup = params.path + ':' + params.type
  var cached = this._cache[lookup]
  var didUpdate = false

  if (params.type === 'key_added') {
    if (cached && params.data.length) {
      this._cache[lookup] = cached.concat(params.data)
      didUpdate = cached && cached.length !== this._cache[lookup].length
    } else {
      this._cache[lookup] = params.data
      didUpdate = cached !== this._cache[lookup]
    }
  } else if (params.type === 'key_removed') {
    if (cached) {
      for (var i in params.data) {
        var key = params.data[i]
        this._cache[lookup] = cached = cached.filter(function (k) {
          if (k === key) {
            didUpdate = true
            return false
          } else {
            return true
          }
        })
      }
    } else {
      didUpdate = true
    }
  } else {
    this._cache[lookup] = params.data || null
    didUpdate = cached !== this._cache[lookup]
  }

  return didUpdate
}

Client.prototype.dispatchEvent = function (evt, listener) {
  var lookup = evt.path + ':' + evt.type

  if (listener) {
    evt.listeners = [ listener ]
  } else {
    var listeners = this._listeners[lookup]
    evt.listeners = listeners && listeners.slice()
  }

  this._queue.push(evt)

  setTimeout(function () {
    evt = this.shift()
    evt.listeners && evt.listeners.forEach(function (l) {
      if (l.cancelled) return
      if (evt.type === 'value') {
        l(evt.data || null)
      } else {
        if (evt.type === 'key_added' && !evt.data.length) {
          l(null)
        } else {
          for (var i in evt.data) {
            l(evt.data[i])
          }
        }
      }
    })
  }.bind(this._queue))
}

Client.prototype.registerCallback = function (cb) {
  var id = (Math.random() + '').slice(2)
  if (this._callbacks[id]) {
    return this.registerCallback(cb)
  } else {
    this._callbacks[id] = cb
    return id
  }
}

Client.prototype.pipe = function () {
  var dest = TerminalStream.prototype.pipe.apply(this, arguments)

  for (var lookup in this._listeners) {
    var sep = lookup.lastIndexOf(':')
    var path = lookup.slice(0, sep)
    var type = lookup.slice(sep + 1)

    this.send({
      method: 'on',
      params: {
        path: path,
        type: type
      }
      // XXX handle errors here?
    })
  }

  return dest
}

Client.prototype._reset = function () {
  this.end()
  Client.call(this)
}

function noop () {}
