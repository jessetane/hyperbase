import HyperbaseCodecHashSha512EncryptXSalsa20Poly1305 from '../codec-hash-sha512-encrypt-xsalsa20-poly1305/index.js'
import HyperbaseCodecJson from '../codec-json/index.js'

class HyperbaseCodecHashSha512EncryptXSalsa20Poly1305Json extends HyperbaseCodecHashSha512EncryptXSalsa20Poly1305 {
  serialize (req) {
    HyperbaseCodecJson.prototype.serialize(req)
    super.serialize(req)
  }

  deserialize (res) {
    if (!res.secret) return
    super.deserialize(res)
    HyperbaseCodecJson.prototype.deserialize(res)
  }
}

export default HyperbaseCodecHashSha512EncryptXSalsa20Poly1305Json
