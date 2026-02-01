class Storage {
	constructor (opts = {}) {
		this.delim = opts.delim || '\udbff\udfff'
	}

	pathToStr (path, opts = {}) {
		var strPath = ''
		var len = path.length
		var last = len - 1
		var i = 0
		while (i <= last) {
			var component = path[i]
			var n = len - i
			if (i === 0) n--
			if (component === null) {
				if (opts.allowWild) {
					while (i <= last) {
						if (path[i++] !== null) {
							throw new Error('wildcard cannot precede named path')
						}
					}
					if (!opts.isComparison) {
						while (n-- > 0) strPath += this.delim
					}
					break
				} else {
					throw new Error('wildcard not allowed')
				}
			} else {
				while (n-- > 0) strPath += this.delim
			}
			strPath += component
			i++
		}
		return strPath
	}

	list (path = [], opts = {}) {
		path = path.slice()
		path[path.length] = null
		const strPathPre = this.pathToStr(path, { allowWild: true })
		for (const k in opts) {
			const opt = opts[k]
			if (opt === undefined || opt === null || opt === '') {
				delete opts[k]
			} else if (k.startsWith('gt') || k.startsWith('lt')) {
				if (Array.isArray(opt)) {
					opts[k] = this.pathToStr(opt, {
						allowWild: true,
						isComparison: true
					}).slice(strPathPre.length)
				}
			}
		}
		return strPathPre 
	}
}

export { Storage }
