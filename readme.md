# hyperbase
Lexicographically sorted key/value database with directories. Backed by [level](https://github.com/level/classic-level) on the server and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) on the client.

## why
Minimum viable database. Lightweight, portable, easy to hack on and understand.

## how
In process or via RPC over unix socket or TCP. Batteries included CLI Just Works.

### CLI (client/server RPC over unix socket or TCP)
```shell
$ npm install -g hyperbase
$ hyperbase serve &
$ hyperbase write foo bar
$ hyperbase read foo
{ path: [ 'foo' ], data: 'bar' }
```

### In-process
```javascript
import StorageLevel from 'hyperbase/storage/level'
const db = new StorageLevel()
await db.write({ path: ['foo'], data: 'bar' })
const item = await db.read(['foo'])
console.log(item)
{ path: [ 'foo' ], data: 'bar' }
```

### In-process (web browser)
```javascript
import StorageIndexedDb from 'hyperbase/storage/indexeddb.js'
const db = new StorageIndexedDb()
await db.write({ path: ['foo'], data: 'bar' })
const item = await db.read(['foo'])
console.log(item)
{ path: [ 'foo' ], data: 'bar' }
```

### RPC over unix socket
```javascript
import TransportUnix from 'hyperbase/transport/unix.js'
// server
const server = new TransportUnix()
await server.listen()
// client
const peer = await TransportUnix.connect()
await peer.write({ path: ['foo'], data: 'bar' })
const item = await peer.read(['foo'])
console.log(item)
{ path: [ 'foo' ], data: 'bar' }
```

### RPC over TCP
```javascript
import TransportTcp from 'hyperbase/transport/tcp.js'
// server
const server = new TransportTcp()
await server.listen()
// client
const peer = await TransportTcp.connect()
await peer.write({ path: ['foo'], data: 'bar' })
const item = await peer.read(['foo'])
console.log(item)
{ path: [ 'foo' ], data: 'bar' }
```

## API

### `const db = new Storage(opts)`
Creates a new database instance. Use `StorageLevel` in Node.js and `StorageIndexedDb` in the browser.

- `opts` An optional Object.
  - filename (StorageLevel) Defaults to data.level in the current working directory
  - dbname (StorageIndexedDb) Defaults to default

### `await db.write(batch)`
Writes one or more values.

- `batch` An Object or Array of Objects with path (Array of keys) and data (value) properties. Set data to null to delete.

```javascript
// write a single value
await db.write({ path: ['foo'], data: 'bar' })

// write multiple values for atomic updates
await db.write([
  { path: ['foo'], data: 'bar' },
  { path: ['bar', 'foo'], data: 'baz' }
])

// delete a value
await db.write({ path: ['foo'], data: null })
```

### `await db.read(path)`
Reads a value from the specified path.

- `path` An Array of keys.

```javascript
await db.read(['foo'])
// { path: [ 'foo' ], data: 'bar' }
```

### `await db.list(path[, opts])`
Lists key-value pairs under the specified path.

- `path` An Array of keys.
- `opts` An optional Object.
  - gte (String) Greater than or equal to
  - gt (String) Greater than
  - lte (String) Less than or equal to
  - lt (String) Less than
  - reverse (Boolean) Reverse the order of results
  - limit (Number) Maximum number of results

```javascript
// list all items under users
await db.list(['users'])
// [ { path: [ 'users', 'foo' ], data: 'bar' }, ... ]

// list items with keys starting after 'foo'
await db.list(['users'], { gt: 'foo' })
```

## Test
```shell
$ node test.js
```

## License
MIT
