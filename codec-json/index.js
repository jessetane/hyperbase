import utf8 from 'utf8-transcoder/index.js'

class HyperbaseCodecJson {
  write (req, cb) {
    if (!req.id) {
      if (req.data !== null) {
        req.data = this.serialize(req.data)
      }
    }
    cb(null, req)
  }

  read (res, cb) {
    if (res.data) {
      res.data = this.deserialize(res.data)
    }
    cb(null, res)
  }

  serialize (data) {
    return utf8.encode(JSON.stringify(data))
  }

  deserialize (data) {
    return JSON.parse(utf8.decode(data))
  }
}

export default HyperbaseCodecJson
