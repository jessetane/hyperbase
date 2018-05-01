var HyperMap = require('./map')

module.exports = class HyperList extends HyperMap {
  constructor (opts) {
    super(opts)
    this._page = opts.page || null
    this._pageSize = opts.pageSize || 9999
    this._reverse = opts.reverse
    this._each = opts.each || { type: 'map' }
    this._order = opts.order
    this._where = opts.where
    this.embedded = opts.embedded
    this.counted = opts.counted
    this.asMap = opts.asMap
    this.pageDirection = 0
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

  get where () {
    return this._where
  }

  set where (where) {
    this._where = where
    this.storage.update(this)
  }

  get order () {
    return this._order
  }

  set order (order) {
    this._order = order
    this.storage.update(this)
  }

  get pageSize () {
    return this._pageSize
  }

  set pageSize (pageSize) {
    if (!pageSize || pageSize === this._pageSize) return
    this._pageSize = pageSize
    this.storage.update(this)
  }

  get page () {
    return this._page
  }

  set page (page) {
    this._page = page
    this.pageDirection = 0
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

  watch () {
    delete this.dataByKey
    delete this.parentData
    if (this.embedded) {
      delete this.data
      this.update()
    } else {
      super.watch()
    }
  }

  acquireData (force) {
    if (!super.acquireData(force)) return
    if (this.embedded) {
      this.data = Object.keys(this.data || {}).map((key, i) => {
        var data = this.data[key]
        return {
          key,
          order: typeof data === 'number'
            ? data
            : i,
          data
        }
      })
      this.data.sort((a, b) => this.reverse ? b.order - a.order : a.order - b.order)
      this.size = this.data.length
    }
    return true
  }

  update (force = true) {
    if (!this.acquireData(force)) return
    if (this.loading && !force) return
    var items = this.dataByKey = {}
    this.data.forEach(item => {
      items[item.key] = item
    })
    var each = null
    for (var key in this.children) {
      var child = this.children[key]
      if (!items[key]) {
        child.removeListener('error', this.onerror)
        child.removeListener('change', this.onchange)
        child.unwatch()
        delete child.root
        delete child.parent
        delete this.children[key]
      } else if (child.link !== this._each.link) {
        child.link = this._each.link
      }
    }
    for (key in items) {
      var item = items[key]
      child = this.children[key]
      if (child) {
        if (child.embedded) {
          child.update(false)
        }
        continue
      }
      if (each === null) {
        each = this._each
        if (typeof each.prefix === 'function') {
          each = Object.assign({}, this._each)
          each.prefix = each.prefix(this)
        }
        var prefix = this.prefix + this.key
        if (!each.prefix || each.prefix === prefix) {
          each.prefix = prefix
          each.embedded = true
        }
      }
      var Klass = each.type === 'list' ? HyperList : HyperMap
      child = this.children[key] = new Klass(Object.assign({
        key,
        root: this.root,
        parent: this,
        storage: this.storage,
        debounce: 0
      }, each))
      child.on('error', this.onerror)
      child.on('change', this.onchange)
    }
    this.onchange()
  }

  next (f = 1) {
    f = Math.ceil((this.pageSize - 1) * f)
    this._page = this.data[f].order
    this.pageDirection = 1
    this.storage.update(this)
  }

  prev (f = 1) {
    f = (this.pageSize - 1) - Math.ceil((this.pageSize - 1) * f)
    this._page = this.data[f].order
    this.pageDirection = 2
    this.storage.update(this)
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
    } else if (!before && this.page !== null) {
      throw new Error('missing item before')
    } else if (!after && this.data.length < this.size) {
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

  delete (eachLinks) {
    if (this.loading) throw new Error('cannot delete items that have not loaded')
    if (this.pageSize < this.size) throw new Error('cannot delete because page size is smaller than the amount of total items')
    var patch = this.storage.delete(this)
    this.data.map(item => {
      Object.assign(
        patch,
        this.children[item.key].delete(eachLinks)
      )
    })
    return patch
  }
}
