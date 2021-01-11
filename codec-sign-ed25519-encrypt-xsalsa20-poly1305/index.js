import HyperbaseCodecSignEd25519 from '../codec-sign-ed25519/index.js'
import nacl from 'tweetnacl/nacl.js'
import utf8 from 'utf8-transcoder/index.js'

var secretSize = nacl.secretbox.keyLength // 32
var nonceSize = nacl.secretbox.nonceLength // 24

/*
 * data layout
 *
nonce = randomBytes(nonceSize)
secret = hash(password).slice(0, secretSize)
ciphertext = secretbox(input, nonce, secret)
raw = [nonce, ciphertext]
hash = hash([time, raw])
data = [sig(hash), time, raw]
*/

class HyperbaseCodecSignEd25519encryptXSalsa20Poly1305 extends HyperbaseCodecSignEd25519 {
  _parseSecret (secret) {
    if (typeof secret === 'string') {
      secret = secret.normalize('NFKC') // resolves unicode ligatures to canonical representations
      secret = Uint8Array.from(utf8.encode(secret))
      secret = nacl.hash(secret).slice(0, secretSize)
    }
    return secret
  }

  serialize (req) {
    if (!req.secret) throw new Error('missing secret')
    var secret = req.secret = this._parseSecret(req.secret)
    var nonce = nacl.randomBytes(nonceSize)
    var ciphertext = nacl.secretbox(req.data, nonce, secret)
    req.data = new Uint8Array(nonceSize + ciphertext.length)
    req.data.set(nonce)
    req.data.set(ciphertext, nonceSize)
  }

  deserialize (res) {
    var secret = this._parseSecret(res.secret)
    delete res.secret
    if (!secret) return
    var nonce = res.data.subarray(0, nonceSize)
    var ciphertext = res.data.subarray(nonceSize)
    var plaintext = nacl.secretbox.open(ciphertext, nonce, secret)
    if (plaintext === null) throw new Error('decryption failed')
    res.data = plaintext
  }
}

export default HyperbaseCodecSignEd25519encryptXSalsa20Poly1305
