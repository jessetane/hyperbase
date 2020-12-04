function strcmp (a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

class HyperbaseStoreMemory {
  constructor (opts = {}) {
    this.delim = opts.delim || '\udbff\udfff'
    this.data = opts.data || {}
    this.sort()
  }

  sort () {
    this.sorted = Object.keys(this.data).sort(strcmp)
  }

  pathToStr (path, allowWild) {
    var strPath = ''
    var len = path.length
    var last = len - 1
    var i = 0
    while (i <= last) {
      var component = path[i]
      var n = len - i
      if (i === 0) n--
      while (n-- > 0) strPath += this.delim
      if (component === null) {
        if (allowWild) {
          break
        } else {
          return
        }
      }
      strPath += component
      i++
    }
    return strPath
  }

  write (batch, cb) {
    var err = null
    batch.forEach(req => {
      if (err) return
      var path = this.pathToStr(req.path)
      if (!path) {
        err = new Error('invalid path ' + JSON.stringify(req.path, null, 2))
        return
      }
      if (req.data === null) {
        delete this.data[path]
      } else {
        this.data[path] = req.data
      }
    })
    if (err) {
      return cb(err)
    }
    this.sort()
    cb()
  }

  read (path, cb) {
    var strPath = this.pathToStr(path)
    if (!strPath) {
      return cb(new Error('invalid path ' + JSON.stringify(path, null, 2)))
    }
    cb(null, { path, data: this.data[strPath] })
  }

  stream (path, opts, emit) {
    path = path.slice()
    path[path.length] = null
    var strPathPre = this.pathToStr(path, true)
    var start = strPathPre
    var gt = opts.gt
    var gte = opts.gte
    if (gt) start += gt
    else if (gte) start += gte
    var end = strPathPre
    var lt = opts.lt
    var lte = opts.lte
    if (lt) end += lt
    else if (lte) end += lte
    else end += this.delim
    var limit = opts.limit || Infinity
    queueMicrotask(() => {
      var started = false
      var sorted = opts.reverse ? this.sorted.slice().reverse() : this.sorted
      var length = sorted.length
      var i = 0
      while (i < length) {
        var strPath = sorted[i++]
        var comp = null
        if (!started) {
          comp = strcmp(strPath, start)
          if (comp < 0) continue
          if (comp === 0 && gt) continue
          started = true
        }
        if (started) {
          comp = strcmp(strPath, end)
          if (comp >= 0) {
            if (!lte || comp !== 0) break
          }
        }
        if (limit-- <= 0) break
        var arrPath = strPath.split(this.delim).filter(c => c)
        var data = this.data[strPath]
        emit({ path: arrPath, data: this.data[strPath] })
      }
      emit()
    })
  }
}

export default HyperbaseStoreMemory
