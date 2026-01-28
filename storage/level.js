import { ClassicLevel } from 'classic-level'

class StorageLevel {
	constructor (opts = {}) {
		this.delim = opts.delim || '\udbff\udfff'
		if (opts.filename) {
			this.filename = opts.filename
		} else {
			this.filename = process.cwd() + '/data.level'
		}
		this.db = new ClassicLevel(this.filename)
	}

	pathToStr (path, allowWild) {
		var strPath = ''
		var len = path.length
		var last = len - 1
		var i = 0
		while (i <= last) {
			var component = path[i]
			var n = len - i
			if (i === 0) n--
			while (n-- > 0) strPath += this.delim
			if (component === null) {
				if (allowWild) {
					while (i <= last) {
						if (path[i++] !== null) {
							throw new Error('wildcard cannot precede named path')
						}
					}
					break
				} else {
					return
				}
			}
			strPath += component
			i++
		}
		return strPath
	}

	write (batch) {
		if (!Array.isArray(batch)) batch = [batch]
		batch = batch.map(req => {
			var path = this.pathToStr(req.path)
			if (!path) {
				throw new Error('invalid path ' + JSON.stringify(req.path, null, 2))
			}
			if (req.data === null || req.data === undefined) {
				return { type: 'del', key: path }
			} else {
				return { type: 'put', key: path, value: Buffer.from(req.data), valueEncoding: 'buffer' }
			}
		})
		return this.db.batch(batch)
	}

	async read (path) {
		const strPath = this.pathToStr(path)
		if (!strPath) {
			throw new Error('invalid path ' + JSON.stringify(path, null, 2))
		}
		try {
			var data = await this.db.get(strPath, { valueEncoding: 'buffer' })
		} catch (err) {
			if (err.code !== 'LEVEL_NOT_FOUND') throw err
		}
		return { path, data: data === undefined ? null : data }
	}

	async list (path, opts = {}) {
		if (!path) path = []
		path = path.slice()
		path[path.length] = null
		const strPathPre = this.pathToStr(path, true)
		if (opts.gt) {
			opts.gt = strPathPre + opts.gt
		} else if (opts.gte) {
			opts.gte = strPathPre + opts.gte
		} else {
			opts.gt = strPathPre
		}
		if (opts.lt) {
			opts.lt = strPathPre + opts.lt
		} else if (opts.lte) {
			opts.lte = strPathPre + opts.lte
		} else {
			opts.lt = strPathPre + this.delim
		}
		opts.valueEncoding = 'buffer'
		const items = await this.db.iterator(opts).all()
		return items.map(i => {
			const key = i[0]
			const value = i[1]
			return {
				path: key.split(this.delim).filter(c => c),
				data: value === undefined ? null : value
			}
		})
	}

	close () {
		return this.db.close()
	}
}

export default StorageLevel
