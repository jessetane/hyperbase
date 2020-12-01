class HyperbaseCodecRaw {
  write (req, cb) {
    var data = req.data
    if (!req.id) {
      req.path.push('_')
    }
    cb(null, req)
  }

  read (res, cb) {
    cb(null, res)
  }
}

export default HyperbaseCodecRaw
