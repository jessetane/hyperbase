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

Hyperbase.prototype.on = function (eventType, listener, cb) {
  var lookup = this.path + ':' + eventType
  var listeners = this._client._listeners[lookup]
  var pending = this._client._pending[lookup]

  if (!listeners && !pending) {
    this._client._pending[lookup] = true

    var cbwrap = function (err) {
      delete this._client._pending[lookup]
      if (err) return cb && cb(err)
      this._client._listeners[lookup] = listeners || []
      this._client._listeners[lookup].push(listener)
      cb && cb()
    }.bind(this)

    this._client.send({
      method: 'on',
      params: {
        path: this.path,
        type: eventType
      },
      id: this._client.registerCallback(cbwrap)
    })
  } else {
    cb && cb()
    var cached = this._client._cache[lookup]
    if (cached !== undefined) {
      this._client.dispatchEvent({
        type: eventType,
        path: this.path,
        data: cached
      }, listener)
    }
  }
}

Hyperbase.prototype.once = function (eventType, listener, cb) {
  var self = this
  var originalListener = listener

  listener = function () {
    self.off(eventType, listener)
    originalListener.apply(null, arguments)
  }

  this.on(eventType, listener, cb)
}

Hyperbase.prototype.off = function (eventType, listener, cb) {
  var lookup = this.path + ':' + eventType
  var listeners = this._client._listeners[lookup]
  if (listeners) {
    this._client._listeners[lookup] = listeners = listeners.filter(function (l) {
      if (listener && listener !== l) {
        return true
      } else {
        l.cancelled = true
        return false
      }
    })

    if (listeners.length === 0) {
      delete this._client._listeners[lookup]
      delete this._client._cache[lookup]

      this._client.send({
        method: 'off',
        params: {
          path: this.path,
          type: eventType
        },
        id: cb && this._client.registerCallback(cb)
      })

      return
    }
  }

  cb && cb()
}

Hyperbase.prototype.update = function (value, cb) {
  this._client.send({
    method: 'update',
    params: {
      path: this.path,
      data: value
    },
    id: cb && this._client.registerCallback(cb)
  })
}

Hyperbase.prototype.remove = function (cb) {
  this._client.send({
    method: 'remove',
    params: {
      path: this.path
    },
    id: cb && this._client.registerCallback(cb)
  })
}
