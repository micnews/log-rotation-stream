var crypto = require('crypto')

var i = 0

var bytes = crypto.pseudoRandomBytes(~~(1024*0.75)).toString('base64')

var random = module.exports = function (len) {
  len = len || 1024
  var d = new Date()
  return (
    'ts:' + (+d) +
    ' tz:' + (d.getTimezoneOffset()) +
    ' count:' + (++i) +
    ' msg:' + bytes
  )

  return {
    ts: +d,
    tz: d.getTimezoneOffset(),
    count: ++i,
    msg: bytes
  }
}

if(!module.parent) {

  var onDrain = require('./pummel')(1024*1024, function (d) {
    return process.stdout.write(random() + '\n')
  })

  process.stdout.on('drain', onDrain)
}
