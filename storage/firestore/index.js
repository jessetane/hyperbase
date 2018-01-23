module.exports = class HyperbaseStorageFirestore {
  constructor (firestore) {
    this.firestore = firestore
    this.db = firestore()
    this.observers = new Map()
  }

  watch (observer, onerror) {
    var parts = (observer.prefix + observer.key).split('/')
    var ckey = parts.slice(0, -1).join('/')
    var dkey = parts[parts.length - 1]
    var ref = this.db.collection(ckey).where('id', '==', dkey)
    var meta = { ref }
    this.observers.set(observer, meta)
    meta.unwatch = ref.onSnapshot(snap => {
      if (observer.type === 'list') {
        if (snap.size === 0) {
          if (meta.items) {
            meta.unwatchItems()
            delete meta.unwatchItems
            delete meta.items
          }
          observer.size = 0
          observer.data = []
          observer.update()
        } else {
          observer.size = snap.docs[0].data().size || 0
          if (meta.unwatchItems) {
            observer.update()
          } else {
            this.update(observer)
          }
        }
      } else {
        observer.data = snap.size ? snap.docs[0].data() : null
        observer.update()
      }
    }, onerror)
  }

  unwatch (observer) {
    var meta = this.observers.get(observer)
    this.observers.delete(observer)
    if (observer.type === 'list') {
      if (meta.unwatchItems) {
        meta.unwatchItems()
      }
    }
    meta.unwatch()
  }

  update (observer) {
    var meta = this.observers.get(observer)
    if (observer.type === 'list') {
      if (meta.unwatchItems) {
        meta.unwatchItems()
      }
      meta.items = this.db.collection(observer.prefix + observer.key + '/items')
        .orderBy('i', observer.reverse ? 'desc' : 'asc')
        .offset(observer.page * observer.pageSize)
        .limit(observer.pageSize)
      meta.unwatchItems = meta.items.onSnapshot(snap => {
        observer.data = snap.docs.map(doc => {
          return {
            key: doc.id,
            order: doc.data().i
          }
        })
        observer.update()
      })
    }
  }

  write (patch, cb) {
    var batch = this.db.batch()
    for (var key in patch) {
      var value = patch[key]
      if (value === null) {
        batch.delete(this.db.doc(key))
      } else {
        batch.update(this.db.doc(key), patch[key])
      }
    }
    batch.commit().then(() => {
      cb()
    }).catch(err => {
      cb(err)
    })
  }

  reorder (observer, key, position) {
    if (observer.type !== 'list') {
      throw new Error('observer must be a list')
    }
    return {
      [`${observer.prefix}${observer.key}/items/${key}`]: {
        i: position
      }
    }
  }

  delete (observer) {
    return {
      [`${observer.prefix}${observer.key}`]: null
    }
  }
}
