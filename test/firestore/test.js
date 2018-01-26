var tape = require('tape')
var Hyperbase = require('../../')
var HyperbaseStorageFirestore = require('../../storage/firestore')
var hb = null

module.exports = function (firebase) {
  hb = new Hyperbase({
    storage: new HyperbaseStorageFirestore(
      firebase.firestore
    )
  })
}

tape('read map', t => {
  t.plan(3)

  var map = hb.read('rooms/a', (err, data) => {
    t.error(err)
    t.deepEqual(data.name, 'name a')
  })

  t.ok(map && map.loading)
})

tape('read list', t => {
  t.plan(3)

  var list = hb.read('indexes/rooms', {
    type: 'list',
    each: {
      prefix: 'rooms'
    }
  }, (err, data) => {
    t.error(err)
    t.deepEqual(data.map(t => t.name), [
      'name a',
      'name b'
    ])
  })

  t.ok(list && list.loading)
})

tape('join on links', t => {
  t.plan(1)

  var map = hb.watch('a', {
    prefix: 'rooms',
    link: {
      messages: {
        prefix: 'indexes',
        type: 'list',
        each: {
          prefix: 'messages'
        }
      }
    }
  })

  map.on('error', t.fail)

  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize()

    t.deepEqual(data, {
      name: 'name a',
      messages: [
        {
          message: 'message x'
        }, {
          message: 'message y'
        }
      ]
    })

    hb.unwatch(map)
  })
})

tape('join on wildcard links', t => {
  t.plan(1)

  var map = hb.watch('z', {
    prefix: 'messages',
    link: {
      'i18n/*': {
        prefix: 'i18n'
      }
    }
  })

  map.on('error', t.fail)

  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize()

    t.deepEqual(data, {
      message: 'message z',
      i18n: {
        es: {
          name: 'Alguna cosa'
        },
        'es-ES': {
          name: 'Alguna cosita'
        }
      }
    })

    hb.unwatch(map)
  })
})

tape('reorder list', t => {
  t.plan(7)

  var list = hb.watch('indexes/messages-by-room-a', {
    type: 'list',
    each: {
      prefix: 'messages'
    }
  })

  list.on('error', t.fail)

  var n = 0
  list.on('change', () => {
    if (list.loading) return
    var data = list.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data.map(m => m.message), [
        'message x',
        'message y'
      ])
      // move to index 1
      var patch = list.reorder('x', 1)
      t.deepEqual(patch, {
        'indexes/messages-by-room-a/items/x': {
          i: 2
        }
      })
      hb.write(patch, err => t.error(err))
    } else if (n === 1) {
      n++
      t.deepEqual(data.map(m => m.message), [
        'message y',
        'message x'
      ])
      // move back to index 0
      patch = list.reorder('x', 0)
      t.deepEqual(patch, {
        'indexes/messages-by-room-a/items/x': {
          i: 0
        }
      })
      hb.write(patch, err => t.error(err))
    } else {
      t.deepEqual(data.map(m => m.message), [
        'message x',
        'message y'
      ])
      hb.unwatch(list)
    }
  })
})

tape('reorder list while reversed', t => {
  t.plan(7)

  var list = hb.watch('indexes/messages-by-room-a', {
    type: 'list',
    reverse: true,
    each: {
      prefix: 'messages'
    }
  })

  list.on('error', t.fail)

  var n = 0
  list.on('change', () => {
    if (list.loading) return
    var data = list.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data.map(m => m.message), [
        'message y',
        'message x'
      ])
      // move to index 1
      var patch = list.reorder('x', 0)
      t.deepEqual(patch, {
        'indexes/messages-by-room-a/items/x': {
          i: 2
        }
      })
      hb.write(patch, err => t.error(err))
    } else if (n === 1) {
      n++
      t.deepEqual(data.map(m => m.message), [
        'message x',
        'message y'
      ])
      // move back to index 0
      patch = list.reorder('x', 1)
      t.deepEqual(patch, {
        'indexes/messages-by-room-a/items/x': {
          i: 0
        }
      })
      hb.write(patch, err => t.error(err))
    } else {
      t.deepEqual(data.map(m => m.message), [
        'message y',
        'message x'
      ])
      hb.unwatch(list)
    }
  })
})

tape('have no mounts', t => {
  t.plan(1)

  t.equal(hb.mounts.length, 0)
  setTimeout(() => process.exit(0))
})
