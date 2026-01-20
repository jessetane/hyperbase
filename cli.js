#!/usr/bin/env node

import TransportTcp from './transport/tcp.js'
import TransportUnix from './transport/unix.js'
import StorageLevel from './storage/level.js'
import { utf8 } from './util.js'
import fs from 'fs/promises'

const pkg = JSON.parse(await fs.readFile('package.json'))
const opts = {}
const args = process.argv.slice(2).filter(a => {
	if (a.indexOf('-') === 0) {
		let [key, value] = a.split('=')
		while (key[0] === '-') key = key.slice(1)
		opts[key] = value || true
	} else {
		return true
	}
})
const cmd = args[0]
let params = []
switch (cmd) {
	case 'version':
		console.log(`hyperbase version ${pkg.version}`)
		break
	case 'write':
		params = [{ path: args[1].split('/'), data: args[2] }]
		connect()
		break
	case 'read':
		params = [args[1].split('/').map(p => p === '*' ? null : p)]
		connect()
		break
	case 'list':
		const path = args[1] ? args[1].split('/').map(p => p === '*' ? null : p) : []
		const subOpts = new Function(`return ${opts.params || '{}'}`)()
		if (subOpts.limit === undefined) {
			subOpts.limit = 25
		}
		params = [path, subOpts]
		connect()
		break
	case 'serve':
		serve()
		break
	default:
		console.log(`hyperbase ${pkg.version}

commands:
version
serve [--db=db.level]
write path/to/key [value] (omit value to delete)
read path/to/key [--format=utf8|json]
list path/to/key [--format=utf8|json] [--params={gte:'b',limit:25}]

common options:
--unix --unix=/tmp/hyperbase.sock
--tcp --tcp=::1:8453`)
}

async function connect () {
	if (!opts.unix && !opts.tcp) {
		opts.unix = true
	} else if (opts.unix && opts.tcp) {
		throw new Error('cannot set unix AND tcp')
	}
	const peer = opts.tcp
		? await TransportTcp.connect(typeof opts.tcp === 'string' ? opts.tcp : '::1:8453')
		: await TransportUnix.connect(typeof opts.unix === 'string' ? opts.unix : '/tmp/hyperbase.sock')
	console.error('connecting to ' + peer.address)
	peer.addEventListener('disconnect', evt => { if (evt.detail) throw evt.detail })
	const res = await peer[cmd](...params)
	if (res === undefined) {
		console.log('ok')
	} else {
		if (Array.isArray(res)) {
			for (let entry of res) {
				entry.data = render(entry.data)
			}
		} else {
			res.data = render(res.data)
		}
		console.log(res)
	}
	process.exit(0)
}

function render (value) {
	switch (opts.format) {
		case 'json':
			return value ? JSON.parse(utf8.decode(value)) : value
		case 'utf8':
		default:
			return value ? utf8.decode(value) : value
	}
}

async function serve () {
	// storage
	const database = new StorageLevel({ filename: opts.db || 'db.level' })
	let unix, tcp;
	// default to unix only
	if (!opts.unix && !opts.tcp) {
		opts.unix = true
	}
	// unix server
	if (opts.unix) {
		unix = new TransportUnix({
			database,
			file: typeof opts.unix === 'string' ? opts.unix : '/tmp/hyperbase.sock'
		})
		unix.addEventListener('accept', evt => {
			const peer = evt.detail
			console.log('unix.accept:', peer.address)
		})
		await unix.listen()
		console.log('unix.listen:', unix.file)
	}
	// tcp server
	if (opts.tcp) {
		const address = typeof opts.tcp === 'string' ? opts.tcp : '::1:8453'
		const parts = address.split(':') || []
		const host = parts.slice(0, -1).join(':')
		const port = parts.at(-1)
		tcp = new TransportTcp({ database, port, host })
		tcp.addEventListener('accept', evt => {
			const peer = evt.detail
			console.log('tcp.accept:', peer.address)
		})
		await tcp.listen()
		console.log('tcp.listen:', tcp.host + ':' + tcp.port)
	}
	// graceful shutdown
	process.once('SIGINT', code => {
		unix?.close()
		tcp?.close()
	})
}
