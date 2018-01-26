# hyperbase
A general purpose storage interface

## Why
I like the unix filesystem API a lot but it could be better:
* watch / unwatch should be as easy to use as read()
* it should be possible to atomically write data at multiple paths
* clients should be able to resolve arbitrary symlinks
* directories are great but there should also be an index or list type collection
  * these should be pageable in either direction and cheaply reorderable
  * these should provide a mechanism for determining total item count without loading all data

## How
The concept and library itself aims to be abstract, but each storage engine requires a concrete driver implementation. Currently there is [a driver](https://github.com/jessetane/hyperbase/blob/master/storage/firestore) available for [Cloud Firestore](https://firebase.google.com/docs/firestore) (Note that to work properly, the Firestore implementation relies on two [Cloud Functions](https://github.com/jessetane/hyperbase/blob/master/storage/functions)). It should be possible to implement additional drivers even over simple key/value stores like lmdb or leveldb for example, although these would be considerably more complex (no built in transactions, events, security, etc).

## Examples
Setup:
``` javascript
import Hyperbase from 'hyperbase'
import HyperbaseStorageFirestore from 'hyperbase/storage/firestore'

// var firebase = <get firebase handle somehow>

const db = new Hyperbase({
  storage: new HyperbaseStorageFirestore(firebase.firestore)
})
```

Working with Maps:
``` javascript
// storage layout:
// {
//   things: {
//     'a-thing': {
//       name: 'A thing'
//     }
//   }
// }

const thing = db.watch('things/a-thing', {
  type: 'map'
})

thing.on('change', () => {
  console.log(
    thing.loading,
    thing.key,
    thing.denormalize()
  )
  // => false, 'a-thing', { name: 'A thing' }
})
```

Working with Lists:
``` javascript
// storage layout:
// {
//   lists: {
//     'all-the-things': {
//       size: 2,
//       items: {
//         'a-thing': { i: 0 },
//         'other-thing': { i: 1 }
//       }
//     }
//   },
//   things: {
//     'a-thing': {
//       name: 'A thing'
//     },
//     'other-thing': {
//       name: 'Other thing'
//     }
//   }
// }

const allTheThings = db.watch('lists/all-the-things', {
  type: 'list',
  page: 0,
  pageSize: 10,
  reverse: false,
  each: {
    type: 'map',
    prefix: 'things'
  }
})

allTheThings.on('change', () => {
  var { loading, page, pageSize, length } = allTheThings

  console.log(
    loaded,
    length,
    allTheThings.denormalize().map(thing => thing.name)
  )
  // => false, 1000, [ 'A thing', 'Other thing', ... ]

  if (!loading && (page + 1) * pageSize < length) {
    // load the next page if there is one
    allTheThings.page++
  }
})
```

Reordering list items:
``` javascript
const allTheThings = db.watch('lists/all-the-things', {
  type: 'list',
  page: 0,
  pageSize: 10,
  each: {
    type: 'map',
    prefix: 'things'
  }
})

allTheThings.on('change', () => {
  if (allTheThings.loading) return

  var things = allTheThings.denormalize()
  var firstThing = things[0]
  var secondThing = things[1]

  var pageRelativeDestinationIndex = 0
  var patch = allTheThings.reorder(
    secondThing.key,
    pageRelativeDestinationIndex
  )
  console.log(patch)
  // => { 'lists/all-the-things/items/other-thing': { order: -1 } }

  db.write(patch, err => {
    app.log(err || 'Reordered successfully')
  })
})
```

Creating data:
``` javascript
const randomKey = db.create()

const aNewThing = {
  name: 'A new thing'
}

db.write({
  [randomKey]: aNewThing,
  [`lists/all-the-things/items/${randomKey}`]: { order: Date.now() }
}, err => {
  console.log(err || 'It worked')
})
```

Working with links:
``` javascript
// storage layout:
// {
//   things: {
//     'some-thing': {
//       name: 'Some thing',
//       i18n: {
//         es: 'x',
//         fr: 'y'
//       }
//     }
//   },
//   i18n: {
//     x: {
//       name: 'Alguna cosa'
//     },
//     y: {
//       name: 'Quelque chose'
//     }
//   }
// }

const thing = db.watch('things/some-thing', {
  type: 'map',
  link: {
    'i18n/es': {
      type: 'map'
    }
  }
})

thing.on('change', () => {
  console.log(thing.denormalize())

  // 1st time
  // => {
  //   name: 'Some thing',
  //   i18n: {
  //     es: {
  //       name: 'Alguna cosa'
  //     },
  //     fr: 'y'
  //   }
  // }

  // 2nd time
  // => {
  //   name: 'Some thing',
  //   i18n: {
  //     es: {
  //       name: 'Alguna cosa'
  //     },
  //     fr: {
  //       name: 'Quelque chose'
  //     }
  //   }
  // }

  thing.link = {
    'i18n/*': {
      type: 'map'
    }
  }
})
```

Nested links (and embedded Lists):
``` javascript
// storage layout:
// {
//   people: {
//     'a-person': {
//       name: 'A person',
//       'best-friend': 'b-person',
//       friends: {
//         'b-person': 0,
//         'c-person': 1
//       }
//     },
//     'b-person': {
//       name: 'B person',
//       'best-friend': 'c-person',
//       friends: {
//         'a-person': 0,
//         'c-person': 1
//       }
//     },
//     'c-person': {
//       name: 'C person',
//       'best-friend': 'a-person',
//       friends: {
//         'a-person': 0,
//         'b-person': 1
//       }
//     }
//   }
// }

const person = db.watch('a-person', {
  link: {
    friends: {
      type: 'list',
      each: {
        link: {
          'best-friend': {
            type: 'map'
          }
        }
      }
    }
  }
})

person.on('change', () => {
  if (person.loading) {
    console.log('Some links are still resolving...')
    return
  }

  console.log(person.denormalize())
  // => {
  //   name: 'A person',
  //   'best-friend': 'b-person',
  //   friends: [
  //     {
  //       name: 'B person',
  //       bestFriend: {
  //         name: 'C person',
  //         'best-friend': 'a-person',
  //         friends: { 'a-person': 0, ... }
  //       },
  //       friends: { 'a-person': 0, ... }
  //     }, {
  //       ...
  //     }
  //   ]
  // }
})
```

Deleting data:
``` javascript
const thing = db.watch('things/some-thing', {
  link: {
    'i18n/*': {
      type: 'map'
    }
  }
})

thing.on('change', () => {
  var patch = thing.delete()

  console.log(patch)
  // => {
  //   'things/some-thing': null,
  //   'i18n/x': null,
  //   'i18n/y': null
  // }

  patch['lists/all-the-things/items/some-thing'] = null

  db.write(patch, err => {
    console.log(err || 'It worked')
    db.unwatch(thing)
  })
})
```

## Test
You'll need a Firebase and service account credentials in a file called `google.json` first, then do:
```shell
$ npm run test/firestore
```

## Caveats
* A full local / remote round trip is required to resolve each link
* Cloud Firestore driver's list size feature needs help from Cloud Functions

## Changelog
* 3.0
  * Abstract again, Firestore driver provided
* 2.0
  * Tightly coupled with Firebase
* 1.0
  * First pass at abstract

## License
MIT
