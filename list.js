var HyperMap = require('./map')

module.exports = class HyperList extends HyperMap {
  constructor (opts) {
    super(opts)
    this._page = opts.page || 0
    this._pageSize = opts.pageSize || 9999
    this._reverse = opts.reverse
    this._each = opts.each || { type: 'map' }
    this.type = 'list'
    this.size = 0
  }

  get loading () {
    if (this.data === undefined) {
      return true
    }
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
    if (this._page > 0) {
      this._page = Math.round(this._pageSize * this._page / pageSize)
    }
    this._pageSize = pageSize
    this.storage.update(this)
  }

  get page () {
    return this._page
  }

  set page (page) {
    if (page === this._page) return
    if (page < 0 || this.size <= this._pageSize) {
      page = 0
    } else if (page > this._page) {
      if (this.size - page * this._pageSize < this._pageSize) {
        page = (this.size - this._pageSize) / this._pageSize
      }
    }
    this._page = page
    this.storage.update(this)
  }

  get reverse () {
    return this._reverse
  }

  set reverse (reverse) {
    if (reverse === this.reverse) return
    this._reverse = reverse
    this.storage.update(this)
  }

  get each () {
    return this._each
  }

  set each (opts) {
    this._each = opts
    this.storage.update(this)
  }

  update () {
    if (this.loading) return
    var items = {}
    this.data.forEach(item => {
      items[item.key] = true
    })
    for (var key in this.children) {
      var child = this.children[key]
      if (!items[key]) {
        child.removeListener('error', this.onerror)
        child.removeListener('change', this.onchange)
        child.unwatch()
        delete child.root
        delete this.children[key]
      } else if (child.link !== this._each.link) {
        child.link = this._each.link
      }
    }
    for (key in items) {
      child = this.children[key]
      if (!child) {
        var Klass = this._each.type === 'list' ? HyperList : HyperMap
        child = this.children[key] = new Klass(Object.assign({
          key,
          root: this.root,
          storage: this.storage,
          debounce: 0
        }, this._each))
        child.on('error', this.onerror)
        child.on('change', this.onchange)
      }
    }
    this.onchange()
  }

  reorder (key, pagePosition = 0) {
    var reverse = this.reverse
    var direction = 'forward'
    var position = null
    var from = null
    var to = null
    var before = null
    var after = null
    var i = 0
    while (i < this.data.length) {
      var item = this.data[i]
      if (item.key === key) {
        from = item
        if (to) break
      } else if (i === pagePosition) {
        to = item
        before = this.data[i - 1]
        after = this.data[i + 1]
        if (from) break
        direction = 'backward'
      }
      i++
    }
    if (!from) {
      throw new Error('missing item')
    } else if (!before && this.page > 0) {
      throw new Error('missing item before')
    } else if (!after && this.page !== Math.ceil(this.size / this.pageSize) - 1) {
      throw new Error('missing item after')
    }
    if (direction === 'backward') {
      if (before) {
        position = to.order - (reverse ? before.order - to.order : to.order - before.order) / 2
      } else {
        position = to.order - (reverse ? -1 : 1)
      }
    } else {
      if (after) {
        position = to.order + (reverse ? to.order - after.order : after.order - to.order) / 2
      } else {
        position = to.order + (reverse ? -1 : 1)
      }
    }
    return this.storage.reorder(this, key, position)
  }

  denormalize (cacheBehavior = 1) {
    var data = this.cache
    if (!cacheBehavior || !data) {
      data = this.data
        ? this.data.map(item => this.children[item.key].denormalize(cacheBehavior))
        : []
      var key = this.key
      Object.defineProperty(data, 'key', {
        enumerable: false,
        get: () => key
      })
      this.cache = data
    } else if (cacheBehavior === 1 && data) {
      return data
    } else {
      data.forEach((child, i) => {
        child = this.children[child.key]
        if (child) {
          data[i] = child.denormalize(cacheBehavior)
        }
      })
    }
    return data
  }

  delete () {
    if (this.loading) throw new Error('cannot delete items that have not loaded')
    if (this.pageSize < this.size) throw new Error('cannot delete because page size is smaller than the amount of total items')
    var patch = this.storage.delete(this)
    this.data.map(item => {
      Object.assign(
        patch,
        this.children[item.key].delete()
      )
    })
    return patch
  }
}
