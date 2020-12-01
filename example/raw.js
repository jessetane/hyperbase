import Hyperbase from 'hyperbase/index.js'
import HyperbaseStoreIndexedDb from 'hyperbase/store-indexeddb/index.js'
import HyperbaseCodecRaw from 'hyperbase/codec-raw/index.js'

window.db = new Hyperbase({
  store: new HyperbaseStoreIndexedDb(),
  codecs: {
    raw: new HyperbaseCodecRaw()
  }
})

console.log(db)
