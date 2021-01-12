import HyperbaseCodecSignEd25519 from '../codec-sign-ed25519/index.js'
import HyperbaseCodecEncryptXSalsa20Poly1305 from '../codec-encrypt-xsalsa20-poly1305/index.js'

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

class HyperbaseCodecSignEd25519encryptXSalsa20Poly1305 extends HyperbaseCodecSignEd25519 {}

;['_parseSecret', 'serialize', 'deserialize'].forEach(method => {
  HyperbaseCodecSignEd25519encryptXSalsa20Poly1305.prototype[method] = HyperbaseCodecEncryptXSalsa20Poly1305.prototype[method]
})

export default HyperbaseCodecSignEd25519encryptXSalsa20Poly1305
