import HyperbaseCodecSignEd25519 from 'hyperbase/codec-sign-ed25519/index.js'
import HyperbaseCodecJson from 'hyperbase/codec-json/index.js'

class HyperbaseCodecSignEd25519Json extends HyperbaseCodecSignEd25519 {}
HyperbaseCodecSignEd25519Json.prototype.serialize = HyperbaseCodecJson.prototype.serialize
HyperbaseCodecSignEd25519Json.prototype.deserialize = HyperbaseCodecJson.prototype.deserialize

export default HyperbaseCodecSignEd25519Json
