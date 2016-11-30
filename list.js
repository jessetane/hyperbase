var HMap = require('./map')

module.exports = class HList extends HMap {
  constructor (opts) {
    super(opts)
    this.onload = this.onload.bind(this)
    this.onadd = this.onadd.bind(this)
    this.onremove = this.onremove.bind(this)
    this.onreorder = this.onreorder.bind(this)
    this.prefix = opts.prefix ? (opts.prefix + '/') : ''
    this._page = opts.page || 0
    this._pageSize = opts.pageSize || 9999
    this._reverse = opts.reverse
    this._each = opts.each || { type: 'map' }
  }

  get loading () {
    if (this.data === null) return false
    if (this.list === undefined) return true
    for (var key in this.children) {
      if (this.children[key].loading) return true
    }
    return false
  }

  get pageSize () {
    return this._pageSize
  }

  set pageSize (pageSize) {
    if (!pageSize || pageSize === this._pageSize) return
    this._pageSize = pageSize
    this.update()
  }

  get page () {
    return this._page
  }

  set page (page) {
    if (page === this._page) return
    this._page = page
    this.update()
  }

  get reverse () {
    return this._reverse
  }

  set reverse (reverse) {
    if (reverse === this.reverse) return
    this._reverse = reverse
    this.update()
  }

  get length () {
    return this.loading ? 0 : this.data.length
  }

  get each () {
    return this._each
  }

  set each (opts) {
    this._each = opts
    this.update()
  }

  watch () {
    this.notFoundRef = this.storage.child(this.prefix + this.key).limitToLast(1)
    this.notFoundRef.once('value', this.onload)
    this.ref = this.storage.child(this.prefix + this.key).orderByValue()
    this.ref.on('child_added', this.onadd)
    this.ref.on('child_removed', this.onremove)
    this.ref.on('child_changed', this.onreorder)
  }

  unwatch () {
    this.notFoundRef.off('value', this.onload)
    this.ref.off('child_added', this.onadd)
    this.ref.off('child_removed', this.onremove)
    this.ref.off('child_changed', this.onreorder)
    delete this.ref
    for (var key in this.children) {
      var child = this.children[key]
      child.removeListener('change', this.onchange)
      child.unwatch()
    }
    this.children = {}
    delete this.data
    delete this.list
  }

  update () {
    if (!this.ref) return
    var offset = this.pageSize * this.page
    var data = this.data
    this.list = Object.keys(data)
      .sort((a, b) => this._reverse ? data[b] - data[a] : data[a] - data[b])
    this.view = this.list.slice(offset, offset + this.pageSize)
    var pageKeys = {}
    this.view.forEach(key => { pageKeys[key] = true })
    for (var key in this.children) {
      var child = this.children[key]
      if (!pageKeys[key]) {
        child.removeListener('change', this.onchange)
        child.unwatch()
        delete this.children[key]
      }
    }
    for (key in pageKeys) {
      child = this.children[key]
      if (!child) {
        var Klass = this._each.type === 'list' ? HList : HMap
        child = this.children[key] = new Klass(Object.assign({
          key,
          storage: this.storage,
          debounce: 0
        }, this._each))
        child.on('change', this.onchange)
      }
    }
    this.onchange()
  }

  reorder (key, pagePosition = 0) {
    var offset = this.pageSize * this.page + pagePosition
    var current = this.data[this.list[offset]]
    var position = null
    if (current <= this.data[key]) {
      var before = offset > 0 ? this.data[this.list[offset - 1]] : undefined
      if (before === undefined) {
        position = current - 1
      } else {
        position = current - (current - before) / 2
      }
    } else {
      var after = this.data[this.list[offset + 1]]
      if (after === undefined) {
        position = current + 1
      } else {
        position = current + (after - current) / 2
      }
    }
    return {
      [`${this.key}/${key}`]: position
    }
  }

  serialize () {
    var data = this.view
      ? this.view.map(key => this.children[key].serialize())
      : []
    Object.defineProperty(data, 'key', {
      enumerable: false,
      get: () => this.key
    })
    return data
  }

  onload (snap) {
    if (snap.val() === null) {
      this.data = null
      this.onchange()
    }
  }

  onadd (snap) {
    this.data = this.data || {}
    this.data[snap.key] = snap.val()
    clearTimeout(this._addDebounce)
    this._addDebounce = setTimeout(() => {
      this.update()
    }, 20)
  }

  onremove (snap) {
    delete this.data[snap.key]
    this.update()
  }

  onreorder (snap) {
    this.data[snap.key] = snap.val()
    this.update()
  }
}
