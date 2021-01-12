import HyperbaseCodecHashSha512 from '../codec-hash-sha512/index.js'
import HyperbaseCodecEncryptXSalsa20Poly1305 from '../codec-encrypt-xsalsa20-poly1305/index.js'

/*
 * data layout
 *
nonce = randomBytes(nonceSize)
secret = hash(password).slice(0, secretSize)
ciphertext = secretbox(input, nonce, secret)
data = [nonce, ciphertext]
*/

class HyperbaseCodecHashSha512encryptXSalsa20Poly1305 extends HyperbaseCodecHashSha512 {}

;['_parseSecret', 'serialize', 'deserialize'].forEach(method => {
  HyperbaseCodecHashSha512encryptXSalsa20Poly1305.prototype[method] = HyperbaseCodecEncryptXSalsa20Poly1305.prototype[method]
})

export default HyperbaseCodecHashSha512encryptXSalsa20Poly1305
