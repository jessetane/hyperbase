class HyperbaseCodecRaw {
  write (req, cb) {
    try {
      this.serialize(req)
      cb(null, req)
    } catch (err) {
      cb(err)
    }
  }

  read (res, cb) {
    try {
      this.deserialize(res)
      cb(null, res)
    } catch (err) {
      cb(err)
    }
  }

  serialize () {}
  deserialize () {}
}

export default HyperbaseCodecRaw
