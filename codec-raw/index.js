class HyperbaseCodecRaw {
  write (req, cb) {
    cb(null, req)
  }

  read (res, cb) {
    cb(null, res)
  }
}

export default HyperbaseCodecRaw
