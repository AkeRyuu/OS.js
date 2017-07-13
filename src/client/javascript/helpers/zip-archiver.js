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
import Process from 'core/process';
import FileMetadata from 'vfs/file';
import * as VFS from 'vfs/fs';
import * as FS from 'utils/fs';
import * as Utils from 'utils/misc';
import {preload} from 'utils/preloader';
import {_} from 'core/locales';

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

  VFS.download(file).then((data) => {
    const blob = new Blob([data], {type: file.mime});
    getEntries(blob, (error, result) => {
      done(error, result || []);
    });
  }).catch((error) => {
    console.warn('An error while opening zip', error);
    done(error);
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
    }, {overwrite: true})
      .then(() => ccb(false, true))
      .catch((error) => ccb(error, false));
  });
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

let SingletonInstance = null;

/**
 * The GoogleAPI wrapper class
 *
 * @desc Helper for handling ZIP files.
 *
 * <pre><b>
 * This is a private class and can only be aquired through
 * OSjs.Helpers.ZipArchiver.createInsatance()
 *
 * Generally you want to create an instance of this helper
 * and when successfully created use `window.zip` use the instance helpers.
 * </b></pre>
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

    preload(this.preloads).then((result) => {
      if ( result.failed.length ) {
        cb(_('ZIP_PRELOAD_FAIL'), result.failed);
        return;
      }

      if ( window.zip ) {
        zip.workerScriptsPath = '/vendor/zip.js/WebContent/';

        this.inited = true;
      }

      cb();
    }).catch(() => cb());
  }

  /**
   * Lists contents of a ZIP file
   *
   * @param   {OSjs.VFS.File}     file          File to extract
   * @param   {Function}          cb            Callback function => fn(error, entries)
   */
  list(file, cb) {
    VFS.download(file).then((result) => {
      const blob = new Blob([result], {type: 'application/zip'});
      getEntries(blob, (error, entries) => {
        cb(error, entries);
      });
    }).catch((error) => {
      alert(error);
      cb(error, null);
    });
  }

  /**
   * Create a new blank ZIP file
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
        }, {
          overwrite: true
        }).then(() => {
          writer = null;
          Process.message('vfs:upload', file, {source: appRef ? appRef.__pid : null});
        }).catch((error) => {
          writer = null;
          cb(error, false);
        });
      });
    });
  }

  /**
   * Add a entry to the ZIP file
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
          VFS.download(add).then((data) => {
            const blob = new Blob([data], {type: add.mime});
            _addBlob(blob);
          }).catch(done);
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
        cb(err || _('ZIP_NO_RESOURCE'));
        return;
      }

      saveZip(writer, file, (eer, rees) => {
        console.groupEnd();
        cb(eer, rees);
      });
    }

    if ( !path ) {
      finished(_('ZIP_NO_PATH'));
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
        Process.message('vfs:update', destination, {source: args.app ? args.app.__pid : null});
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
          VFS.mkdir(new FileMetadata(dest)).then((result) => {
            extracted.push(item.filename);
            cb();
          }).catch((error) => {
            warnings.push(Utils.format('Could not create directory "{0}": {1}', item.filename, error));
            cb();
          });
          return;
        }

        getEntryFile(item, (blob) => {
          console.log('....', blob);
          VFS.upload({
            destination: dest,
            files: [{filename: Utils.filename(item.filename), data: blob}]
          }).then(() => {
            extracted.push(item.filename);
            cb();
          }).catch((ev) => {
            warnings.push(Utils.format('Could not extract "{0}": {1}', item.filename, ev));
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

      const dst = new FileMetadata({path: destination, type: 'dir'});
      const cont = () => {
        VFS.exists(dst).then((result) => {
          if ( result ) {
            cb(false);
          } else {
            cb('Destination directory was not created or does not exist');
          }
        }).catch(() => {
          cb('Destination directory was not created or does not exist');
        });
      };

      VFS.mkdir(dst).then(cont).catch((error) => {
        console.warn('ZipArchiver::extract()', '_checkDirectory()', 'VFS::mkdir()', error);
        cont();
      });
    }

    console.debug('ZipArchiver::extract()', 'Downloading file...');

    VFS.download(file).then((result) => {
      const blob = new Blob([result], {type: 'application/zip'});
      _checkDirectory(destination, (err) => {

        if ( err ) {
          finished(err, warnings, false);
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
    }).catch((error) => {
      finished(error, warnings, false);
    });
  }
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

export function instance() {
  return SingletonInstance;
}

export function create(args, callback) {
  args = args || {};
  if ( !SingletonInstance ) {
    SingletonInstance = new ZipArchiver(args);
  }

  SingletonInstance.init((error) => {
    if ( !error ) {
      if ( !window.zip ) {
        error = _('ZIP_VENDOR_FAIL');
      }
    }
    callback(error, error ? false : SingletonInstance);
  });
}
