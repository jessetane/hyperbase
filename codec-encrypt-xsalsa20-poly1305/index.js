import HyperbaseCodecRaw from 'hyperbase/codec-raw/index.js'
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
data = [nonce, ciphertext]
*/

class HyperbaseCodecEncryptXSalsa20Poly1305 extends HyperbaseCodecRaw {
  _parseSecret (secret) {
    if (typeof secret === 'string') {
      secret = secret.normalize('NFKC') // resolves unicode combinations to canonical representations
      secret = Uint8Array.from(utf8.encode(secret))
      secret = nacl.hash(secret).slice(0, secretSize)
    }
    return secret
  }

  serialize (req) {
    if (!req.secret) throw new Error('missing secret')
    var secret = this._parseSecret(req.secret)
    delete req.secret
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
    if (plaintext === null) {
      var err = new Error('decryption failed')
      err.data = { path: res.path }
      throw err
    }
    res.data = plaintext
  }
}

export default HyperbaseCodecEncryptXSalsa20Poly1305
