module.exports = Hyperbase
module.exports.Client = require('./client')

function Hyperbase (path, client) {
  if (!(this instanceof Hyperbase)) {
    return new Hyperbase(path, client)
  }

  if (typeof path !== 'string') {
    client = path
    path = null
  }

  this.path = path || ''
  var parts = this.path.split('/')
  this.key = parts.slice(-1)[0]

  this._client = client
}

Hyperbase.prototype.parent = function () {
  var parts = this.path.split('/')
  parts.pop()
  return new Hyperbase(parts.join('/'), this._client)
}

Hyperbase.prototype.child = function (key) {
  return new Hyperbase(this.path ? (this.path + '/' + key) : key, this._client)
}

Hyperbase.prototype.on = function (eventType, handler, cb) {
  var eventTypes = this._client._listeners[this.path] = this._client._listeners[this.path] || {}
  var handlers = eventTypes[eventType] = eventTypes[eventType] || []
  handlers.push(handler)

  if (handlers.length === 1) {
    this._client.send({
      name: 'on',
      path: this.path,
      type: eventType,
      cb: cb && this._client.registerCallback(cb)
    })
  } else {
    cb && cb()
    var cachedForPath = this._client._cache[this.path]
    if (cachedForPath) {
      var cachedForEvent = cachedForPath[eventType]
      if (cachedForEvent !== undefined) {
        this._client.dispatchEvent({
          type: eventType,
          path: this.path,
          body: cachedForEvent
        }, handler)
      }
    }
  }
}

Hyperbase.prototype.once = function (eventType, handler, cb) {
  var self = this
  var originalHandler = handler

  handler = function () {
    self.off(eventType, handler)
    originalHandler.apply(null, arguments)
  }

  this.on(eventType, handler, cb)
}

Hyperbase.prototype.off = function (eventType, handler, cb) {
  var eventTypes = this._client._listeners[this.path]
  if (eventTypes) {
    var handlers = eventTypes && eventTypes[eventType]
    if (handlers) {
      eventTypes[eventType] = handlers.filter(function (h) {
        if (handler && handler !== h) {
          return true
        } else {
          h.cancelled = true
          return false
        }
      })

      if (eventTypes[eventType].length === 0) {
        delete eventTypes[eventType]
        if (Object.keys(eventTypes).length === 0) {
          delete this._client._listeners[this.path]
        }

        var cachedForPath = this._client._cache[this.path]
        if (cachedForPath) {
          delete cachedForPath[eventType]
          if (Object.keys(cachedForPath).length === 0) {
            delete this._client._cache[this.path]
          }
        }

        this._client.send({
          name: 'off',
          path: this.path,
          type: eventType,
          cb: cb && this._client.registerCallback(cb)
        })

        return
      }
    }
  }

  cb && cb()
}

Hyperbase.prototype.update = function (value, cb) {
  this._client.send({
    name: 'update',
    path: this.path,
    body: value,
    cb: cb && this._client.registerCallback(cb)
  })
}

Hyperbase.prototype.remove = function (cb) {
  this._client.send({
    name: 'remove',
    path: this.path,
    cb: cb && this._client.registerCallback(cb)
  })
}
