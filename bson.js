import base64 from 'base64-transcoder/index.js'

function encode (obj) {
  if (obj instanceof Uint8Array) return { _bson_: base64.encode(obj) }
  if (Array.isArray(obj)) return obj.map(o => encode(o))
  if (obj && typeof obj === 'object') {
    for (var key in obj) obj[key] = encode(obj[key])
  }
  return obj
}

function decode (obj) {
  if (obj && obj._bson_) return base64.decode(obj._bson_)
  if (Array.isArray(obj)) return obj.map(o => decode(o))
  if (obj && typeof obj === 'object') {
    for (var key in obj) obj[key] = decode(obj[key])
  }
  return obj
}

export default { encode, decode }
