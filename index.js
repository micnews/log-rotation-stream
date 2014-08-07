var Stream = require('stream')
var path   = require('path')
var fs     = require('fs')
var mkdirp = require('mkdirp')
//create a directory, and then start writing files into it.
//write each file upto max size,
//then create a new current file
//and then move the old files into an archive directory.
//with directories for year/month/day ?
//or make the depth of the directories configurable?

function pad (s) {
  return s < 10 ? '0'+s : ''+s
}

module.exports = function (dir, maxsize) {
  maxsize = maxsize || 1024*1024*1024
  var s = new Stream()

  var _stream, start, moving

  var n = 0

  function headfilename (start) {
    return path.join(dir, 'head' + start.toISOString() + '.log')
  }

  var headfile

  function datedir (date) {
    return path.join(
      dir,
      ''+ date.getFullYear(),
      pad(date.getMonth()),
      pad(date.getDay())
    )
  }

  function rotate (cb) {
    if(!_stream) {
      create()
      if(cb) cb()
      return
    }
    //move the current file to it's archive location.
    //we will still be writing to this, but this is a rename
    //so the inode won't change so this should be okay.
    //I don't know how *your* filesystem works, though.
    console.error('rotate',
      datedir(start), start.toISOString(), written
    )

    written = 0
    moving = true
    fs.rename(
      headfile,
      path.join(datedir(start), start.toISOString()),
      function (err) {
        moving = false
        //I don't know how to handle the error here.
        //probably we want to log it. emit for now
        //which will be easier to debug.
        if(err) return s.emit('error', err)
        create()
        if(cb) cb()
      })

  }

  function create () {
    //end old, and create a new file.
    console.log('create')
    if(_stream) _stream.end()

    start = new Date()
    _stream = fs.createWriteStream(headfile = headfilename(start))

    _stream.start = start

    _stream.on('drain', function () {
      s.emit('drain')
    })
    _stream.on('close', function () {
      s.emit('drain')
    })
    var logdir = datedir(start)

    mkdirp(logdir, function (err) {
      if(err) s.emit('error', err)
      //create the directory that we will put the file
      //into later. technically this is a race condition
      //but it is fair to assume that writing one log
      //will take much much longer than ensuring a few
      //directories exist.
    })
  }

  var written = 0

  s.writable = true

  s.write = function (data, enc) {
    if((written += data.length) > maxsize) rotate()
    if(moving) console.log('.')
    return _stream.write(data, enc)
  }

  s.end = function (data, enc) {
    if(data)
      _stream.write(data, enc)
    rotate(function () {
      _stream.end()
    })
  }

  create()

  return s
}

