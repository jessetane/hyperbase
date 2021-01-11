import utf8 from 'utf8-transcoder/index.js'

class HyperbaseCodecJson {
  write (req, cb) {
    if (!req.id) {
      if (req.data !== null) {
        this.serialize(req)
      }
    }
    cb(null, req)
  }

  read (res, cb) {
    if (res.data) {
      this.deserialize(res)
    }
    cb(null, res)
  }

  serialize (req) {
    req.data = Uint8Array.from(utf8.encode(JSON.stringify(req.data)))
  }

  deserialize (res) {
    res.data = JSON.parse(utf8.decode(res.data))
  }
}

export default HyperbaseCodecJson
