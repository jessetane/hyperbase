var tape = require('tape')
var hyperbase = require('./')
var client = hyperbase.Client()
var db = null

module.exports = function (server) {
  client.pipe(server).pipe(client)
  db = hyperbase(client)
}

tape('create data', function (t) {
  t.plan(3)

  var n = 0

  db.on('value', function (value) {
    if (n++ === 0) {
      t.equal(value, undefined)
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

tape('remove data', function (t) {
  t.plan(3)

  var n = 0

  db.on('value', function (value) {
    if (n++ === 0) {
      t.equal(value.hello, 'world')
    } else {
      t.equal(value, undefined)
      db.off('value')
    }
  })

  db.remove(function (err) {
    t.error(err)
  })
})
