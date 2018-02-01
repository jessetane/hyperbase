module.exports = class HyperbaseStorageFirestore {
  constructor (firestore) {
    this.db = firestore()
    this.docIdFieldPath = firestore.FieldPath.documentId()
    this.observers = new Map()
  }

  watch (observer, onerror) {
    var parts = (observer.prefix + observer.key).split('/')
    var ckey = parts.slice(0, -1).join('/')
    var dkey = parts[parts.length - 1]
    var ref = this.db.collection(ckey).orderBy(this.docIdFieldPath).startAt(dkey).endAt(dkey).limit(1)
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
          observer.size = snap.docs[0].data().size || snap.size
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
    if (!meta) return
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
      var query = this.db.collection(observer.prefix + observer.key + '/items')
        .orderBy('i', observer.reverse ? 'desc' : 'asc')
      if (observer.page !== null) {
        switch (observer.pageDirection) {
          case 0:
            query = query.startAt(observer.page)
            break
          case 1:
            query = query.startAfter(observer.page)
            break
          case 2:
            query = query.endBefore(observer.page)
            break
          default:
            throw new Error('unknown page direction')
        }
      }
      meta.items = query.limit(observer.pageSize)
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
    if (observer.embedded) {
      var embedded = {}
      observer.data.forEach(item => embedded[item.key] = item.order)
      embedded[key] = position
      return {
        [observer.parent.prefix + observer.parent.key]: {
          [observer.key]: embedded
        }
      }
    }
    return {
      [`${observer.prefix}${observer.key}/items/${key}`]: {
        i: position
      }
    }
  }

  delete (observer) {
    var patch = {}
    if (observer.type === 'list') {
      if (observer.embedded) return patch
      observer.data.forEach(item => {
        patch[`${observer.prefix}${observer.key}/items/${item.key}`] = null
      })
    }
    patch[`${observer.prefix}${observer.key}`] = null
    return patch
  }
}
