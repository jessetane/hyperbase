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

  switch (message.name) {
    case 'cb':
      var cb = this._callbacks[message.id]
      if (cb) {
        cb.call(message.body ? new Error(message.body) : null)
        delete this._callbacks[message.id]
      }
      break
    case 'ev':
      if (this._updateCache(message)) {
        this.dispatchEvent(message)
      }
      break
  }
}

Client.prototype._updateCache = function (message) {
  var lookup = message.path + ':' + message.type
  var cached = this._cache[lookup]
  var didUpdate = false

  if (message.type === 'key_added') {
    if (cached && message.body.length) {
      this._cache[lookup] = cached.concat(message.body)
      didUpdate = cached && cached.length !== this._cache[lookup].length
    } else {
      this._cache[lookup] = message.body
      didUpdate = cached !== this._cache[lookup]
    }
  } else if (message.type === 'key_removed') {
    if (cached) {
      for (var i in message.body) {
        var key = message.body[i]
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
    this._cache[lookup] = message.body || null
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
    evt.listeners.forEach(function (l) {
      if (l.cancelled) return
      if (evt.type === 'value') {
        l(evt.body || null)
      } else {
        if (evt.type === 'key_added' && !evt.body.length) {
          l(null)
        } else {
          for (var i in evt.body) {
            l(evt.body[i])
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
      name: 'on',
      path: path,
      type: type
    })
  }

  return dest
}

Client.prototype._reset = function () {
  this.end()
  Client.call(this)
}

function noop () {}
