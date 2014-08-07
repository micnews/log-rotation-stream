# log-rotation-stream

a writable stream that you can always append to.

``` js
var LogRotationStream = require('log-rotation-stream')

                                    // default $maxlogsize - 1gb
var stream = LogRotationStream($logdir, $maxlogsize)

BIGDATA.pipe(stream)
```

When the log file size gets to the max size it's moved into
a `$logdir/$year/$month/$day/$ISOtimestamp.log`. This makes
it easy to find the files containing any date range.

## License

MIT
