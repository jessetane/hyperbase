var tools = require('firebase-tools')
var firebase = require('firebase-admin')
var google = require('../../google.json')

var fixture = {
  indexes: {
    rooms: {
      items: {
        a: {
          i: 0
        },
        b: {
          i: 1
        }
      }
    },
    'messages-by-room-a': {
      items: {
        x: {
          i: 0
        },
        y: {
          i: 1
        }
      }
    },
    'messages-by-room-b': {
      items: {
        z: {
          i: 0
        }
      }
    }
  },
  rooms: {
    a: {
      name: 'name a',
      messages: 'messages-by-room-a'
    },
    b: {
      name: 'name b'
    },
    c: {
      name: 'name c',
      messages: {
        u: 2,
        v: 1,
        w: 0
      }
    }
  },
  messages: {
    u: {
      message: 'message u'
    },
    v: {
      message: 'message v'
    },
    w: {
      message: 'message w'
    },
    x: {
      message: 'message x'
    },
    y: {
      message: 'message y'
    },
    z: {
      message: 'message z',
      i18n: {
        es: 'c3dda',
        'es-ES': 'f28de'
      }
    }
  },
  i18n: {
    c3dda: {
      name: 'Alguna cosa'
    },
    f28de: {
      name: 'Alguna cosita'
    }
  }
}

firebase.initializeApp({
  credential: firebase.credential.cert(google),
  databaseURL: `https://${google.project_id}.firebaseio.com`
})

if (process.argv[2] === '--reset') {
  deleteAll()
} else {
  require('./test')(firebase)
}

function deleteAll () {
  tools.firestore.delete(google.project_id, {
    allCollections: true,
    yes: true
  }).then(() => {
    console.log()
    console.log('Waiting for deletion hooks...')
    setTimeout(() => {
      createFixtures()
    }, 3000)
  }).catch(err => {
    console.error(err)
  })
}

function createFixtures () {
  var db = firebase.firestore()
  var batch = db.batch()
  for (var ckey in fixture) {
    var collection = fixture[ckey]
    for (var dkey in collection) {
      var data = collection[dkey]
      var doc = db.doc(`${ckey}/${dkey}`)
      if (ckey === 'indexes') {
        var tmp = Object.assign({}, data)
        delete tmp.items
        batch.set(doc, tmp)
        for (var skey in data.items) {
          var sdoc = db.doc(`${ckey}/${dkey}/items/${skey}`)
          batch.set(sdoc, data.items[skey])
        }
      } else {
        batch.set(doc, data)
      }
    }
  }
  batch.commit().then(() => {
    console.log('Waiting for creation hooks...')
    setTimeout(() => {
      require('./test')(firebase)
    }, 3000)
  }).catch(err => {
    console.error(err)
  })
}
