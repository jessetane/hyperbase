# hyperbase
Lexicographically sorted key/value database with directories. Minimalist design, blazing performance, isomorphic interface. Backed by [level](https://github.com/level/classic-level) on the server and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) on the client.

## why
Minimum viable database. Lightweight, portable.

## how
In process or via RPC over unix socket or TCP. Batteries included CLI Just Works.

### CLI (client/server RPC over unix socket or TCP)
```shell
$ npm install -g hyperbase
$ hyperbase serve &
$ hyperbase write users/foo/name Foo
$ hyperbase read users/foo/name
{ path: [ 'users', 'foo', 'name' ], data: 'Foo' }
```

### In-process
```javascript
import StorageLevel from 'hyperbase/storage/level'
const db = new StorageLevel()
await db.write({ path: ['users', 'foo', 'name'], data: 'Foo' })
const item = await db.read(['users', 'foo', 'name'])
console.log(item)
{ path: [ 'users', 'foo', 'name' ], data: 'Foo' }
```

### In-process (web browser)
```javascript
import StorageIndexedDb from 'hyperbase/storage/indexeddb.js'
const db = new StorageIndexedDb()
await db.write({ path: ['users', 'foo', 'name'], data: 'Foo' })
const item = await db.read(['users', 'foo', 'name'])
console.log(item)
{ path: [ 'users', 'foo', 'name' ], data: 'Foo' }
```

### RPC over unix socket
```javascript
import TransportUnix from 'hyperbase/transport/unix.js'
// server
const server = new TransportUnix()
await server.listen()
// client
const peer = await TransportUnix.connect()
await peer.write({ path: ['users', 'foo', 'name'], data: 'Foo' })
const item = await peer.read(['users', 'foo', 'name'])
console.log(item)
{ path: [ 'users', 'foo', 'name' ], data: 'Foo' }
```

### RPC over TCP
```javascript
import TransportTcp from 'hyperbase/transport/tcp.js'
// server
const server = new TransportTcp()
await server.listen()
// client
const peer = await TransportTcp.connect()
await peer.write({ path: ['users', 'foo', 'name'], data: 'Foo' })
const item = await peer.read(['users', 'foo', 'name'])
console.log(item)
{ path: [ 'users', 'foo', 'name' ], data: 'Foo' }
```

## Test
```shell
$ node test.js
```

## License
MIT
