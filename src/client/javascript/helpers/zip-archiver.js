/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2017, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

'use strict';

const FS = require('utils/fs.js');
const API = require('core/api.js');
const VFS = require('vfs/fs.js');
const XHR = require('utils/xhr.js');
const Utils = require('utils/misc.js');

/**
 * @namespace ZipArchiver
 * @memberof OSjs.Helpers
 */

function getEntries(file, callback) {
  zip.createReader(new zip.BlobReader(file), function(zipReader) {
    zipReader.getEntries(function(entries) {
      callback(false, entries);
    });
  }, function(message) {
    callback(message);
  });
}

function getEntryFile(entry, onend, onprogress) {
  let writer = new zip.BlobWriter();
  entry.getData(writer, function(blob) {
    onend(blob);
    writer = null;
  }, onprogress);
}

function openFile(file, done) {
  console.log('-->', 'openFile()');

  VFS.download(file, (error, data) => {
    if ( error ) {
      console.warn('An error while opening zip', error);
      done(error);
      return;
    }

    const blob = new Blob([data], {type: file.mime});
    getEntries(blob, (error, result) => {
      done(error, result || []);
    });
  });
}

function importFiles(writer, entries, pr, done, ignore) {
  ignore = ignore || [];

  console.log('-->', 'importFiles()', entries);

  function _next(index) {
    if ( !entries.length || index >= entries.length ) {
      done(false);
      return;
    }

    let current = entries[index];
    if ( ignore.indexOf(current.filename) >= 0 ) {
      console.warn('Ignoring', index, current);
      pr('ignored', index, current);
      _next(index + 1);
      return;
    }

    console.log('Importing', index, current);

    getEntryFile(current, function(blob) {
      writer.add(current.filename, new zip.BlobReader(blob), () => {
        pr('added', index, current);
        _next(index + 1);
      }, (current, total) => {
        pr('reading', index, total, current);
      }, {
        directory: current.directory,
        lastModDate: current.lastModDate,
        version: current.version
      });
    });
  }

  _next(0);
}

function createZip(done) {
  console.log('-->', 'createZip()');

  const writer = new zip.BlobWriter();
  zip.createWriter(writer, (writer) => {
    done(false, writer);
  }, function(error) {
    done(error);
  });
}

