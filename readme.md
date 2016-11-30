# hyperbase
A general purpose storage interface.

## Why
Most "apps" I work on are essentially fancy database editors that multiple people can use simultaneously. This library is intended to be a living document about what I wish the most abstract tools I had to use in building these editors would look like.

## How
The current version depends on [Firebase](), which is a commercial project and so that's bad, but a lot of features it provides and are required for this design to be practical and I haven't found good free alternatives for all of them yet.

## Examples
These assume you have a Firebase app initialized like this:
``` javascript
import Firebase from 'firebase'

const remote = Firebase.initializeApp({
  apiKey: process.env.FIREBASE_CLIENT_ID,
  authDomain: `${process.env.FIREBASE_APP_ID}.firebaseapp.com`,
  databaseURL: `https://${process.env.FIREBASE_APP_ID}.firebaseio.com`,
  storageBucket: `${process.env.FIREBASE_APP_ID}.appspot.com`,
})
```

And a Hyperbase instance initialized like this:
``` javascript
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
    thing.serialize()
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
    allTheThings.serialize().map(thing => thing.name)
  )
  // => false, 1000, [ 'A thing', 'Other thing', ... ]

  if (!loading && (page + 1) * pageSize < length) {
    allTheThings.page++
  }
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
  console.log(thing.serialize())

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

  console.log(person.serialize())
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
  //   'b-thing': null,
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

## Pros
* Flexible

## Cons
* A full local / remote round trip is required to resolve each link

## License
MIT
