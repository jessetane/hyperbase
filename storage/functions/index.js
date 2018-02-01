var functions = require('firebase-functions')
var admin = require('firebase-admin')

admin.initializeApp(functions.config().firebase)

var db = admin.firestore()

exports.onThingCreate = functions.firestore.document('indexes/{collectionId}/items/{docId}').onCreate(evt => {
  var counter = db.doc(`indexes/${evt.params.collectionId}`)
  return db.runTransaction(tx => {
    return tx.get(counter).then(doc => {
      var size = doc.data().size
      if (isNaN(size)) {
        size = 1
      } else {
        size++
      }
      return tx.update(counter, { size })
    })
  })
})

exports.onThingDelete = functions.firestore.document('indexes/{collectionId}/items/{docId}').onDelete(evt => {
  var counter = db.doc(`indexes/${evt.params.collectionId}`)
  return db.runTransaction(tx => {
    return tx.get(counter).then(doc => {
      var size = doc.data().size
      if (isNaN(size)) {
        size = 0
      } else {
        size--
      }
      return tx.update(counter, { size })
    })
  })
})
