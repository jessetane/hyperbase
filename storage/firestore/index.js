module.exports = class HyperbaseStorageFirestore {
  constructor (firestore) {
    this.db = firestore()
    this.docIdFieldPath = firestore.FieldPath.documentId()
    this.deleteFieldValue = firestore.FieldValue.delete()
    this.observers = new Map()
  }

  watch (observer, onerror) {
    var key = observer.prefix + observer.key
    var parts = key.split('/')
    var meta = {}
    this.observers.set(observer, meta)
    if (observer.type === 'list' && !observer.counted && !observer.asMap) {
      this.update(observer, onerror)
      return
    }
    var ckey = parts.slice(0, -1).join('/')
    var dkey = parts[parts.length - 1]
    var ref = this.db.collection(ckey).orderBy(this.docIdFieldPath).startAt(dkey).endAt(dkey).limit(1)
    meta.unwatch = ref.onSnapshot(snap => {
      var doc = snap.docs[0]
      if (observer.type === 'list') {
        if (observer.asMap) {
          doc = doc ? doc.data() : {}
          var orderBy = observer.order
          observer.data = Object.keys(doc).map((itemKey, i) => {
            var data = doc[itemKey]
            var item = {
              key: itemKey,
              order: typeof data === 'number'
                ? data
                : orderBy
                  ? data[orderBy]
                  : i,
              data
            }
            return item
          })
          observer.update()
        } else {
          observer.size = doc ? doc.data().size : snap.size
          if (meta.unwatchItems) {
            if (observer.data) {
              observer.update()
            }
          } else {
            this.update(observer)
          }
        }
      } else {
        observer.data = doc ? doc.data() : null
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
    if (meta.unwatch) {
      meta.unwatch()
    }
  }

  update (observer, onerror) {
    var meta = this.observers.get(observer)
    if (observer.type === 'list') {
      if (observer.asMap) return
      if (meta.unwatchItems) {
        meta.unwatchItems()
      }
      var key = observer.prefix + observer.key
      if (observer.counted) {
        key += '/items'
      }
      var orderBy = observer.order || this.docIdFieldPath
      var query = this.db.collection(key).orderBy(orderBy, observer.reverse ? 'desc' : 'asc')
      orderBy = typeof orderBy === 'string' ? orderBy : null
      for (var key in observer.where) {
        query = query.where(key, '==', observer.where[key])
      }
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
      meta.unwatchItems = query.limit(observer.pageSize).onSnapshot(snap => {
        observer.data = snap.docs.map((doc, i) => {
          var data = doc.data()
          var item = {
            key: doc.id,
            order: orderBy ? data[orderBy] : i,
            data
          }
          return item
        })
        observer.update()
      }, onerror)
    }
  }

  write (patch, cb) {
    var batch = this.db.batch()
    for (var key in patch) {
      var value = patch[key]
      if (value === null) {
        batch.delete(this.db.doc(key))
      } else {
        if (typeof value === 'object') {
          for (var fieldKey in value) {
            if (value[fieldKey] === null) {
              value[fieldKey] = this.deleteFieldValue
            }
          }
        }
        batch.update(this.db.doc(key), value)
      }
    }
    batch.commit().then(() => cb(), cb)
  }

  reorder (observer, key, position) {
    if (observer.type !== 'list') {
      throw new Error('observer must be a list')
    }
    if (observer.embedded) {
      var embedded = {}
      return {
        [observer.parent.prefix + observer.parent.key]: {
          [`${observer.key}.${key}`]: position
        }
      }
    }
    var counted = observer.counted ? `items/` : ''
    return {
      [`${observer.prefix}${observer.key}/${counted}${key}`]: {
        [observer.order]: position
      }
    }
  }

  delete (observer) {
    var patch = {}
    if (observer.embedded) return patch
    if (observer.type === 'list') {
      var counted = observer.counted ? `items/` : ''
      observer.data.forEach(item => {
        patch[`${observer.prefix}${observer.key}/${counted}${item.key}`] = null
      })
      if (!counted) return patch
    }
    patch[`${observer.prefix}${observer.key}`] = null
    return patch
  }
}
