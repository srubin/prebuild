var eachSeries = require('each-series-async')
var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var tar = require('tar-stream')
var zlib = require('zlib')

function mode (octal) {
  return parseInt(octal, 8)
}

function pack (filenames, tarPath, cb) {
  mkdirp(path.dirname(tarPath), function () {
    if (!Array.isArray(filenames)) {
      filenames = [filenames]
    }

    var tarStream = tar.pack()
    var ws = fs.createWriteStream(tarPath)
    tarStream.pipe(zlib.createGzip({ level: 9 })).pipe(ws)

    eachSeries(filenames, function processFile (filename, nextFile) {
      fs.lstat(filename, function (err, st) {
        if (err) return nextFile(err)

        var header = {
          name: filename.replace(/\\/g, '/').replace(/:/g, '_'),
          size: st.size,
          mode: st.mode | mode('444') | mode('222'),
          gid: st.gid,
          uid: st.uid,
        }

        if (st.isSymbolicLink()) {
          fs.readlink(filename, function (err, linkname) {
            if (err) return nextFile(err)
            header.type = 'symlink'
            header.linkname = linkname
            tarStream.entry(header)
            nextFile()
          })
        } else {
          var stream = tarStream.entry(header)
          fs.createReadStream(filename).pipe(stream).on('finish', nextFile)
          stream.on('error', nextFile)
        }
      })
    }, function allFilesProcessed (err) {
      tarStream.finalize()
      cb(err)
    })
  })
}

module.exports = pack
