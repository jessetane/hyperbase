class HyperbaseStoreIndexedDb {
  constructor (opts = {}) {
    this.delim = opts.delim || '\udbff\udfff'
    if (opts.dbname) {
      this.dbname = opts.dbname
    } else {
      this.dbname = 'hyperbase'
    }
    this.db = new Promise((res, rej) => {
      var req = indexedDB.open(this.dbname, 1)
      req.onerror = () => { throw req.error }
      req.onsuccess = () => res(req.result)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('default')
      }
    })
  } 

  close () {
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
    batch = batch.map(req => {
      if (err) return
      var tmp = null
      var path = this.pathToStr(req.path)
      if (path) {
        tmp = { path, data: req.data }
      } else {
        err = new Error('invalid path ' + JSON.stringify(req.path, null, 2))
      }
      return tmp
    })
    if (err) {
      cb(err)
      return
    }
    this.db.then(db => {
      var tx = db.transaction('default', 'readwrite')
      tx.onerror = () => cb(tx.error)
      tx.oncomplete = evt => cb()
      var store = tx.objectStore('default')
      var n = 0
      batch.forEach(req => {
        n++
        if (req.data === null || req.data === undefined) {
          req = store.delete(req.path)
        } else {
          req = store.put(req.data, req.path)
        }
        req.onsuccess = onsuccess
      })
      function onsuccess () {
        if (--n === 0) {
          console.log('all done!')
        }
      }
    })
  }

  read (path, cb) {
    var strPath = this.pathToStr(path)
    if (!strPath) {
      cb(new Error('invalid path ' + JSON.stringify(path, null, 2)))
      return
    }
    this.db.then(db => {
      var tx = db.transaction('default', 'readwrite')
      tx.onerror = () => cb(tx.error)
      var store = tx.objectStore('default')
      var req = store.get(strPath)
      req.onsuccess = () => {
        var res = { path }
        var data = req.result
        if (data !== undefined) res.data = data
        cb(null, res)
      }
    })
  }

  stream (path, opts, emit) {
    path = path.slice()
    path[path.length] = null
    var strPathPre = this.pathToStr(path, true)
    if (opts.gt) {
      opts.gt = strPathPre + opts.gt
    } else if (opts.gte) {
      opts.gte = strPathPre + opts.gte
    } else {
      opts.gt = strPathPre
    }
    if (opts.lt) {
      opts.lt = strPathPre + opts.lt
    } else if (opts.lte) {
      opts.lte = strPathPre + opts.lte
    } else {
      opts.lt = strPathPre + this.delim
    }
    var query = undefined 
    if (opts.gte || opts.gt) {
      if (opts.lte || opts.lt) {
        query = IDBKeyRange.bound(opts.gte || opts.gt, opts.lte || opts.lt, !opts.gte, !opts.lte)
      } else {
        query = IDBKeyRange.lowerBound(opts.gte || opts.gt, !opts.gte)
      }
    } else if (opts.lte || opts.lt) {
      query = IDBKeyRange.upperBound(opts.lte || opts.lt, !opts.lte)
    }
    this.db.then(db => {
      var tx = db.transaction('default', 'readonly')
      // error handling?
      tx.oncomplete = evt => emit()
      var store = tx.objectStore('default')
      var req = store.openCursor(query, opts.reverse ? 'prev' : 'next')
      req.onsuccess = evt => {
        var cursor = req.result
        if (!cursor) return
        var path = cursor.key.split(this.delim).filter(c => c)
        emit({ path, data: cursor.value })
        cursor.continue()
      }
    })
  }
}

export default HyperbaseStoreIndexedDb
