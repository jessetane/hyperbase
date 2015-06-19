module.exports = function (storage) {
  require('./basic')(storage)
  require('./connection')(storage)
}
