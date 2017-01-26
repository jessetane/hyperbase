var Firebase = require('firebase-admin')
var env = require('./google.json')

module.exports = Firebase.initializeApp({
  credential: Firebase.credential.cert(env),
  databaseURL: `https://${env.project_id}.firebaseio.com`
})
