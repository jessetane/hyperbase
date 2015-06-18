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
      var eventTypes = this._listeners[message.path]
      var handlers = eventTypes && eventTypes[message.type]
      handlers && handlers.forEach(function (handler) {
        if (message.type === 'value') {
          handler.call(null, message.body)
        } else {
          for (var i in message.body) {
            handler(message.body[i])
          }
        }
      })
      var cachedForPath = this._cache[message.path] = this._cache[message.path] || {}
      if (message.type === 'key_removed') {
        var children = cachedForPath[message.type]
        if (children) {
          for (var i in message.body) {
            var child = message.body[i]
            children = cachedForPath[message.type] = children.filter(function (key) { return key !== child })
          }
        }
      } else {
        cachedForPath[message.type] = message.body
      }
      break
  }
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
