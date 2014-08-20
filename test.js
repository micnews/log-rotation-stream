

var rotate = require('./')
var random = require('./random')
var path = require('path')

function pummel (l, write) {

  function dump() {
    while(l --> 0)
      if(!write()) return
  }

  dump()

  return dump
}

var stream =
  rotate(path.join(__dirname, '_logs'), 1024*1024*100)

var l = 0, c = 0, b = '', start = Date.now()

//create 10gb worth of logs
var onDrain = pummel(1024*1024*10, function () {
  var r = random() + '\n'
  l += r.length
  c++
  if(!(c % 20000))
    process.stdout.write(
      //mega bytes written per second
      ((l / ((Date.now() - start)/1000) / 1000000))
      + '\n'
    )

  if(b.length < 1024*30) {
    b += r
    return true
  }

  var _b = b
  b = ''

  return stream.write(_b)
})

stream.on('drain', onDrain)
