var EventEmitter = require('events')
var HList = null // require() can't handle circular deps so we grab this at runtime

module.exports = class HMap extends EventEmitter {
  constructor (opts) {
    super()
    if (HList === null) {
      HList = require('./list')
    }
    this.onvalue = this.onvalue.bind(this)
    this.onerror = this.onerror.bind(this)
    this.onchange = this.onchange.bind(this)
    this.key = opts.key
    this.prefix = opts.prefix ? (opts.prefix + '/') : ''
    this.storage = opts.storage
    this._links = opts.link
    this.debounce = opts.debounce === undefined ? 25 : opts.debounce
    this.children = {}
    this._watch = setTimeout(() => this.watch())
  }

  get loading () {
    if (this.data === undefined) return true
    for (var key in this.children) {
      var child = this.children[key]
      if (child.loading) return true
    }
    return false
  }

  get loaded () {
    return !this.loading
  }

  get notFound () {
    return this.data === null
  }

  get link () {
    return this._links
  }

  set link (opts) {
    this._links = opts
    this.update()
  }

  watch () {
    this.ref = this.storage.child(this.prefix + this.key)
    this.ref.on('value', this.onvalue, err => {
      err.target = this
      this.data = null
      this.emit('error', err)
      this.update()
    })
  }

  unwatch () {
    clearTimeout(this._watch)
    if (!this.ref) return
    this.ref.off('value', this.onvalue)
    for (var key in this.children) {
      this.children[key].unwatch()
    }
    this.children = {}
  }

  update () {
    this.onvalue({ val: () => this.data })
  }

  serialize () {
    if (this.cache) return this.cache
    var data = this.data ? JSON.parse(this.hash) : {}
    this.forEachLink(this._links, data, (location, property, childKey, opts) => {
      location[property] = this.children[childKey].serialize()
    })
    Object.defineProperty(data, 'key', {
      enumerable: false,
      get: () => this.key
    })
    return this.cache = data
  }

  delete () {
    if (this.loading) throw new Error('cannot delete items that have not loaded')
    var patch = {
      [this.prefix + this.key]: null
    }
    this.forEachLink(this._links, this.data, (location, property, childKey, opts) => {
      Object.assign(
        patch,
        this.children[childKey].delete()
      )
      if (opts.type === 'list') {
        delete patch[`${this.prefix}${this.key}/${childKey}`]
      }
    })
    return patch
  }

  onvalue (snap) {
    var data = snap.val()
    var hash = JSON.stringify(data)
    var changed = this.data === undefined || hash !== this.hash
    this.data = data
    this.hash = hash
    var links = {}
    this.forEachLink(this._links, data, (location, property, childKey, opts) => {
      links[childKey] = [ opts, location[property] ]
    })
    for (var childKey in this.children) {
      var child = this.children[childKey]
      var link = links[childKey]
      if (link) {
        var foreignKey = link[1]
        if (foreignKey === child.key || typeof foreignKey === 'object') {
          continue
        }
      }
      changed = true
      child.removeListener('error', this.onerror)
      child.removeListener('change', this.onchange)
      child.unwatch()
      delete this.children[childKey]
    }
    for (childKey in links) {
      child = this.children[childKey]
      if (child) continue
      changed = true
      var Klass = HMap
      var link = links[childKey]
      var opts = link[0]
      var key = link[1]
      var prefix = ''
      if (opts.type === 'list') {
        Klass = HList
        if (typeof key === 'object') {
          key = childKey
          prefix = this.prefix + this.key
        }
      }
      child = this.children[childKey] = new Klass(Object.assign({
        key,
        prefix,
        storage: this.storage,
        debounce: 0
      }, opts))
      child.on('error', this.onerror)
      child.on('change', this.onchange)
    }
    if (changed) {
      this.onchange()
    }
  }

  forEachLink (links, data, cb) {
    for (var path in links) {
      var opts = links[path]
      var pointers = [[ data, '' ]]
      var components = path.split('/')
      components.forEach((component, i) => {
        var last = i === components.length - 1
        var nextPointers = []
        pointers.forEach(pointer => {
          var location = pointer[0]
          if (!location || typeof location !== 'object') return
          var relpath = pointer[1]
          if (relpath) relpath += '/'
          if (component === '*') {
            for (var property in location) {
              if (location[property] === undefined) continue
              if (last) {
                cb(location, property, relpath + property, opts)
              } else {
                nextPointers.push([
                  location[property],
                  relpath + property
                ])
              }
            }
          } else if (location[component] !== undefined) {
            property = component
            if (last) {
              cb(location, property, relpath + property, opts)
            } else {
              nextPointers.push([
                location[property],
                relpath + property
              ])
            }
          }
        })
        pointers = nextPointers
      })
    }
  }

  onerror (err) {
    err.currentTarget = this
    this.emit('error', err)
  }

  onchange (evt) {
    delete this.cache
    if (this.debounce) {
      clearTimeout(this._debounce)
      this._debounce = setTimeout(() => {
        this.emit('change', evt || this)
      }, this.debounce)
    } else {
      this.emit('change', evt || this)
    }
  }
}
