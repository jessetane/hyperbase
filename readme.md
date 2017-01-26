# hyperbase
A general purpose storage interface

## Why
I like the classic filesystem api a lot but it could be better:
* watch / unwatch should be as easy to use as read()
* it should be possible to atomically write data at multiple paths
* there should be an index or list type collection in addition to directories
  * these should be pageable in either direction and cheaply reorderable
* clients should be able to read collections and their children wholesale and join on arbitrary symlinks

## How
The current version depends on [Firebase](https://firebase.google.com) which is a commercial product and so that's not ideal. Also Firebase doesn't let you count child nodes in a collection without reading all of them so true pageable indexes are not possible. It does provide a lot of other useful features that I am not interested in reimplementing for the purposes of this sketch though, maybe you can suggest an alternative?

## Examples
Setup:
``` javascript
import Firebase from 'firebase'

const remote = Firebase.initializeApp({
  apiKey: process.env.FIREBASE_CLIENT_ID,
  authDomain: `${process.env.FIREBASE_APP_ID}.firebaseapp.com`,
  databaseURL: `https://${process.env.FIREBASE_APP_ID}.firebaseio.com`,
  storageBucket: `${process.env.FIREBASE_APP_ID}.appspot.com`,
})

import Hyperbase from 'hyperbase'

const base = new Hyperbase({
  storage: remote.database().ref()
})
```

Working with Maps:
``` javascript
const thing = base.load('a-thing', {
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
const allTheThings = base.load('all-the-things', {
  type: 'list',
  page: 0,
  pageSize: 10,
  reverse: false,
  each: {
    type: 'map'
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
    allTheThings.page++
  }
})
```

Reordering list items:
``` javascript
const allTheThings = base.load('all-the-things', {
  type: 'list',
  page: 0,
  pageSize: 10,
  each: {
    type: 'map'
  }
})

allTheThings.on('change', () => {
  var things = allTheThings.denormalize()
  var firstThing = things[0]
  var secondThing = things[1]

  var pageRelativeDestinationIndex = 0
  var patch = allTheThings.reorder(
    secondThing.key,
    pageRelativeDestinationIndex
  )

  base.write(patch, err => {
    app.log(err || 'Reordered successfully')
  })
})
```

Creating data:
``` javascript
const randomKey = base.create()

const aNewThing = {
  name: 'A new thing'
}

base.write({
  [randomKey]: aNewThing,
  [`all-the-things/${randomKey}`]: Date.now(),
}, err => {
  console.log(err || 'It worked')
})
```

Working with links:
``` javascript
const thing = base.load('some-thing', {
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
  //     fr: 'key-for-french-translation'
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

Nested relationships:
``` javascript
const person = base.load('a-person', {
  type: 'map',
  link: {
    friends: {
      type: 'list',
      each: {
        type: 'map',
        link: {
          bestFriend: {
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
  //   bestFriend: 'some-person',
  //   friends: [
  //     {
  //       name: 'B person',
  //       bestFriend: {
  //         name: 'C person',
  //         bestFriend: 'b-person',
  //         friends: { 'b-person': 1480476889245, ... }
  //       },
  //       friends: { 'c-person': 1480476889246, ... }
  //     }, {
  //       ...
  //     }
  //   ]
  // }
})
```

Deleting data:
``` javascript
const thing = base.load('some-thing', {
  type: 'map',
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
  //   'some-thing': null,
  //   'es-b-thing': null,
  //   'fr-b-thing': null
  // }

  patch['all-the-things/some-thing'] = null

  base.write(patch, err => {
    console.log(err || 'It worked')
    base.unload(thing)
  })
})
```

## Test
You'll need a Firebase and service account credentials in a file called `google.json` first, then do:
```shell
$ npm run test
```

## Pros
* Flexible

## Cons
* A full local / remote round trip is required to resolve each link
* Pageable indexes are faked by loading all keys and only paging the values
* Depends on a commercial project for the moment

## License
MIT
