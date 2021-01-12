import nacl from 'tweetnacl/nacl.js'
import base64 from 'base64-transcoder/index.js'

class HyperbaseCodecHashSha512 {
  _verify (r, shouldVerify = true) {
    if (r.verifyExisting !== undefined) shouldVerify = r.verifyExisting
    else if (this.verifyExisting !== undefined) shouldVerify = this.verifyExisting
    if (!shouldVerify) return true
    var hash = nacl.hash(r.data)
    var key = r.path[r.path.length - 2]
    return base64.encode(hash, 'url') === key
  }

  write (req, cb) {
    var data = req.data
    if (req.id) {
      // syncing from peer
      if (data === null) {
        cb(new Error('hashed data cannot be deleted by sync'))
        return
      }
      if (this._verify(req)) {
        cb(new Error('invalid hash'))
        return
      }
    } else {
      // creating locally
      if (data !== null) {
        try {
          this.serialize(req)
          data = req.data
        } catch (err) {
          cb(err)
          return
        }
        var hashString = base64.encode(nacl.hash(data), 'url')
        req.path.splice(-1, 0, hashString)
      }
    }
    cb(null, req)
  }

  read (res, cb) {
    if (res.data === null) {
      cb(null, res)
      return
    }
    if (!this._verify(res)) {
      cb(new Error('invalid hash'))
      return
    }
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

export default HyperbaseCodecHashSha512
