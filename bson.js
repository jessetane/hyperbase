import base64 from 'base64-transcoder/index.js'

function encode (obj) {
  if (obj instanceof Uint8Array) return { _bson_: base64.encode(obj) }
  if (Array.isArray(obj)) return obj.map(o => encode(o))
  if (obj && typeof obj === 'object') {
    var tmp = {}
    for (var key in obj) tmp[key] = encode(obj[key])
    obj = tmp
  }
  return obj
}

function decode (obj) {
  if (obj && obj._bson_) return base64.decode(obj._bson_)
  if (Array.isArray(obj)) return obj.map(o => decode(o))
  if (obj && typeof obj === 'object') {
    var tmp = {}
    for (var key in obj) tmp[key] = decode(obj[key])
    obj = tmp
  }
  return obj
}

export default { encode, decode }
