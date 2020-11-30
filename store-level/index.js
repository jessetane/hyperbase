import Level from 'level'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

class HyperbaseStoreLevel {
  constructor (opts = {}) {
    this.delim = opts.delim || '\udbff\udfff'
    if (opts.filename) {
      this.filename = opts.filename
    } else {
      this.filename = process.cwd() + '/data.level'
    }
    this.db = Level(this.filename)
  }

  close () {
    this.db.close()
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
      var path = this.pathToStr(req.path)
      if (!path) {
        err = new Error('invalid path ' + JSON.stringify(req.path, null, 2))
        return
      }
      if (req.data === null || req.data === undefined) {
        return { type: 'del', key: path }
      } else {
        return { type: 'put', key: path, value: Buffer.from(req.data) }
      }
    })
    if (err) {
      return cb(err)
    }
    this.db.batch(batch, cb)
  }

  read (path, cb) {
    var strPath = this.pathToStr(path)
    if (!strPath) {
      return cb(new Error('invalid path ' + JSON.stringify(path, null, 2)))
    }
    this.db.get(strPath, { valueEncoding: 'binary' }, (err, data) => {
      if (err && !err.notFound) return cb(err)
      cb(null, { path, data: data || null })
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
    opts.valueEncoding = 'binary'
    var s = this.db.createReadStream(opts)
    s.on('end', emit)
    s.on('data', res => {
      var path = res.key.split(this.delim).filter(c => c)
      emit({ path, data: res.value })
    })
  }
}

export default HyperbaseStoreLevel
