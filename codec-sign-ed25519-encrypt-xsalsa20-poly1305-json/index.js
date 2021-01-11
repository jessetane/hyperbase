import HyperbaseCodecSignEd25519encryptXSalsa20Poly1305 from '../codec-sign-ed25519-encrypt-xsalsa20-poly1305/index.js'
import HyperbaseCodecJson from '../codec-json/index.js'

class HyperbaseCodecSignEd25519encryptXSalsa20Poly1305Json extends HyperbaseCodecSignEd25519encryptXSalsa20Poly1305 {
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

export default HyperbaseCodecSignEd25519encryptXSalsa20Poly1305Json
