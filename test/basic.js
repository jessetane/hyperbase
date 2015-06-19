var tape = require('tape')
var hyperbase = require('../')
var client = hyperbase.Client()
var db = null

module.exports = function (storage) {
  client.pipe(storage.Server()).pipe(client)
  db = hyperbase(client)
  db.remove()
}

tape('value updates', function (t) {
  t.plan(3)

  var n = 0

  db.on('value', function (value) {
    if (n++ === 0) {
      t.equal(value, null)
    } else {
      t.equal(value.hello, 'world')
      db.off('value')
    }
  })

  db.update({
    hello: 'world'
  }, function (err) {
    t.error(err)
  })
})

tape('value removals', function (t) {
  t.plan(3)

  var n = 0

  db.on('value', function (value) {
    if (n++ === 0) {
      t.equal(value.hello, 'world')
    } else {
      t.equal(value, null)
      db.off('value')
    }
  })

  db.remove(function (err) {
    t.error(err)
  })
})

tape('update patches values', function (t) {
  t.plan(3)

  db.update({
    question: 'universe'
  }, function () {
    db.update({
      answer: 42
    }, function () {
      db.once('value', function (value) {
        t.equal(value.question, 'universe')
        t.equal(value.answer, 42)

        db.remove(function (err) {
          t.error(err)
        })
      })
    })
  })
})

tape('value caching', function (t) {
  t.plan(8)

  var n = 0
  var s = 0

  client.send = function (message) {
    t.equal(n++, s)
    hyperbase.Client.prototype.send.call(this, message)
  }

  db.on('value', function (value) {
    t.equal(value, null)

    // should pull from the cache (no send)
    db.on('value', function (value) {
      t.equal(value, null)

      // should remove all listeners and send 1 message
      s++
      db.off('value', null, function (err) {
        t.error(err)

        // should send since the cache is only used when we have > 1 listener
        s++
        db.on('value', function (value) {
          t.equal(value, null)

          // remove again, should send
          s++
          db.off('value')
          delete client.send
        })
      })
    })
  })
})

tape('key_added', function (t) {
  t.plan(4)

  var n = 0
  var expected = [ null, 'x', 'y', 'z' ]

  db.on('key_added', function (key) {
    t.equal(key, expected[n++])
  })

  db.update({
    x: 1,
    y: 2
  })

  db.update({
    z: 3
  })
})

tape('key_added caching', function (t) {
  t.plan(4)

  var n = 0
  var expected = [ 'x', 'y', 'z' ]
  var shouldSend = false

  client.send = function (message) {
    if (shouldSend) {
      t.pass()
    } else {
      t.fail()
    }

    hyperbase.Client.prototype.send.call(this, message)
  }

  db.on('key_added', function (key) {
    t.equal(key, expected[n++])

    if (n === 2) {
      shouldSend = true
      db.off('key_added')
      delete client.send
    }
  })
})

tape('key_removed', function (t) {
  t.plan(3)

  var n = 0
  var expected = [ 'x', 'y', 'z' ]

  db.update({
    x: 1,
    y: 2,
    z: 3
  })

  db.on('key_removed', function (key) {
    t.equal(key, expected[n++])
  })

  db.remove()
})
