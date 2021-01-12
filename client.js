import HyperbaseTransportUnix from 'hyperbase/transport-unix/index.js'
import CustomEvent from 'xevents/custom-event.js'

function Client (opts = {}) {
  var name = opts.name || Math.random().toString().slice(2)
  var unix = new HyperbaseTransportUnix()
  var peer = unix.connect(opts.unixSocket)
  peer.database = { name }
  peer.addEventListener('connect', peer.auth)
  return peer
}

export default Client
