module.exports = Client

var inherits = require('inherits')
var TerminalStream = require('terminal-stream')

inherits(Client, TerminalStream)

function Client () {
  if (!(this instanceof Client)) {
    return new Client()
  }

  this._listeners = {}
  this._callbacks = {}
  this._cache = {}
  this._queue = []

  TerminalStream.call(this, this.onmessage)
}

Client.prototype.send = function (message) {
  TerminalStream.prototype.send.call(this, JSON.stringify(message))
}

Client.prototype.onmessage = function (message) {
  message = JSON.parse(message)

  switch (message.name) {
    case 'cb':
      var cb = this._callbacks[message.id]
      if (cb) {
        cb.call(null, message.body ? new Error(message.body) : null)
        delete this._callbacks[message.id]
      }
      break
    case 'ev':
      this._updateCache(message)
      this.dispatchEvent(message)
      break
  }
}

Client.prototype._updateCache = function (message) {
  var cachedForPath = this._cache[message.path] = this._cache[message.path] || {}
  if (message.type === 'key_added') {
    var children = cachedForPath[message.type]
    if (children && message.body.length) {
      cachedForPath[message.type] = children.concat(message.body)
    } else {
      cachedForPath[message.type] = message.body
    }
  } else if (message.type === 'key_removed') {
    var children = cachedForPath[message.type]
    if (children) {
      for (var i in message.body) {
        var child = message.body[i]
        children = cachedForPath[message.type] = children.filter(function (key) { return key !== child })
      }
    }
  } else {
    cachedForPath[message.type] = message.body || null
  }
}

Client.prototype.dispatchEvent = function (evt, handler) {
  if (handler) {
    evt.handlers = [ handler ]
  } else {
    var eventTypes = this._listeners[evt.path]
    var handlers = eventTypes && eventTypes[evt.type]
    evt.handlers = handlers && handlers.slice()
  }

  this._queue.push(evt)

  setTimeout(function () {
    evt = this.shift()
    evt.handlers.forEach(function (h) {
      if (h.cancelled) return
      if (evt.type === 'value') {
        h(evt.body || null)
      } else {
        if (evt.type === 'key_added' && !evt.body.length) {
          h(null)
        } else {
          for (var i in evt.body) {
            h(evt.body[i])
          }
        }
      }
    })
  }.bind(this._queue))
}

Client.prototype.registerCallback = function (cb) {
  var id = (Math.random() + '').slice(2)
  if (this._callbacks[id]) {
    return this._registerCallback(cb)
  } else {
    this._callbacks[id] = cb
    return id
  }
}
