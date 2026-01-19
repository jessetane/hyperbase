import base64 from 'base64-transcoder/index.js'

const hasBuffer = typeof Buffer !== 'undefined'

function encode (obj) {
	if (obj instanceof Uint8Array) return { _bson_: base64.encode(obj) }
	if (Array.isArray(obj)) return obj.map(o => encode(o))
	if (obj && typeof obj === 'object') {
		const tmp = {}
		for (var key in obj) tmp[key] = encode(obj[key])
		obj = tmp
	}
	return obj
}

function decode (obj) {
	if (obj && obj._bson_) {
		const data = base64.decode(obj._bson_)
		return hasBuffer
			? Buffer.from(data)
			: data
	}
	if (Array.isArray(obj)) return obj.map(o => decode(o))
	if (obj && typeof obj === 'object') {
		const tmp = {}
		for (var key in obj) tmp[key] = decode(obj[key])
		obj = tmp
	}
	return obj
}

export default { encode, decode }