function saveZip(writer, file, ccb) {
  console.log('-->', 'saveZip()');

  writer.close((blob) => {
    VFS.upload({
      destination: FS.dirname(file.path),
      files: [{filename: FS.filename(file.path), data: blob}]
    }, (type, ev) => {
      const error = (type === 'error') ? ev : false;
      ccb(error, !!error);
    }, {overwrite: true});
  });
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

let SingletonInstance = null;

/**
 * The GoogleAPI wrapper class
 *
 * <pre><b>
 * This is a private class and can only be aquired through
 * OSjs.Helpers.ZipArchiver.createInsatance()
 *
 * Generally you want to create an instance of this helper
 * and when successfully created use `window.zip` use the instance helpers.
 * </b></pre>
 *
 * @summary Helper for handling ZIP files.
 *
 * @example
 * OSjs.Helpers.ZipArchiver.createInstance({}, (err, instance) => {});
 *
 * @constructor Class
 * @memberof OSjs.Helpers.ZipArchiver
 * @see OSjs.Helpers.ZipArchiver.createInsatance
 */
class ZipArchiver {

  /**
   * @param {Object}    opts      Options
   */
  constructor(opts) {
    this.opts = opts;
    this.inited = false;
    this.preloads = [{
      type: 'javascript',
      src: '/vendor/zip.js/WebContent/zip.js'
    }];
  }

  init(cb) {
    cb = cb || function() {};

    if ( this.inited ) {
      cb();
      return;
    }

    XHR.preload(this.preloads, (total, failed) => {
      if ( failed.length ) {
        cb(API._('ZIP_PRELOAD_FAIL'), failed);
        return;
      }

      if ( window.zip ) {
        zip.workerScriptsPath = '/vendor/zip.js/WebContent/';

        this.inited = true;
      }

      cb();
    });
  }

  /**
   * Lists contents of a ZIP file
   *
   * @function list
   * @memberof OSjs.Helpers.ZipArchiver.Class#
   *
   * @param   {OSjs.VFS.File}     file          File to extract
   * @param   {Function}          cb            Callback function => fn(error, entries)
   */
  list(file, cb) {
    VFS.download(file, (error, result) => {
      if ( error ) {
        alert(error);

        cb(error, null);
        return;
      }

      const blob = new Blob([result], {type: 'application/zip'});
      getEntries(blob, (error, entries) => {
        cb(error, entries);
      });
    });
  }

  /**
   * Create a new blank ZIP file
   *
   * @function create
   * @memberof OSjs.Helpers.ZipArchiver.Class#
   *
   * @param   {OSjs.VFS.File}               file          File to extract
   * @param   {Function}                    cb            Callback function => fn(error)
   * @param   {OSjs.Core.Application}       [appRef]      Application reference
   */
  create(file, cb, appRef) {
    const writer = new zip.BlobWriter();
    zip.createWriter(writer, (writer) => {
      writer.close((blob) => {
        VFS.upload({
          destination: FS.dirname(file.path),
          files: [
            {filename: FS.filename(file.path), data: blob}
          ]
        }, (type, ev) => {
          if ( type === 'error' ) {
            console.warn('Error creating blank zip', ev);
          }
          writer = null;

          if ( type !== 'error' ) {
            API.message('vfs:upload', file, {source: appRef ? appRef.__pid : null});
          }

          cb(type === 'error' ? ev : false, type !== 'error');
        }, {overwrite: true});
      });
    });
  }

  /**
   * Add a entry to the ZIP file
   *
   * @function add
   * @memberof OSjs.Helpers.ZipArchiver.Class#
   * @TODO Adding directory does not actually add files inside dirs yet
   *
   * @param   {OSjs.VFS.File}     file                Archive File
   * @param   {OSjs.VFS.File}     add                 File to add
   * @param   {Object}            args                Arguments
   * @param   {String}            [args.path=/]       Root path to add to
   * @param   {Function}          args.onprogress     Callback on progress => fn(state[, args, ...])
   * @param   {Function}          args.oncomplete     Callback on complete => fn(error, result)
   */
  add(file, add, args) {
    const cb = args.oncomplete || function() {};
    const pr = args.onprogress || function() {};
    const currentDir = args.path || '/';

    console.group('ZipArchiver::add()');
    console.log('Archive', file);
    console.log('Add', file);

    function finished(err, res) {
      console.groupEnd();
      cb(err, res);
    }

    function checkIfExists(entries, done) {
      console.log('-->', 'checkIfExists()');

      let found = false;
      let chk = FS.filename(add.path);

      entries.forEach((i) => {
        if ( i.filename === chk ) {
          if ( !i.directory || (i.directory && add.type === 'dir') ) {
            found = true;
          }
        }
        return !found;
      });

      done(found ? 'File is already in archive' : false);
    }

    function addFile(writer, done) {
      let filename = add instanceof window.File ? add.name : add.filename;
      let type = add instanceof window.File ? 'file' : (add.type || 'file');

      console.log('-->', 'addFile()', filename, type, add);

      filename = ((currentDir || '/').replace(/\/$/, '') + '/' + filename).replace(/^\//, '');

      function _addBlob(blob) {
        console.log('-->', 'addFile()', '-->', '_addBlob()');

        writer.add(filename, new zip.BlobReader(blob), () => {
          console.log('ADDED FILE', filename);

          saveZip(writer, file, done);
        }, (current, total) => {
          pr('compressing', current);
        });
      }

      function _addFolder() {
        console.log('-->', 'addFile()', '-->', '_addFolder()');
        writer.add(filename, null, () => {
          console.log('ADDED FOLDER', filename);

          saveZip(writer, file, done);
        }, null, {directory: true});
      }

      if ( type === 'dir' ) {
        _addFolder();
      } else {
        if ( add instanceof window.File ) {
          _addBlob(add);
        } else {
          VFS.download(add, (error, data) => {
            if ( error ) {
              done(error);
              return;
            }

            const blob = new Blob([data], {type: add.mime});
            _addBlob(blob);
          });
        }
      }
    }

    // Proceed!
    openFile(file, (err, entries) => {
      if ( err ) {
        finished(err); return;
      }

      checkIfExists(entries, (err) => {
        if ( err ) {
          finished(err); return;
        }

        createZip((err, writer) => {
          if ( err ) {
            finished(err); return;
          }

          importFiles(writer, entries, pr, (err) => {
            if ( err ) {
              finished(err); return;
            }
            addFile(writer, (err) => {
              finished(err, !!err);
            });
          });
        });
      });
    });

  }

  /**
   * Removes an entry from ZIP file
   *
   * @function remove
   * @memberof OSjs.Helpers.ZipArchiver.Class#
   *
   * @param   {OSjs.VFS.File}     file          Archive File
   * @param   {String}            path          Path
   * @param   {Function}          cb            Callback function => fn(err, result)
   */
  remove(file, path, cb) {

    console.group('ZipArchiver::remove()');
    console.log('Archive', file);
    console.log('Remove', path);

    function finished(err, res, writer) {
      if ( err || !writer ) {
        console.groupEnd();
        cb(err || API._('ZIP_NO_RESOURCE'));
        return;
      }

      saveZip(writer, file, (eer, rees) => {
        console.groupEnd();
        cb(eer, rees);
      });
    }

    if ( !path ) {
      finished(API._('ZIP_NO_PATH'));
      return;
    }

    openFile(file, (err, entries) => {
      if ( err ) {
        finished(err); return;
      }

      createZip((err, writer) => {
        if ( err ) {
          finished(err); return;
        }

        importFiles(writer, entries, () => {
        }, (err) => {
          finished(err, !!err, writer);
        }, [path]);
      });
    });
  }

  /**
   * Extract a File to destination
   *
   * @function extract
   * @memberof OSjs.Helpers.ZipArchiver.Class#
   *
   * @param   {OSjs.VFS.File}         file                 File to extract
   * @param   {String}                destination          Destination path
   * @param   {Object}                args                 Arguments
   * @param   {Function}              args.onprogress      Callback on progress => fn(filename, currentIndex, totalIndex)
   * @param   {Function}              args.oncomplete      Callback on complete => fn(error, warnings, result)
   * @param   {OSjs.Core.Application} [args.app]           Application reference
   */
  extract(file, destination, args) {
    args = args || {};

    args.onprogress = args.onprogress || function(/*filename, current, total*/) {};
    args.oncomplete = args.oncomplete || function(/*error, warnings, result*/) {};

    console.group('ZipArchiver::extract()');
    console.log('Archive', file);
    console.log('Destination', destination);

    function finished(error, warnings, result) {
      if ( !error ) {
        API.message('vfs:update', destination, {source: args.app ? args.app.__pid : null});
      }

      console.groupEnd();
      args.oncomplete(error, warnings, result);
    }

    let extracted = [];
    let warnings = [];
    let total = 0;

    function _extractList(list, destination) {
      total = list.length;
      console.debug('ZipArchiver::extract()', 'Extracting', total, 'item(s)');

      let index = 0;

      function _extract(item, cb) {
        args.onprogress(item.filename, index, total);

        let dest = destination;
        if ( item.filename.match(/\//) ) {
          if ( item.directory ) {
            dest += '/' + item.filename;
          } else {
            dest += '/' + FS.dirname(item.filename);
          }
        }

        console.log('Extract', item, dest);
        if ( item.directory ) {
          VFS.mkdir(new VFS.File(dest), (error, result) => {
            if ( error ) {
              warnings.push(Utils.format('Could not create directory "{0}": {1}', item.filename, error));
            } else {
              extracted.push(item.filename);
            }

            cb();
          });
          return;
        }

        getEntryFile(item, (blob) => {
          console.log('....', blob);
          VFS.upload({
            destination: dest,
            files: [{filename: Utils.filename(item.filename), data: blob}]
          }, (type, ev) => { // error, result, ev
            console.warn('ZipArchiver::extract()', '_extract()', 'upload', type, ev);

            if ( type === 'error' ) {
              warnings.push(Utils.format('Could not extract "{0}": {1}', item.filename, ev));
            } else {
              extracted.push(item.filename);
            }

            cb();
          });

        }, () => {
        });
      }

      function _finished() {
        console.log('Extract finished', total, 'total', extracted.length, 'extracted', extracted);
        console.log(warnings.length, 'warnings', warnings);
        finished(false, warnings, true);
      }

      function _next() {
        if ( !list.length || index >= list.length ) {
          _finished();
          return;
        }

        _extract(list[index], () => {
          index++;
          _next();
        });
      }

      _next();
    }

    function _checkDirectory(destination, cb) {
      console.debug('ZipArchiver::extract()', 'Checking destination');

      const dst = new VFS.File({path: destination, type: 'dir'});
      VFS.mkdir(dst, (error, result) => {
        if ( error ) {
          console.warn('ZipArchiver::extract()', '_checkDirectory()', 'VFS::mkdir()', error);
        }

        VFS.exists(dst, (err, result) => {
          if ( err ) {
            console.warn('ZipArchiver::extract()', '_checkDirectory()', 'VFS::exists()', err);
          }

          if ( result ) {
            cb(false);
          } else {
            cb('Destination directory was not created or does not exist');
          }
        });
      });
    }

    console.debug('ZipArchiver::extract()', 'Downloading file...');

    VFS.download(file, (error, result) => {
      if ( error ) {
        finished(error, warnings, false);
        return;
      }

      const blob = new Blob([result], {type: 'application/zip'});
      _checkDirectory(destination, (err) => {

        if ( err ) {
          finished(error, warnings, false);
          return;
        }

        getEntries(blob, (error, entries) => {
          if ( error ) {
            finished(error, warnings, false);
            return;
          }

          _extractList(entries, destination);
        });
      });
    });
  }
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = {
  instance: function() {
    return SingletonInstance;
  },
  create: function(args, callback) {
    args = args || {};
    if ( !SingletonInstance ) {
      SingletonInstance = new ZipArchiver(args);
    }

    SingletonInstance.init((error) => {
      if ( !error ) {
        if ( !window.zip ) {
          error = API._('ZIP_VENDOR_FAIL');
        }
      }
      callback(error, error ? false : SingletonInstance);
    });
  }
};
