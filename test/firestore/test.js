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
      'name b',
      'name c'
    ])
  })

  t.ok(list && list.loading)
})

tape('read embedded list', t => {
  t.plan(3)

  var map = hb.read('rooms/c', {
    link: {
      messages: {
        type: 'list',
        each: {
          prefix: 'messages'
        }
      }
    }
  }, (err, data) => {
    t.error(err)
    t.deepEqual(data.messages.map(m => m.message), [
      'message w',
      'message v',
      'message u'
    ])
  })

  t.ok(map && map.loading)
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

tape('reorder embedded list', t => {
  t.plan(7)

  var map = hb.watch('rooms/c', {
    link: {
      messages: {
        type: 'list',
        each: {
          prefix: 'messages'
        }
      }
    }
  })

  map.on('error', t.fail)

  var n = 0
  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize().messages

    if (n === 0) {
      n++
      t.deepEqual(data.map(m => m.message), [
        'message w',
        'message v',
        'message u'
      ])
      var patch = map.children.messages.reorder('w', 2)
      t.deepEqual(patch, {
        'rooms/c': {
          messages: {
            u: 2,
            v: 1,
            w: 3
          }
        }
      })
      hb.write(patch, err => t.error(err))
    } else if (n === 1) {
      n++
      t.deepEqual(data.map(m => m.message), [
        'message v',
        'message u',
        'message w'
      ])
      patch = map.children.messages.reorder('w', 0)
      t.deepEqual(patch, {
        'rooms/c': {
          messages: {
            u: 2,
            v: 1,
            w: 0
          }
        }
      })
      hb.write(patch, err => t.error(err))
    } else {
      t.deepEqual(data.map(m => m.message), [
        'message w',
        'message v',
        'message u'
      ])
      hb.unwatch(map)
    }
  })
})

tape('paginate', t => {
  t.plan(4)

  var list = hb.watch('indexes/rooms', {
    type: 'list',
    pageSize: 1,
    each: {
      prefix: 'rooms'
    }
  })

  list.on('error', t.fail)

  var n = 0
  list.on('change', () => {
    if (list.loading) return
    var data = list.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data.map(r => r.name), [
        'name a',
      ])
      list.next()
    } else if (n === 1) {
      n++
      t.deepEqual(data.map(r => r.name), [
        'name b',
      ])
      list.prev()
    } else if (n === 2) {
      n++
      t.deepEqual(data.map(r => r.name), [
        'name a',
      ])
      list.page = 2
    } else if (n === 3) {
      t.deepEqual(data.map(r => r.name), [
        'name c',
      ])
      hb.unwatch(list)
    }
  })
})

tape('paginate in reverse', t => {
  t.plan(4)

  var list = hb.watch('indexes/rooms', {
    type: 'list',
    pageSize: 1,
    reverse: true,
    each: {
      prefix: 'rooms'
    }
  })

  list.on('error', t.fail)

  var n = 0
  list.on('change', () => {
    if (list.loading) return
    var data = list.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data.map(r => r.name), [
        'name c',
      ])
      list.next()
    } else if (n === 1) {
      n++
      t.deepEqual(data.map(r => r.name), [
        'name b',
      ])
      list.prev()
    } else if (n === 2) {
      n++
      t.deepEqual(data.map(r => r.name), [
        'name c',
      ])
      list.page = 0
    } else if (n === 3) {
      t.deepEqual(data.map(r => r.name), [
        'name a',
      ])
      hb.unwatch(list)
    }
  })
})

tape('delete', t => {
  t.plan(4)

  var map = hb.watch('rooms/a', {
    link: {
      messages: {
        type: 'list',
        prefix: 'indexes',
        each: {
          prefix: 'messages'
        }
      }
    }
  })

  map.on('error', t.fail)

  var n = 0
  map.on('change', evt => {
    if (map.loading) return
    var data = map.denormalize()

    if (n === 0) {
      n++
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
      var patch = map.delete()
      t.deepEqual(patch, {
        'indexes/messages-by-room-a/items/x': null,
        'indexes/messages-by-room-a/items/y': null,
        'indexes/messages-by-room-a': null,
        'messages/x': null,
        'messages/y': null,
        'rooms/a': null
      })
      hb.write(patch, err => t.error(err))
    } else {
      if (evt.target.key !== 'rooms/a') return
      t.ok(map.notFound)
      hb.unwatch(map)
    }
  })
})

tape('delete embedded list', t => {
  t.plan(4)

  var map = hb.watch('rooms/c', {
    link: {
      messages: {
        type: 'list',
        each: {
          prefix: 'messages'
        }
      }
    }
  })

  map.on('error', t.fail)

  var n = 0
  map.on('change', evt => {
    if (map.loading) return
    var data = map.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data, {
        name: 'name c',
        messages: [
          {
            message: 'message w'
          }, {
            message: 'message v'
          }, {
            message: 'message u'
          }
        ]
      })
      var patch = map.delete()
      t.deepEqual(patch, {
        'messages/u': null,
        'messages/v': null,
        'messages/w': null,
        'rooms/c': null
      })
      hb.write(patch, err => t.error(err))
    } else {
      if (evt.target.key !== 'rooms/c') return
      t.ok(map.notFound)
      hb.unwatch(map)
    }
  })
})

tape('have no mounts', t => {
  t.plan(1)

  t.equal(hb.mounts.length, 0)
  setTimeout(() => process.exit(0))
})
