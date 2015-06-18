# dbase
A general purpose storage interface.

## Warning
This is just an experiment! Don't use it for anything serious!

## Why
I want something a bit more practical than levelup, but more abstract / open than CouchDB, Firebase, etc. Keeping some notes here for now.

## How
Streaming JSON-RPC. Pipe client and server streams together directly or over tcp / websocket / data-channel etc. Pass a client stream to the dbase constructor to get a handle.

## Example
Wire things up:
``` javascript
var dbase = require('dbase')
var dbaseStorage = require('dbase-localstorage')

var storage = dbaseStorage()
var server = storage.Server()
var client = dbase.Client()

client.pipe(server).pipe(client)
```

Get a handle:
``` javascript
var db = dbase(client)
```

Make an update:
``` javascript
var thing = db.child('things/0')
thing.update({ answer: 42 })
```

Watch / unwatch a value:
``` javascript
db.on('value', function (value) {
  console.log(value)
  db.off('value')
})
// "{ things: { 0: { answer: 42 }}}"
```

Watch a key space:
``` javascript
var things = db.child('things')

things.on('key_added', function (key) {
  console.log('added', key)
})

things.on('key_removed', function (key) {
  console.log('removed', key)
})

things.child('1').update({ hello: 'world' }) // "added 1"
things.child('1').remove()                   // "removed 1"
```

## JavaScript API

#### `var dbase = require('dbase')`

## Constructors

#### `var client = dbase.Client()`
Creates a duplex RPC stream that can be connected to dbase server and shared across multiple dbase instances.

#### `var db = dbase(client)`
Creates a new dbase instance.
* `client` should be an instance of dbase.Client.

## Properties

#### `db.path`
The instance's full address in the database hierarchy.

#### `db.key`
The instance's address in the hierarchy relative to its parent.

## Methods

#### `var child = db.child(path)`
Returns a new dbase instance connected to the same client as the caller, but restricted to operating on the location indicated by `path`.
* `path` a slash delimited relative address.

#### `var db = child.parent()`
Returns a new dbase instance, the opposite of `.child()`.

#### `child.update(value [, cb])`
* `value` an ArrayBuffer, String or Object. If Object, this method will patch any existing data.
* `cb` an optional success / error callback.

#### `child.remove([cb])`
* `cb` an optional success / error callback.

#### `child.on(eventType, handler)`
* `eventType` can be:
  * `"value"` passes data to the handler upon initial registration and whenever any change occurs.
  * `"key_added"` passes the key of any newly addded immediate child.
  * `"key_removed"` passes the key of any newly removed immediate child.
* `handler` the function to call when the specified event type occurs.

#### `child.off(eventType [, handler])`
* `handler` can be the function that was originally registered for the event type, or omitted to unregister all the event type's handlers.

## JSON-RPC API
(For server implementors)

TODO

## License

WTFPL
