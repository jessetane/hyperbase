import HyperbaseTransportUnix from 'hyperbase/transport-unix/index.js'
import CustomEvent from 'xevents/custom-event.js'

function random () {
  return (Math.random() + '').slice(2)
}

function Client (opts) {
  var name = opts.name || random()
  var unix = new HyperbaseTransportUnix()
  var peer = unix.connect(opts.unixSocket)
  peer.database = { name }
  peer.addEventListener('ready', peer.auth)
  peer.write = function (batch) {
    return new Promise((res, rej) => {
      this.call('write', batch, err => {
        if (err) rej(err)
        else res()
      })
    })
  }
  peer.read = function (path) {
    return new Promise((res, rej) => {
      this.call('read', path, { decode: true }, (err, r) => {
        if (err) rej(err)
        else res(r)
      })
    })
  }
  peer.stream = function (path, opts) {
    var s = new EventTarget()
    var id = random()
    opts.decode = true
    this.call('stream', path, id, opts, err => {
      if (err) return s.dispatchEvent(new CustomEvent('error', { detail: err }))
      var timeout = setTimeout(() => {
        this.setInterface(id, null)
        s.dispatchEvent(new CustomEvent('error', { detail: new Error('timed out') }))
      }, this.timeout || 1000)
      this.setInterface(id, {
        data: entry => {
          s.dispatchEvent(new CustomEvent('data', { detail: entry }))
        },
        end: () => {
          clearTimeout(timeout)
          this.setInterface(id, null)
          s.dispatchEvent(new Event('end'))
        }
      })
    })
    return s
  }
  peer.page = function (path, opts) {
    return new Promise((res, rej) => {
      var id = random()
      var items = []
      opts.decode = true
      this.call('stream', path, id, opts, err => {
        if (err) return rej(err)
        var timeout = setTimeout(() => {
          this.setInterface(id, null)
          rej(new Error('timed out'))
        }, opts.timeout || this.timeout || 1000)
        this.setInterface(id, {
          data: item => items.push(item),
          end: () => {
            clearTimeout(timeout)
            this.setInterface(id, null)
            res(items)
          }
        })
      })
    })
  }
  peer.clear = function (path, opts) {
    return new Promise((res, rej) => {
      var id = random()
      var i = 0
      var n = 0
      var ended = false
      this.call('stream', path, id, opts, err => {
        if (err) return rej(err)
        var timeout = setTimeout(() => {
          timeout = null
          this.setInterface(id, null)
          rej(new Error('timed out'))
        }, opts.timeout || this.timeout || 1000)
        this.setInterface(id, {
          data: item => {
            i++
            n++
            this.write(item.path, null).then(() => {
              if (timeout === null) return
              if (--n > 0) return
              if (ended) res(i)
            }).catch(err => {
              if (timeout === null) return
              clearTimeout(timeout)
              timeout = null
              this.setInterface(id, null)
              rej(err)
            })
          },
          end: () => {
            clearTimeout(timeout)
            this.setInterface(id, null)
            ended = true
          }
        })
      })
    })
  }
  return peer
}

export default Client
