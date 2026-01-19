function Deferred (fn) {
	let s, f, d = new Promise((_s, _f) => { s = _s; f = _f; if (fn) return fn(_s, _f) })
	d.resolve = s
	d.reject = f
	return d
}

const utf8 = {
	encoder: new TextEncoder(),
	decoder: new TextDecoder(),
	encode: s => utf8.encoder.encode(s),
	decode: b => utf8.decoder.decode(b)
}

export {
	Deferred,
	utf8
}
