var tape = require('tape')
var firebase = require('./test-firebase')
var Hyperbase = require('./')
var hb = new Hyperbase({
  storage: firebase.database().ref()
})

tape('read map data', t => {
  t.plan(3)

  var map = hb.read('things/a-thing', (err, data) => {
    t.error(err)
    t.deepEqual(data, {
      name: 'A thing'
    })
  })

  t.ok(map && map.loading)
})

tape('read list data', t => {
  t.plan(3)

  var list = hb.read('all-the-things', {
    type: 'list',
    each: {
      prefix: 'things'
    }
  }, (err, data) => {
    t.error(err)
    t.deepEqual(data.map(t => t.name), [
      'A thing',
      'B thing',
      'Some thing'
    ])
  })

  t.ok(list && list.loading)
})

tape('reorder list', t => {
  t.plan(10)

  var list = hb.watch('all-the-things', {
    type: 'list',
    each: {
      prefix: 'things'
    }
  })

  list.on('error', t.fail)

  var n = 0
  list.on('change', () => {
    if (list.loading) return
    var data = list.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data.map(t => t.key), [
        'a-thing',
        'b-thing',
        'c-thing'
      ])
      // move to index 2
      var patch = list.reorder('a-thing', 2)
      t.deepEqual(patch, {
        'all-the-things/a-thing': 3
      })
      hb.write(patch, err => t.error(err))
    } else if (n === 1) {
      n++
      t.deepEqual(data.map(t => t.key), [
        'b-thing',
        'c-thing',
        'a-thing'
      ])
      // move to index 1
      patch = list.reorder('a-thing', 1)
      t.deepEqual(patch, {
        'all-the-things/a-thing': 1.5
      })
      hb.write(patch, err => t.error(err))
    } else if (n === 2) {
      n++
      t.deepEqual(data.map(t => t.key), [
        'b-thing',
        'a-thing',
        'c-thing'
      ])
      // move back to index 0
      patch = list.reorder('a-thing', 0)
      t.deepEqual(patch, {
        'all-the-things/a-thing': 0
      })
      hb.write(patch, err => t.error(err))
    } else {
      t.deepEqual(data.map(t => t.key), [
        'a-thing',
        'b-thing',
        'c-thing'
      ])
      hb.unwatch(list)
    }
  })
})

tape('join on links', t => {
  t.plan(1)

  var map = hb.watch('b-thing', {
    prefix: 'things',
    link: {
      'other-thing': true
    }
  })

  map.on('error', t.fail)

  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize()

    t.deepEqual(data, {
      name: 'B thing',
      'other-thing': {
        name: 'A thing'
      }
    })

    hb.unwatch(map)
  })
})

tape('join on wildcard links', t => {
  t.plan(1)

  var map = hb.watch('c-thing', {
    prefix: 'things',
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
      name: 'Some thing',
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

tape('join on wildcard links that match wild filter', t => {
  t.plan(2)

  var map = hb.watch('c-thing', {
    prefix: 'things',
    link: {
      'i18n/*': {
        prefix: 'i18n',
        wild: [
          ['es-MX', 'es']
        ]
      }
    }
  })

  map.on('error', t.fail)

  var n = 0
  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize()

    if (n === 0) {
      n++
      t.deepEqual(data, {
        name: 'Some thing',
        i18n: {
          es: {
            name: 'Alguna cosa'
          },
          'es-ES': 'f28de'
        }
      })
      // alter link to prefer es-ES instead of es-MX
      var newLink = map.link
      newLink['i18n/*'].wild = [
        ['es-ES', 'es']
      ]
      map.link = newLink
    } else {
      t.deepEqual(data, {
        name: 'Some thing',
        i18n: {
          es: 'c3dda',
          'es-ES': {
            name: 'Alguna cosita'
          }
        }
      })
      hb.unwatch(map)
    }
  })
})

tape('join on wildcard links that match wild filter with regex', t => {
  t.plan(1)

  var map = hb.watch('c-thing', {
    prefix: 'things',
    link: {
      'i18n/*': {
        prefix: 'i18n',
        wild: [
          [/.*/]
        ]
      }
    }
  })

  map.on('error', t.fail)

  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize()
    t.deepEqual(data, {
      name: 'Some thing',
      i18n: {
        es: {
          name: 'Alguna cosa'
        },
        'es-ES': 'f28de'
      }
    })
    hb.unwatch(map)
  })
})

tape('join on nested wildcard links', t => {
  t.plan(1)

  var map = hb.watch('d-thing', {
    prefix: 'things',
    link: {
      'nested/*/thing': {
        link: {
          'other-thing': true
        }
      }
    }
  })

  map.on('error', t.fail)

  map.on('change', () => {
    if (map.loading) return
    var data = map.denormalize()

    t.deepEqual(data, {
      name: 'D thing',
      nested: {
        x: {
          thing: {
            name: 'A thing'
          }
        },
        y: {
          thing: {
            name: 'B thing',
            'other-thing': {
              name: 'A thing'
            }
          }
        }
      }
    })

    hb.unwatch(map)
  })
})

tape('have no mounts', t => {
  t.plan(1)

  t.equal(hb.mounts.length, 0)
  setTimeout(() => process.exit(0))
})
