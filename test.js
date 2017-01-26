var firebase = require('./test-firebase')

var fixture = {
  things: {
    'a-thing': {
      name: 'A thing'
    },
    'b-thing': {
      name: 'B thing',
      'other-thing': 'a-thing'
    },
    'c-thing': {
      name: 'Some thing',
      i18n: {
        es: 'c3dda',
        'es-ES': 'f28de'
      }
    },
    'd-thing': {
      name: 'D thing',
      nested: {
        x: {
          thing: 'a-thing'
        },
        y: {
          thing: 'b-thing'
        }
      }
    }
  },
  'all-the-things': {
    'a-thing': 0,
    'b-thing': 1,
    'c-thing': 2
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

firebase.database().ref().set(fixture, err => {
  if (err) throw err
  require('./tests')
})
