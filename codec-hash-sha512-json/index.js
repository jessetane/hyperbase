import HyperbaseCodecHashSha512 from 'hyperbase/codec-hash-sha512/index.js'
import HyperbaseCodecJson from 'hyperbase/codec-json/index.js'

class HyperbaseCodecHashSha512Json extends HyperbaseCodecHashSha512 {}
HyperbaseCodecHashSha512Json.prototype.serialize = HyperbaseCodecJson.prototype.serialize
HyperbaseCodecHashSha512Json.prototype.deserialize = HyperbaseCodecJson.prototype.deserialize

export default HyperbaseCodecHashSha512Json
