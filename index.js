var Stream  = require('stream')
var path    = require('path')
var fs      = require('fs')
var mkdirp  = require('mkdirp')
var isodate = require('regexp-isodate')
var assert  = require('assert')
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
  var debug = !!process.env.DEBUG
  maxsize = maxsize || 1024*1024*1024
  var s = new Stream()
  s.buffer = []
  var _stream, start, moving, creating = false, ts

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

    written = 0
    moving = true
    fs.rename(
      headfile,
      path.join(datedir(start), start.toISOString() + '.log'),
      function (err) {
        moving = false
        //I don't know how to handle the error here.
        //probably we want to log it. emit for now
        //which will be easier to debug.
        if(err) return s.emit('error', err)
        create()
        if(cb) cb()
      }
    )
  }

  function create () {
    //end old, and create a new file.
    if(creating) return
    creating = true
    if(_stream) {
      _stream.end()
      _stream = null
      fresh()
    }
    else
      check()

    function check () {
      fs.readdir(dir, function (err, ls) {
        var files = ls.filter(function (filename) {
          return isodate.test(filename)
        }).sort()
        var name = files.pop()
        if(!name) fresh()
        else {
          var filename = name ? path.join(dir, name) : null
          fs.stat(filename, function (err, stat) {
            if(err) {
              // if the file did not exist at this point,
              // it must have been deleted between when we got it from readdir
              // and now, so just ignore this and continue like it wasn't there.
              return fresh()
            }
            else if(stat.size < maxsize) {
              written = stat.size
              var stream =
                fs.createWriteStream(headfile = filename, {flags: 'a'})
                start = stream.start = new Date(isodate.exec(name)[0])
              next(stream)
            }
            else fresh()
          })
        }
      })
    }

    function fresh () {
      start = new Date()
      var stream = fs.createWriteStream(headfile = headfilename(start))
      stream.start = start
      next(stream)
    }

    function next (stream) {

      var logdir = datedir(start)

      mkdirp(logdir, function (err) {
        if(err) return s.emit('error', err)

        _stream = stream
        creating = false

        if(debug && s.buffer.length) {
          var chunkStart = new Date(+/\d+/.exec(s.buffer[0])[0])
          if(ts)
            assert.ok(
              ts <= stream.start,
              'last timestamp from previous logfile *must* be earlier than next stream'
            )
          assert.ok(
            stream.start <= chunkStart,
            'first timestamp in logfile must be greater or equal to timestamp in filename'
          )
        }

        while(s.buffer.length) {
          var data = s.buffer.shift()
          _stream.write(data)
          if((written += data.length) > maxsize) return rotate()
        }
        _stream.start = start

        _stream.on('drain', function () {
          s.emit('drain')
        })
        _stream.on('close', function () {
          s.emit('drain')
        })


      })
    }
  }

  var written = 0

  s.writable = true

  s.write = function (data, enc) {
    //while _stream does not exist, buffer and return paused.

    //track the latest timestamp in the file, so we can test
    //that the last record in the previous file is < timestamp in next file.
    if(!_stream) {
      s.buffer.push(data)
      return false
    }
    if((written += data.length) > maxsize) rotate()
    if(debug) {
      var lastLine = data.substring(data.lastIndexOf('\n', data.length - 2))
      ts = new Date(+/\d+/.exec(lastLine)[0])
    }
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

