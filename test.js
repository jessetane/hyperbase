import fs from 'fs/promises'
import tap from 'tap-esm'
import { spawn, delay } from './util-test.js'

let server;
const dbFile = 'test.level'
const socketFile = '/tmp/hyperbase-test.sock'
const transport = '--unix=' + socketFile

tap('start server', async t => {
	await fs.rm(dbFile, { force: true, recursive: true })
	server = spawn(`node cli.js --db=${dbFile} ${transport} serve`)
	await delay(250)
})

tap('check client', async t => {
	const client = spawn(`node cli.js ${transport} list`)
	const { stdout } = await client.onclose
	t.equal(stdout, '[]')
})

tap('write', async t => {
	const client = spawn(`node cli.js ${transport} write a 42`)
	const { stdout } = await client.onclose
	t.equal(stdout, 'ok')
})

tap('read', async t => {
	const client = spawn(`node cli.js ${transport} read a`)
	const { stdout } = await client.onclose
	t.equal(stdout, `{ path: [ 'a' ], data: '42' }`)
})

tap('nested write', async t => {
	const client = spawn(`node cli.js ${transport} write users/foo/name Foo`)
	const { stdout } = await client.onclose
	t.equal(stdout, 'ok')
})

tap('nested read', async t => {
	const client = spawn(`node cli.js ${transport} read users/foo/name`)
	const { stdout } = await client.onclose
	t.equal(stdout, `{ path: [ 'users', 'foo', 'name' ], data: 'Foo' }`)
})

tap('list nested', async t => {
	const client = spawn(`node cli.js ${transport} list users/foo`)
	const { stdout } = await client.onclose
	t.equal(stdout, `[ { path: [ 'users', 'foo', 'name' ], data: 'Foo' } ]`)
})

tap('delete', async t => {
	const client = spawn(`node cli.js ${transport} write a`)
	const { stdout } = await client.onclose
	t.equal(stdout, 'ok')
})

tap('verify delete', async t => {
	const client = spawn(`node cli.js ${transport} read a`)
	const { stdout } = await client.onclose
	t.equal(stdout, `{ path: [ 'a' ], data: null }`)
})

tap('close server', async t => {
	server.process.kill('SIGINT')
	await server.onclose
})
