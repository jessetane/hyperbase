var tape = require('tape')
var hyperbase = require('../')
var client = hyperbase.Client()
var storage = null
var server = null
var db = null

module.exports = function (_storage) {
  storage = _storage
  server = storage.Server()
  client.pipe(server).pipe(client)
  db = hyperbase(client)
  db.remove()
}

tape('disconnect', function (t) {
  t.plan(1)

  client.once('unpipe', function () {
    t.pass()
  })

  server.close()
})

tape('reconnect', function (t) {
  t.plan(1)

  server = storage.Server()
  client.pipe(server).pipe(client)

  db.update(42, function () {
    db.once('value', function (value) {
      t.equal(value, 42)
    })
  })
})

tape('buffer operations while disconnected, only resend 1x', function (t) {
  t.plan(5)

  var didReconnect = false
  var methods = {}
  var n = 0

  client.timeout = 100
  client.send = function (message) {
    if (didReconnect) {
      if (methods[message.method]) t.fail()
      else methods[message.method] = true
      t.pass()
      if (++n === 3) delete client.send
    }
    hyperbase.Client.prototype.send.call(this, message)
  }

  client.once('unpipe', function () {
    server = storage.Server()
    client.pipe(server).pipe(client)
    didReconnect = true
  })

  server.close()

  db.update(23, function (err) {
    if (!didReconnect) t.fail()
    t.error(err)
  })

  db.once('value', function (value) {
    if (!didReconnect) t.fail()
    t.equal(value, 23)
  })
})

tape('listeners get reattached after reconnect', function (t) {
  t.plan(2)

  var n = 0

  db.on('value', function (value) {
    if (n === 0) {
      t.equal(value, 23)
      n++
    } else {
      t.equal(value, 42)
      db.off('value')
    }
  })

  client.once('unpipe', function () {
    server = storage.Server()
    client.pipe(server).pipe(client)
    db.update(42)
  })

  server.close()
})
