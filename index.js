var EventEmitter = require('events')
var HyperList = require('./list')
var HyperMap = require('./map')

module.exports = class Hyperbase extends EventEmitter {
  constructor (opts) {
    super()
    this.onerror = this.onerror.bind(this)
    this.onchange = this.onchange.bind(this)
    this.storage = opts.storage
    this.debounce = opts.debounce === undefined ? 25 : opts.debounce
    this.mounts = []
  }

  get loading () {
    return !!this.mounts.find(mount => mount.loading)
  }

  get loaded () {
    return !this.loading
  }

  mount (key, opts) {
    var Klass = opts.type === 'list' ? HyperList : HyperMap
    return new Klass(Object.assign({
      key,
      storage: this.storage,
      debounce: 0
    }, opts))
  }

  read (key, opts, cb) {
    if (!cb) {
      cb = opts
      opts = {}
    }
    var mount = this.mount(key, opts)
    mount.on('error', ondone)
    mount.on('change', onchange)
    return mount
    function ondone (err, data) {
      mount.removeListener('error', ondone)
      mount.removeListener('change', onchange)
      mount.unwatch()
      cb(err, data)
    }
    function onchange () {
      if (mount.loading) return
      if (mount.notFound) {
        ondone(new Error('not found'))
      } else {
        ondone(null, mount.denormalize())
      }
    }
  }

  watch (key, opts = {}) {
    var mount = this.mount(key, opts)
    mount.on('error', this.onerror)
    mount.on('change', this.onchange)
    this.mounts.push(mount)
    return mount
  }

  unwatch (mount) {
    mount.removeListener('error', this.onerror)
    mount.removeListener('change', this.onchange)
    mount.unwatch()
    this.mounts = this.mounts.filter(m => m !== mount)
  }

  write (patch, cb) {
    return this.storage.write(patch, cb)
  }

  create (n = 8) {
    var b = window.crypto.getRandomValues(new Uint8Array(n))
    return Array.from(b).map(c => c.toString(16)).join('')
  }

  denormalize () {
    return this.mounts.map(mount => mount.denormalize())
  }

  onerror (err) {
    this.emit('error', err)
  }

  onchange (evt) {
    HyperMap.prototype.onchange.call(this, evt)
  }
}
