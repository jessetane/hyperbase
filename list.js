var HyperMap = require('./map')

module.exports = class HyperList extends HyperMap {
  constructor (opts) {
    super(opts)
    this.update = this.update.bind(this)
    this._page = opts.page || null
    this._pageSize = opts.pageSize || 9999
    this._reverse = opts.reverse
    this._each = opts.each || { type: 'map' }
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
    var parent = this.parent
    if (parent && parent.prefix + parent.key === this._prefix) {
      this.embedded = true
      delete this.data
      parent.on('update', this.update)
      this.update()
    } else {
      super.watch()
    }
  }

  unwatch () {
    var parent = this.parent
    if (parent && parent.prefix + parent.key === this._prefix) {
      delete this.embedded
      delete this.parentData
      parent.removeListener('update', this.update)
    }
    super.unwatch()
  }

  update () {
    if (this.embedded) {
      var parentData = this.parent.data
      if (parentData === undefined) return
      if (parentData) parentData = parentData[this.key]
      if (parentData === this.parentData) return
      delete this.cache
      this.parentData = parentData
      this.data = []
      for (var key in parentData) {
        this.data.push({
          key,
          order: parentData[key]
        })
      }
      this.data.sort((a, b) => this.reverse ? b.order - a.order : a.order - b.order)
      this.size = this.data.length
    } else if (this.loading) {
      return
    }
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
        delete child.parent
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
          parent: this,
          storage: this.storage,
          debounce: 0
        }, this._each))
        child.on('error', this.onerror)
        child.on('change', this.onchange)
      }
    }
    if (!this.embedded) {
      this.onchange()
    }
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
