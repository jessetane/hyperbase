import nacl from 'tweetnacl/nacl.js'
import base64 from 'base64-transcoder/index.js'

const sigSize = nacl.sign.signatureLength // 64
const timeSize = 8

/*
 * data layout
 *
hash = hash([time, raw])
data = [sig(hash), time, data]
*/

class HyperbaseCodecSignEd25519 {
  constructor (opts = {}) {
    this.verify = opts.verify
    this.identity = opts.identity
  }

  get publicKey () {
    if (!this._publicKey) {
      this._publicKey = base64.encode(this.identity.publicKey, 'url')
    }
    return this._publicKey
  }

  _shouldVerify (r, shouldVerify = true) {
    if (r.verifyExisting !== undefined) shouldVerify = r.verifyExisting
    else if (this.verifyExisting !== undefined) shouldVerify = this.verifyExisting
    return shouldVerify
  }

  _verify (r) {
    var hash = nacl.hash(r.data.subarray(sigSize))
    var sigBuffer = r.data.subarray(0, sigSize)
    var publicKey = base64.decode(r.path[r.path.length - 1].split('.')[1], 'url')
    return nacl.sign.detached.verify(hash, sigBuffer, publicKey)
  }

  write (req, cb) {
    var data = req.data
    if (req.id) {
      var view = new DataView(data.buffer)
      var existing = req.existingData
      if (existing) {
        /*
        // should we allow syncing duplicate data?
        if (existing.length === data.length) {
          if (existing.every((b, i) => b === data[i])) {
            return cb(null, req)
          }
        }
        */
        if (this._shouldVerify(req) && this._verify(Object.assign({}, req, { data: existing }))) {
          var time = view.getFloat64(sigSize, true)
          var timeExisting = new DataView(existing.buffer).getFloat64(sigSize, true)
          if (time <= timeExisting) {
            return cb(new Error(`${this.constructor.name}: old data`))
          }
        }
      }
      if (!this._verify(req)) {
        return cb(new Error(`${this.constructor.name}: bad signature for ${req.path.join(this.db.pathDelimiter)}`))
      }
    } else {
      if (!this.identity) {
        return cb(new Error(`${this.constructor.name}: missing identity`))
      } else if (req.path[req.path.length - 1].split('.').length > 1) {
        return cb(new Error(`${this.constructor.name}: codec name already contains identity`))
      }
      if (data === null) data = new Uint8Array()
      try {
        this.serialize(req)
      } catch (err) {
        return cb(err)
      }
      data = req.data
      var time = Date.now()
      var hashBuffer = new Uint8Array(timeSize + data.length)
      new DataView(hashBuffer.buffer).setFloat64(0, time, true)
      hashBuffer.set(data, timeSize)
      var hash = nacl.hash(hashBuffer)
      req.data = new Uint8Array(timeSize + sigSize + data.length)
      new DataView(req.data.buffer).setFloat64(sigSize, time, true)
      var sigBuffer = nacl.sign.detached(hash, this.identity.secretKey)
      req.data.set(sigBuffer, 0)
      req.data.set(data, sigSize + timeSize)
      req.path[req.path.length - 1] += '.' + this.publicKey
    }
    cb(null, req)
  }

  read (res, cb) {
    if (res.data === null) return cb(null, res)
    if (this._shouldVerify(res) && !this._verify(res)) {
      return cb(new Error(`${this.constructor.name}: bad signature for ${res.path.join('/')}`))
    }
    res.time = new DataView(res.data.buffer).getFloat64(sigSize, true)
    res.data = res.data.subarray(sigSize + timeSize)
    try {
      this.deserialize(res)
      cb(null, res)
    } catch (err) {
      cb(err)
    }
  }

  serialize (req) {}
  deserialize (res) {}
}

export default HyperbaseCodecSignEd25519
