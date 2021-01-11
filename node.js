import EventTarget from 'xevents/event-target.js'
import CustomEvent from 'xevents/custom-event.js'

class HyperbaseNode extends EventTarget {
  constructor (opts = {}) {
    super()
    this.database = opts.database
    this.transports = opts.transports || {}
    this.knownAddresses = opts.knownAddresses || []
    this.connectInterval = opts.connectInterval || 7500
    this.connect = this.connect.bind(this)
    this.accept = this.accept.bind(this)
    this.peers = {}
  }

  listen () {
    for (var protocol in this.transports) {
      var transport = this.transports[protocol]
      if (transport.listen && !transport.listening) {
        transport.addEventListener('accept', this.accept)
        transport.listen()
      }
    }
  }

  accept (evt) {
    var peer = evt.detail
    this.dispatchEvent(new CustomEvent('accept', { detail: peer }))
    this.setupPeer(peer)
  }

  connect () {
    this.knownAddresses.forEach(address => {
      // ws|ws://dns.name:8453
      // tcp|172.16.0.1|9000
			// unix|/tmp/hyperbase.sock
      for (var name in this.peers) {
        if (this.peers[name].address === address) return
      }
      var parts = address.split('|')
      var protocol = parts[0]
      var transport = this.transports[protocol]
      var peer = transport.connect(...parts.slice(1))
      peer.addEventListener('connect', () => {
        this.dispatchEvent(new CustomEvent('connect', { detail: peer }))
        peer.auth()
      })
      this.setupPeer(peer)
    })
    if (this.connectInterval) {
      var fuzzyInterval = Math.floor(this.connectInterval + this.connectInterval * Math.random())
      this.connectTimer = setTimeout(this.connect, fuzzyInterval)
    }
  }

  setupPeer (peer) {
    var oldName = peer.name
    this.peers[oldName] = peer
    peer.database = this.database
    peer.addEventListener('shouldauth', () => {
      if (peer.authState === true) {
        if (peer.name !== oldName) {
          var existing = this.peers[peer.name]
          if (existing) {
            peer.authState = new Error('peer already known')
            peer.authState.code = 1
            queueMicrotask(() => peer.close())
            return
          } else {
            delete this.peers[oldName]
            oldName = peer.name
            this.peers[oldName] = peer
          }
        }
      } else {
        queueMicrotask(() => peer.close())
      }
    })
    peer.addEventListener('auth', () => {
      this.dispatchEvent(new CustomEvent('auth', { detail: peer }))
    }, { once: true })
    peer.addEventListener('error', evt => {
      var err = evt.detail
      if (err.code === 1) {
        if (err.data && err.data.name) {
          for (var n in this.peers) {
            var p = this.peers[n]
            if (p.name === err.data.name) {
              p.address = peer.address
              break
            } 
          }
        }
      }
    })
    peer.addEventListener('close', () => {
      delete this.peers[oldName]
      this.dispatchEvent(new CustomEvent('disconnect', { detail: peer }))
    })
  }

  close () {
    clearTimeout(this.connectTimer)
    for (var name in this.transports) this.transports[name].close()
    for (var id in this.peers) this.peers[id].close()
  }
}

export default HyperbaseNode
