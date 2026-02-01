import { Storage } from './index.js'
import { ClassicLevel } from 'classic-level'

class StorageLevel extends Storage {
	constructor (opts = {}) {
		super(opts)
		if (opts.filename) {
			this.filename = opts.filename
		} else {
			this.filename = process.cwd() + '/data.level'
		}
		this.db = new ClassicLevel(this.filename)
	}

	write (batch) {
		if (!Array.isArray(batch)) batch = [batch]
		batch = batch.map(req => {
			var path = this.pathToStr(req.path)
			if (!path) {
				throw new Error('invalid path ' + JSON.stringify(req.path, null, 2))
			}
			if (req.data === null) {
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
		return { path, data }
	}

	async list (path, opts = {}) {
		const strPathPre = super.list(path, opts)
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
				data: value
			}
		})
	}

	close () {
		return this.db.close()
	}
}

export default StorageLevel
