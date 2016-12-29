var EventEmitter = require('events')
var HList = require('./list')
var HMap = require('./map')

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

  load (key, opts) {
    var Klass = opts.type === 'list' ? HList : HMap
    var mount = new Klass(Object.assign({
      key,
      storage: this.storage,
      debounce: 0
    }, opts))
    mount.on('error', this.onerror)
    mount.on('change', this.onchange)
    this.mounts.push(mount)
    return mount
  }

  unload (mount) {
    mount.removeListener('error', this.onerror)
    mount.removeListener('change', this.onchange)
    mount.unwatch()
    this.mounts = this.mounts.filter(m => m !== mount)
  }

  create (n = 8) {
    var b = window.crypto.getRandomValues(new Uint8Array(n))
    return Array.from(b).map(c => c.toString(16)).join('')
  }

  serialize () {
    return this.mounts.map(mount => mount.serialize())
  }

  write (patch, cb) {
    return this.storage.update(patch, cb)
  }

  onerror (err) {
    this.emit('error', err)
  }

  onchange (evt) {
    HMap.prototype.onchange.call(this, evt)
  }
}
