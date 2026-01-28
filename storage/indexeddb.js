class StorageIndexedDb {
	constructor (opts = {}) {
		this.delim = opts.delim || '\udbff\udfff'
		if (opts.dbname) {
			this.dbname = opts.dbname
		} else {
			this.dbname = 'default'
		}
		this.db = new Promise((res, rej) => {
			var req = indexedDB.open(this.dbname, 1)
			req.onerror = () => rej(req.error)
			req.onsuccess = () => res(req.result)
			req.onupgradeneeded = () => {
				req.result.createObjectStore('default')
			}
		})
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
						if (path[i] !== null) {
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

	async write (batch) {
		const isArray = Array.isArray(batch)
		if (!isArray) {
			batch = [batch]
		}
		batch = batch.map(req => {
			const path = this.pathToStr(req.path)
			if (!path) {
				throw new Error('invalid path ' + JSON.stringify(req.path, null, 2))
			}
			return { path, data: req.data }
		})
		const db = await this.db
		return new Promise((res, rej) => {
			const tx = db.transaction('default', 'readwrite')
			tx.onerror = () => rej(tx.error)
			tx.oncomplete = () => res()
			const store = tx.objectStore('default')
			let n = 0
			batch.forEach(req => {
				n++
				if (req.data === null) {
					req = store.delete(req.path)
				} else {
					req = store.put(req.data, req.path)
				}
				req.onsuccess = onsuccess
			})
			function onsuccess () {
				if (--n === 0) res()
			}
		})
	}

	async read (path) {
		const strPath = this.pathToStr(path)
		if (!strPath) {
			throw new Error('invalid path ' + JSON.stringify(path, null, 2))
		}
		const db = await this.db
		return new Promise((res, rej) => {
			const tx = db.transaction('default', 'readwrite')
			tx.onerror = () => rej(tx.error)
			const store = tx.objectStore('default')
			const req = store.get(strPath)
			req.onsuccess = () => {
				const obj = { path }
				const data = req.result
				if (data !== undefined) obj.data = data
				res(obj)
			}
		})
	}

	async list (path, opts = {}) {
		let s, f, p = new Promise((_s, _f) => { s = _s; f = _f })
		const batch = []
		this.stream(path, opts, res => {
			if (res) {
				batch.push(res)
			} else {
				s(batch)
			}
		})
		return p
	}

	async stream (path, opts, emit) {
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
			opts.lte = strPathPre + opts.lte + this.delim
		} else {
			opts.lt = strPathPre + this.delim
		}
		let query = undefined
		if (opts.gte || opts.gt) {
			if (opts.lte || opts.lt) {
				query = IDBKeyRange.bound(opts.gte || opts.gt, opts.lte || opts.lt, !opts.gte, !opts.lte)
			} else {
				query = IDBKeyRange.lowerBound(opts.gte || opts.gt, !opts.gte)
			}
		} else if (opts.lte || opts.lt) {
			query = IDBKeyRange.upperBound(opts.lte || opts.lt, !opts.lte)
		}
		const db = await this.db
		const tx = db.transaction('default', 'readonly')
		tx.oncomplete = () => emit()
		const store = tx.objectStore('default')
		const req = store.openCursor(query, opts.reverse ? 'prev' : 'next')
		let n = 0
		req.onsuccess = evt => {
			const cursor = req.result
			if (!cursor) return
			const path = cursor.key.split(this.delim).filter(c => c)
			emit({ path, data: cursor.value })
			if (!opts.limit || ++n < opts.limit) {
				cursor.continue()
			}
		}
	}
}

export default StorageIndexedDb
