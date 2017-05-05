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
const XHR = require('utils/xhr.js');
const VFS = require('vfs/fs.js');
const MountManager = require('core/mount-manager.js');
const PackageManager = require('core/package-manager.js');
const SettingsManager = require('core/settings-manager.js');

/**
 * A response from a VFS request. The results are usually from the server,
 * except for when an exception occured in the stack.
 * @callback CallbackVFS
 * @param {String} [error] Error from response (if any)
 * @param {Mixed} result Result from response (if any)
 */

let watches = [];

/**
 * @namespace VFS
 * @memberof OSjs
 */

/**
 * @namespace Helpers
 * @memberof OSjs.VFS
 */

/**
 * @namespace Transports
 * @memberof OSjs.VFS
 */

/**
 * @namespace Modules
 * @memberof OSjs.VFS
 */

/**
 * A supported file data type
 * @typedef {(window.File|window.Blob|OSjs.VFS.File|OSjs.VFS.FileDataURL)} File
 */

/*@
 *
 *  This is a wrapper for handling all VFS functions
 *  read() write() scandir() and so on.
 *
 *  See 'src/client/javascript/vfs/' for the specific modules.
 *
 *  You should read the information below!
 *
 *  ---------------------------------------------------------------------------
 *
 *  Functions that take 'metadata' (File Metadata) as an argument (like all of them)
 *  it expects you to use an instance of VFS.File()
 *
 *     VFS.read(new VFS.File('/path/to/file', 'text/plain'), callback);
 *
 *  or anonymous file paths:
 *     VFS.read('/path/to/file', callback)
 *
 *  ---------------------------------------------------------------------------
 *
 *  By default all functions that read data will return ArrayBuffer, but you can also return:
 *     String
 *     dataSource
 *     ArrayBuffer
 *     Blob
 *
 *  ---------------------------------------------------------------------------
 *
 *  Functions that take 'data' (File Data) as an argument supports these types:
 *
 *     File                      Browser internal
 *     Blob                      Browser internal
 *     ArrayBuffer               Browser internal
 *     String                    Just a normal string
 *     VFS.FileDataURL           Wrapper for dataSource URL strings
 *     JSON                      JSON Data defined as: {filename: foo, data: bar}
 *
 *  ---------------------------------------------------------------------------
 *
 *  This a list of modules and their paths
 *
 *     User         home:///            OS.js User Storage
 *     OS.js        osjs:///            OS.js Dist (Read-only)
 *     GoogleDrive  google-drive:///    Google Drive Storage
 *     OneDrive     onedrive:///        Microsoft OneDrive (SkyDrive)
 *     Dropbox      dropbox:///         Dropbox Storage
 *
 */

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

/*
 * The default callback function when none was defined
 */
function noop(err, res) {
  if ( err ) {
    console.error('VFS operation without callback caused an error', err);
  } else {
    console.warn('VFS operation without callback', res);
  }
}

/*
 * Perform VFS request
 */
function request(test, method, args, callback, options, appRef) {
  const mm = MountManager;
  const d = mm.getModuleFromPath(test, false);

  if ( !d ) {
    throw new Error(API._('ERR_VFSMODULE_NOT_FOUND_FMT', test));
  }
  if ( typeof method !== 'string' ) {
    throw new TypeError(API._('ERR_ARGUMENT_FMT', 'VFS::' + method, 'method', 'String', typeof method));
  }
  if ( !(args instanceof Object) ) {
    throw new TypeError(API._('ERR_ARGUMENT_FMT', 'VFS::' + method, 'args', 'Object', typeof args));
  }
  if ( !(callback instanceof Function) ) {
    throw new TypeError(API._('ERR_ARGUMENT_FMT', 'VFS::' + method, 'callback', 'Function', typeof callback));
  }
  if ( options && !(options instanceof Object) ) {
    throw new TypeError(API._('ERR_ARGUMENT_FMT', 'VFS::' + method, 'options', 'Object', typeof options));
  }

  const conn = require('core/connection.js').instance;
  conn.onVFSRequest(d, method, args, function vfsRequestCallback(err, response) {
    if ( arguments.length === 2 ) {
      console.warn('VFS::request()', 'Core::onVFSRequest hijacked the VFS request');
      callback(err, response);
      return;
    }

    try {
      mm.getModule(d).request(method, args, function(err, res) {
        conn.onVFSRequestCompleted(d, method, args, err, res, function(e, r) {
          if ( arguments.length === 2 ) {
            console.warn('VFS::request()', 'Core::onVFSRequestCompleted hijacked the VFS request');
            callback(e, r);
            return;
          } else {
            callback(err, res);
          }
        }, appRef);
      }, options);
    } catch ( e ) {
      const msg = API._('ERR_VFSMODULE_EXCEPTION_FMT', e.toString());
      callback(msg);
      console.warn('VFS::request()', 'exception', e.stack, e);
    }
  });
}

/*
 * Just a helper function to reduce codesize by wrapping the general
 * request flow into one handy-dandy function.
 */
function requestWrapper(args, errstr, callback, onfinished, options, appRef) {
  function _finished(error, response) {
    if ( error ) {
      error = API._(errstr, error);
    }

    if ( onfinished ) {
      response = onfinished(error, response);
    }
    callback(error, response);
  }

  args.push(_finished);
  args.push(options || {});
  args.push(appRef);

  try {
    request.apply(null, args);
  } catch ( e ) {
    _finished(e);
  }
}

/*
 * Check if given item has an aliased mount associated with it
 * and return the real path
 */
function hasAlias(item, retm) {
  const mm = MountManager;
  const module = mm.getModuleFromPath(item.path, false, true);

  if ( module && module.options && module.options.alias ) {
    return retm ? module : item.path.replace(module.match, module.options.alias);
  }

  return false;
}

/*
 * Check if destination is readOnly
 */
function isReadOnly(item) {
  const m = MountManager.getModuleFromPath(item.path, false, true) || {};
  return m.readOnly === true;
}

/*
 * Will transform the argument to a VFS.File instance
 * or throw an error depending on input
 */
function checkMetadataArgument(item, err, checkRo) {
  if ( typeof item === 'string' ) {
    item = new VFS.File(item);
  } else if ( typeof item === 'object' && item.path ) {
    item = new VFS.File(item);
  }

  if ( !(item instanceof VFS.File) ) {
    throw new TypeError(err || API._('ERR_VFS_EXPECT_FILE'));
  }

  const alias = hasAlias(item);
  if ( alias ) {
    item.path = alias;
  }

  const mm = MountManager;
  if ( !mm.getModuleFromPath(item.path, false) ) {
    throw new Error(API._('ERR_VFSMODULE_NOT_FOUND_FMT', item.path));
  }

  if ( checkRo && isReadOnly(item) ) {
    throw new Error(API._('ERR_VFSMODULE_READONLY_FMT', mm.getModuleFromPath(item.path)));
  }

  return item;
}

/*
 * Check if targets have the same transport/module
 */
function hasSameTransport(src, dest) {
  // Modules using the normal server API
  const mm = MountManager;
  if ( mm.isInternal(src.path) && mm.isInternal(dest.path) ) {
    return true;
  }

  const msrc = mm.getModuleFromPath(src.path, false, true) || {};
  const mdst = mm.getModuleFromPath(dest.path, false, true) || {};

  return (msrc.transport === mdst.transport) || (msrc.name === mdst.name);
}

/*
 * A wrapper for checking if a file exists
 */
function existsWrapper(item, callback, options) {
  options = options || {};

  try {
    if ( options.overwrite === true ) {
      callback();
    } else {
      module.exports.exists(item, function(error, result) {
        if ( error ) {
          console.warn('existsWrapper() error', error);
        }

        if ( result ) {
          callback(API._('ERR_VFS_FILE_EXISTS'));
        } else {
          callback();
        }
      });
    }
  } catch ( e ) {
    callback(e);
  }
}

/*
 * Creates the '..' entry for scandir if not detected
 */
function createBackLink(item, result, alias, oitem) {
  const path = item.path.split('://')[1].replace(/\/+/g, '/').replace(/^\/?/, '/');

  let isOnRoot = path === '/';
  if ( alias ) {
    isOnRoot = (oitem.path === alias.root);
  }

  if ( !isOnRoot ) {
    const foundBack = result.some(function(iter) {
      return iter.filename === '..';
    });

    if ( !foundBack ) {
      return new VFS.File({
        filename: '..',
        path: FS.dirname(item.path),
        mime: null,
        size: 0,
        type: 'dir'
      });
    }
  }

  return false;
}

/*
 * Checks if an action mathes given path
 */
function checkWatches(msg, obj) {
  watches.forEach(function(w) {
    const checkPath = w.path;

    function _check(f) {
      if ( w.type === 'dir' ) {
        return f.path.substr(0, checkPath.length) === checkPath;
      }
      return f.path === checkPath;
    }

    let wasTouched = false;
    if ( obj.destination ) {
      wasTouched = _check(obj.destination);
      if ( !wasTouched ) {
        wasTouched = _check(obj.source);
      }
    } else {
      wasTouched = _check(obj);
    }

    if ( wasTouched ) {
      w.cb(msg, obj);
    }
  });
}

/*
 * See if given item matches up with any VFS modules with aliases
 * and return given entry.
 */
function findAlias(item) {
  const mm = MountManager;

  let found = null;
  mm.getModules().forEach(function(iter) {
    if ( !found && iter.module.options && iter.module.options.alias ) {
      const a = iter.module.options.alias;
      if ( item.path.substr(0, a.length) === a ) {
        found = iter.module;
      }
    }
  });

  return found;
}

/*
 * Wrapper for broadcasting VFS messages
 */
function broadcastMessage(msg, item, appRef) {
  function _message(i) {
    API.message(msg, i, {source: appRef ? appRef.__pid : null});

    checkWatches(msg, item);
  }

  // Makes sure aliased paths are called for
  const aliased = (function() {
    function _transform(i) {
      if ( i instanceof VFS.File ) {
        const n = new VFS.File(i);
        const alias = findAlias(n);
        if ( alias ) {
          n.path = n.path.replace(alias.options.alias, alias.root);
          return n;
        }
      }

      return false;
    }

    if ( item instanceof VFS.File ) {
      return _transform(item);
    } else if ( item && item.destination && item.source ) {
      return {
        source: _transform(item.source),
        destination: _transform(item.destination)
      };
    }

    return null;
  })();

  _message(item);

  const tuple = aliased.source || aliased.destination;
  if ( aliased && (aliased instanceof VFS.File || tuple) ) {
    if ( tuple ) {
      aliased.source = aliased.source || item.source;
      aliased.destination = aliased.destination || item.destination;
    }

    _message(aliased);
  }
}

/////////////////////////////////////////////////////////////////////////////
// VFS METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Find file(s)
 *
 * @function find
 * @memberof OSjs.VFS
 *
 * @param  {OSjs.VFS.File}   item              Root path
 * @param  {Object}          args              Search query
 * @param  {CallbackVFS}     callback          Callback function
 * @param  {Object}          [options]         Set of options
 * @param  {String}          options.query     The search query string
 * @param  {Number}          [options.limit]   Limit results to this amount
 *
 * @api     OSjs.VFS.find()
 */
module.exports.find = function VFS_find(item, args, callback, options) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::find()', item, args, options);
  if ( arguments.length < 3 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  requestWrapper([item.path, 'find', [item, args]], 'ERR_VFSMODULE_FIND_FMT', callback, null, options);
};

/**
 * Scandir
 *
 * @summary Scans a directory for files and directories.
 *
 * @function scandir
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item                             File Metadata
 * @param   {CallbackVFS}     callback                         Callback function
 * @param   {Object}          [options]                        Set of options
 * @param   {String}          [options.typeFilter]             Filter by 'file' or 'dir'
 * @param   {Array}           [options.mimeFilter]             Array of mime regex matchers
 * @param   {Boolean}         [options.showHiddenFiles=true]   Show hidden files
 * @param   {Boolean}         [options.backlink=true]          Return '..' when applicable
 * @param   {String}          [options.sortBy=null]            Sort by this key
 * @param   {String}          [options.sortDir='asc']          Sort in this direction
 */
module.exports.scandir = function VFS_scandir(item, callback, options) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::scandir()', item, options);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  const oitem = new VFS.File(item);
  const alias = hasAlias(oitem, true);

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  requestWrapper([item.path, 'scandir', [item]], 'ERR_VFSMODULE_SCANDIR_FMT', function(error, result) {
    // Makes sure aliased mounts have correct paths and entries
    if ( alias && result ) {
      result = result.map(function(iter) {
        const isShortcut = iter.shortcut === true;
        const niter = new VFS.File(iter);
        if ( !isShortcut ) {
          const str = iter.path.replace(/\/?$/, '');
          const tmp = alias.options.alias.replace(/\/?$/, '');
          niter.path = FS.pathJoin(alias.root, str.replace(tmp, ''));
        }

        return niter;
      });
    }

    // Inserts the correct '..' entry if missing
    if ( !error && result instanceof Array && options.backlink !== false ) {
      const back = createBackLink(item, result, alias, oitem);
      if ( back ) {
        result.unshift(back);
      }
    }

    return callback(error, result);
  }, null, options);
};

/**
 * Write File
 *
 * @summary Writes data to a file
 *
 * @function write
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}             item          File Metadata (you can also provide a string)
 * @param   {File}                      data          File Data (see supported types)
 * @param   {CallbackVFS}               callback      Callback function
 * @param   {Object}                    [options]     Set of options
 * @param   {OSjs.Core.Application}     [appRef]      Reference to an Application
 */
module.exports.write = function VFS_write(item, data, callback, options, appRef) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::write()', item, options);
  if ( arguments.length < 3 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item, null, true);
  } catch ( e ) {
    callback(e);
    return;
  }

  function _finished(error, result) {
    if ( error ) {
      error = API._('ERR_VFSMODULE_WRITE_FMT', error);
    }

    callback(error, result);
  }

  function _write(filedata) {
    try {
      request(item.path, 'write', [item, filedata], _finished, options, appRef);
    } catch ( e ) {
      _finished(e);
    }
  }

  function _converted(error, response) {
    if ( error ) {
      _finished(error, null);
      return;
    }
    _write(response);
  }

  try {
    if ( typeof data === 'string' ) {
      if ( data.length ) {
        FS.textToAb(data, item.mime, function(error, response) {
          _converted(error, response);
        });
      } else {
        _converted(null, data);
      }
    } else {
      if ( data instanceof VFS.FileData ) {
        FS.dataSourceToAb(data.toString(), item.mime, function(error, response) {
          _converted(error, response);
        });
        return;
      } else if ( window.Blob && data instanceof window.Blob ) {
        FS.blobToAb(data, function(error, response) {
          _converted(error, response);
        });
        return;
      }
      _write(data);
    }
  } catch ( e ) {
    _finished(e);
  }
};

/**
 * Read File
 *
 * @summary Reads data from a file
 *
 * @function read
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item                File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback            Callback function
 * @param   {Object}          [options]           Set of options
 * @param   {String}          [options.type]      What to return, default: binary. Can also be: text, datasource, json
 */
module.exports.read = function VFS_read(item, callback, options) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::read()', item, options);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  function _finished(error, response) {
    if ( error ) {
      error = API._('ERR_VFSMODULE_READ_FMT', error);
      callback(error);
      return;
    }

    if ( options.type ) {
      const types = {
        datasource: function readToDataSource() {
          FS.abToDataSource(response, item.mime, function(error, dataSource) {
            callback(error, error ? null : dataSource);
          });
        },
        text: function readToText() {
          FS.abToText(response, item.mime, function(error, text) {
            callback(error, error ? null : text);
          });
        },
        blob: function readToBlob() {
          FS.abToBlob(response, item.mime, function(error, blob) {
            callback(error, error ? null : blob);
          });
        },
        json: function readToJSON() {
          FS.abToText(response, item.mime, function(error, text) {
            let jsn;
            if ( typeof text === 'string' ) {
              try {
                jsn = JSON.parse(text);
              } catch ( e ) {
                console.warn('VFS::read()', 'readToJSON', e.stack, e);
              }
            }
            callback(error, error ? null : jsn);
          });
        }
      };

      const type = options.type.toLowerCase();
      if ( types[type] ) {
        types[type]();
        return;
      }
    }

    callback(error, error ? null : response);
  }

  try {
    request(item.path, 'read', [item], function(error, response) {
      _finished(error, error ? false : response);
    }, options);
  } catch ( e ) {
    _finished(e);
  }
};

/**
 * Copy File
 *
 * @summary Copies a file to a destination
 *
 * @function copy
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}             src                   Source File Metadata (you can also provide a string)
 * @param   {OSjs.VFS.File}             dest                  Destination File Metadata (you can also provide a string)
 * @param   {CallbackVFS}               callback              Callback function
 * @param   {Object}                    [options]             Set of options
 * @param   {Boolean}                   [options.overwrite]   If set to true it will not check if the destination exists
 * @param   {OSjs.Core.Application}     [appRef]              Seference to an Application
 */
module.exports.copy = function VFS_copy(src, dest, callback, options, appRef) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::copy()', src, dest, options);
  if ( arguments.length < 3 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  const mm = MountManager;

  try {
    src = checkMetadataArgument(src, API._('ERR_VFS_EXPECT_SRC_FILE'));
    dest = checkMetadataArgument(dest, API._('ERR_VFS_EXPECT_DST_FILE'), true);
  } catch ( e ) {
    callback(e);
    return;
  }

  options = Object.assign({}, {
    type: 'binary',
    dialog: null
  }, options);

  options.arrayBuffer = true;

  function dialogProgress(prog) {
    if ( options.dialog ) {
      options.dialog.setProgress(prog);
    }
  }

  function doRequest() {
    function _finished(error, result) {
      callback(error, result);
    }

    if ( hasSameTransport(src, dest) ) {
      request(src.path, 'copy', [src, dest], function(error, response) {
        dialogProgress(100);
        if ( error ) {
          error = API._('ERR_VFSMODULE_COPY_FMT', error);
        }
        _finished(error, response);
      }, options, appRef);
    } else {
      const msrc = mm.getModuleFromPath(src.path);
      const mdst = mm.getModuleFromPath(dest.path);

      // FIXME: This does not work for folders
      if ( src.type === 'dir' ) {
        _finished(API._('ERR_VFSMODULE_COPY_FMT', 'Copying folders between different transports is not yet supported!'));
        return;
      }

      dest.mime = src.mime;

      mm.getModule(msrc).request('read', [src], function(error, data) {
        dialogProgress(50);

        if ( error ) {
          _finished(API._('ERR_VFS_TRANSFER_FMT', error));
          return;
        }

        mm.getModule(mdst).request('write', [dest, data], function(error, result) {
          dialogProgress(100);

          if ( error ) {
            error = API._('ERR_VFSMODULE_COPY_FMT', error);
          }
          _finished(error, result);
        }, options);
      }, options);
    }
  }

  existsWrapper(dest, function(error) {
    if ( error ) {
      callback(API._('ERR_VFSMODULE_COPY_FMT', error));
    } else {
      try {
        doRequest();
      } catch ( e ) {
        callback(API._('ERR_VFSMODULE_COPY_FMT', e));
      }
    }
  });
};

/**
 * Move File
 *
 * @summary Moves a file to a destination
 *
 * @function move
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}             src                   Source File Metadata (you can also provide a string)
 * @param   {OSjs.VFS.File}             dest                  Destination File Metadata (you can also provide a string)
 * @param   {CallbackVFS}               callback              Callback function
 * @param   {Object}                    [options]             Set of options
 * @param   {Boolean}                   [options.overwrite]   If set to true it will not check if the destination exists
 * @param   {OSjs.Core.Application}     [appRef]              Seference to an Application
 */
module.exports.move = function VFS_move(src, dest, callback, options, appRef) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::move()', src, dest, options);
  if ( arguments.length < 3 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  const mm = MountManager;

  try {
    src = checkMetadataArgument(src, API._('ERR_VFS_EXPECT_SRC_FILE'));
    dest = checkMetadataArgument(dest, API._('ERR_VFS_EXPECT_DST_FILE'), true);
  } catch ( e ) {
    callback(e);
    return;
  }

  function doRequest() {
    function _finished(error, result) {
      callback(error, result);
    }

    if ( hasSameTransport(src, dest) ) {
      request(src.path, 'move', [src, dest], function(error, response) {
        if ( error ) {
          error = API._('ERR_VFSMODULE_MOVE_FMT', error);
        }
        _finished(error, error ? null : response, dest);
      }, options, appRef);
    } else {
      const msrc = mm.getModuleFromPath(src.path);
      //const mdst = mm.getModuleFromPath(dest.path);

      dest.mime = src.mime;

      module.exports.copy(src, dest, function(error, result) {
        if ( error ) {
          error = API._('ERR_VFS_TRANSFER_FMT', error);
          _finished(error);
        } else {
          mm.getModule(msrc).request('unlink', [src], function(error, result) {
            if ( error ) {
              error = API._('ERR_VFS_TRANSFER_FMT', error);
            }
            _finished(error, result, dest);
          }, options);
        }
      });
    }
  }

  existsWrapper(dest, function(error) {
    if ( error ) {
      callback(API._('ERR_VFSMODULE_MOVE_FMT', error));
    } else {
      try {
        doRequest();
      } catch ( e ) {
        callback(API._('ERR_VFSMODULE_MOVE_FMT', e));
      }
    }
  });
};

/**
 * Alias of move
 *
 * @function rename
 * @memberof OSjs.VFS
 * @alias OSjs.VFS.move
 *
 * @param   {OSjs.VFS.File}             src                   Source File Metadata (you can also provide a string)
 * @param   {OSjs.VFS.File}             dest                  Destination File Metadata (you can also provide a string)
 * @param   {CallbackVFS}               callback              Callback function
 * @param   {Object}                    [options]             Set of options
 * @param   {Boolean}                   [options.overwrite]   If set to true it will not check if the destination exists
 * @param   {OSjs.Core.Application}     [appRef]              Seference to an Application
 */
module.exports.rename = function VFS_rename(src, dest, callback) {
  module.exports.move.apply(this, arguments);
};

/**
 * Delete File
 *
 * This function currently have no options.
 *
 * @summary Deletes a file
 *
 * @function unlink
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}             item                  File Metadata (you can also provide a string)
 * @param   {CallbackVFS}               callback              Callback function
 * @param   {Object}                    [options]             Set of options
 * @param   {OSjs.Core.Application}     [appRef]              Reference to an Application
 */
module.exports.unlink = function VFS_unlink(item, callback, options, appRef) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::unlink()', item, options);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item, null, true);
  } catch ( e ) {
    callback(e);
    return;
  }

  function _checkPath() {
    const pkgdir = SettingsManager.instance('PackageManager').get('PackagePaths', []);

    const found = pkgdir.some(function(i) {
      const chkdir = new VFS.File(i);
      const idir = FS.dirname(item.path);
      return idir === chkdir.path;
    });

    if ( found ) {
      PackageManager.generateUserMetadata(function() {});
    }
  }

  requestWrapper([item.path, 'unlink', [item]], 'ERR_VFSMODULE_UNLINK_FMT', callback, function(error, response) {
    if ( !error ) {
      _checkPath();
    }
    return response;
  }, options, appRef);
};

/**
 * Alias of unlink
 *
 * @function delete
 * @memberof OSjs.VFS
 * @alias OSjs.VFS.unlink
 */
(function() {
  /*eslint dot-notation: "off"*/
  module.exports['delete'] = function VFS_delete(item, callback) {
    module.exports.unlink.apply(this, arguments);
  };
})();

/**
 * Create Directory
 *
 * @summary Creates a directory
 *
 * @function mkdir
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}             item                  File Metadata (you can also provide a string)
 * @param   {CallbackVFS}               callback              Callback function
 * @param   {Object}                    [options]             Set of options
 * @param   {Boolean}                   [options.overwrite]   If set to true it will not check if the destination exists
 * @param   {OSjs.Core.Application}     [appRef]              Reference to an Application
 */
module.exports.mkdir = function VFS_mkdir(item, callback, options, appRef) {
  options = options || {};
  callback = callback || noop;

  console.debug('VFS::mkdir()', item, options);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item, null, true);
  } catch ( e ) {
    callback(e);
    return;
  }

  existsWrapper(item, function(error) {
    if ( error ) {
      callback(API._('ERR_VFSMODULE_MKDIR_FMT', error));
    } else {
      requestWrapper([item.path, 'mkdir', [item]], 'ERR_VFSMODULE_MKDIR_FMT', callback, function(error, response) {
        if ( error ) {
          console.warn(error);
        }

        return response;
      }, options, appRef);
    }
  });
};

/**
 * Check if file exists
 *
 * @summary Check if a target exists
 *
 * @function exists
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.exists = function VFS_exists(item, callback) {
  callback = callback || noop;

  console.debug('VFS::exists()', item);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }
  requestWrapper([item.path, 'exists', [item]], 'ERR_VFSMODULE_EXISTS_FMT', callback);
};

/**
 * Get file info
 *
 * @summary Gets information about a file
 *
 * @function fileinfo
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.fileinfo = function VFS_fileinfo(item, callback) {
  callback = callback || noop;

  console.debug('VFS::fileinfo()', item);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }
  requestWrapper([item.path, 'fileinfo', [item]], 'ERR_VFSMODULE_FILEINFO_FMT', callback);
};

/**
 * Get file URL
 *
 * @summary Gets absolute HTTP URL to a file
 *
 * @function url
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 * @param   {Object}          [options] Set of options
 */
module.exports.url = function VFS_url(item, callback, options) {
  callback = callback || noop;
  options = options || {};

  console.debug('VFS::url()', item);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  requestWrapper([item.path, 'url', [item]], 'ERR_VFSMODULE_URL_FMT', callback, function(error, response) {
    return error ? false : response;
  }, options);
};

/**
 * Upload file(s)
 *
 * @summary Uploads a file to the target from browser
 *
 * @function upload
 * @memberof OSjs.VFS
 *
 * @param   {Object}                    args                      Function arguments (see below)
 * @param   {String}                    args.destination          Full path to destination
 * @param   {Array}                     args.files                Array of 'File'
 * @param   {CallbackVFS}               callback                  Callback function
 * @param   {Object}                    [options]                 Set of options
 * @param   {Boolean}                   [options.overwrite=false] If set to true it will not check if the destination exists
 * @param   {OSjs.Core.Application}     [appRef]                  Reference to an Application
 */
module.exports.upload = function VFS_upload(args, callback, options, appRef) {
  callback = callback || noop;
  options = options || {};
  args = args || {};

  console.debug('VFS::upload()', args);

  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }
  if ( !args.files ) {
    callback(API._('ERR_VFS_UPLOAD_NO_FILES'));
    return;
  }
  if ( !args.destination ) {
    callback(API._('ERR_VFS_UPLOAD_NO_DEST'));
    return;
  }

  const mm = MountManager;
  if ( !mm.isInternal(args.destination) ) {
    args.files.forEach(function(f, i) {
      request(args.destination, 'upload', [f, args.destination], callback, options);
    });
    return;
  }

  if ( isReadOnly(new VFS.File(args.destination)) ) {
    callback(API._('ERR_VFSMODULE_READONLY_FMT', mm.getModuleFromPath(args.destination)));
    return;
  }

  args.files.forEach(function(f, i) {
    const filename = (f instanceof window.File) ? f.name : f.filename;
    const dest = new VFS.File(FS.pathJoin(args.destination, filename));

    existsWrapper(dest, function(error) {
      if ( error ) {
        callback(error);
        return;
      }

      try {
        let realDest = new VFS.File(args.destination);

        const tmpPath = hasAlias(realDest);
        if ( tmpPath ) {
          realDest = tmpPath;
        }

        OSjs.VFS.Transports.OSjs.upload(f, realDest, function(err, result, ev) {
          if ( err ) {
            if ( err === 'canceled' ) {
              callback(API._('ERR_VFS_UPLOAD_CANCELLED'), null, ev);
            } else {
              const errstr = ev ? ev.toString() : 'Unknown reason';
              const msg = API._('ERR_VFS_UPLOAD_FAIL_FMT', errstr);
              callback(msg, null, ev);
            }
          } else {
            let file = OSjs.VFS.Helpers.createFileFromUpload(args.destination, f);
            file = checkMetadataArgument(file);

            broadcastMessage('vfs:upload', file, args.app, appRef);
            callback(false, file, ev);
          }
        }, options);
      } catch ( e ) {
        callback(API._('ERR_VFS_UPLOAD_FAIL_FMT', e));
      }
    }, options);
  });

};

/**
 * Download a file
 *
 * @summary Downloads a file to the computer
 *
 * @function download
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   args      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.download = (function download() {
  let _didx = 1;

  return function(args, callback) {
    callback = callback || noop;
    args = args || {};

    console.debug('VFS::download()', args);
    if ( arguments.length < 2 ) {
      callback(API._('ERR_VFS_NUM_ARGS'));
      return;
    }

    try {
      args = checkMetadataArgument(args);
    } catch ( e ) {
      callback(e);
      return;
    }

    if ( !args.path ) {
      callback(API._('ERR_VFS_DOWNLOAD_NO_FILE'));
      return;
    }

    const lname = 'DownloadFile_' + _didx;
    _didx++;

    API.createLoading(lname, {className: 'BusyNotification', tooltip: API._('TOOLTIP_VFS_DOWNLOAD_NOTIFICATION')});

    const mm = MountManager;
    const dmodule = mm.getModuleFromPath(args.path);
    if ( !mm.isInternal(args.path) ) {
      let file = args;
      if ( !(file instanceof VFS.File) ) {
        file = new VFS.File(args.path);
        if ( args.id ) {
          file.id = args.id;
        }
      }

      mm.getModule(dmodule).request('read', [file], function(error, result) {
        API.destroyLoading(lname);

        if ( error ) {
          callback(API._('ERR_VFS_DOWNLOAD_FAILED', error));
          return;
        }

        callback(false, result);
      });
      return;
    }

    module.exports.url(args, function(error, url) {
      if ( error ) {
        callback(error);
        return;
      }

      XHR.ajax({
        url: url,
        method: 'GET',
        responseType: 'arraybuffer',
        onsuccess: function(result) {
          API.destroyLoading(lname);
          callback(false, result);
        },
        onerror: function(result) {
          API.destroyLoading(lname);
          callback(error);
        }
      });

    });
  };
})();

/**
 * Move file to trash (Not used in internal storage)
 *
 * @summary Trashes a file
 *
 * @function trash
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.trash = function VFS_trash(item, callback) {
  callback = callback || noop;

  console.debug('VFS::trash()', item);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  requestWrapper([item.path, 'trash', [item]], 'ERR_VFSMODULE_TRASH_FMT', callback);
};

/**
 * Restore file from trash
 *
 * @summary Removes a file from trash
 *
 * @function untrash
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.untrash = function VFS_untrash(item, callback) {
  callback = callback || noop;

  console.debug('VFS::untrash()', item);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  requestWrapper([item.path, 'untrash', [item]], 'ERR_VFSMODULE_UNTRASH_FMT', callback);
};

/**
 * Permanently empty trash
 *
 * @summary Empties the trash
 *
 * @function emptyTrash
 * @memberof OSjs.VFS
 *
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.emptyTrash = function VFS_emptyTrash(callback) {
  callback = callback || noop;

  console.debug('VFS::emptyTrash()');
  if ( arguments.length < 1 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  requestWrapper([null, 'emptyTrash', []], 'ERR_VFSMODULE_EMPTYTRASH_FMT', callback);
};

/**
 * Checks for free space in given protocol from file
 *
 * Result is -1 when unavailable
 *
 * @summary Gets free space on target
 *
 * @function freeSpace
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 */
module.exports.freeSpace = function VFS_freeSpace(item, callback) {
  callback = callback || noop;

  console.debug('VFS::freeSpace()', item);
  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return;
  }

  const m = MountManager.getModuleFromPath(item.path, false, true);

  requestWrapper([item.path, 'freeSpace', [m.root]], 'ERR_VFSMODULE_FREESPACE_FMT', callback);
};

/**
 * Watches a file or directory for changes. Please note that this currently only works for
 * client-side APIs.
 * @summary Watches a file or directory for changes.
 *
 * @function watch
 * @memberof OSjs.VFS
 *
 * @param   {OSjs.VFS.File}   item      File Metadata (you can also provide a string)
 * @param   {CallbackVFS}     callback  Callback function
 *
 * @return  {Number}                    The index of your watch (you can unwatch with this)
 */
module.exports.watch = function VFS_watch(item, callback) {
  callback = callback || noop;

  if ( arguments.length < 2 ) {
    callback(API._('ERR_VFS_NUM_ARGS'));
    return -1;
  }

  try {
    item = checkMetadataArgument(item);
  } catch ( e ) {
    callback(e);
    return -1;
  }

  return watches.push({
    path: item.path,
    type: item.type,
    cb: callback
  }) - 1;
};

/**
 * Remove a watch
 *
 * @function unwatch
 * @memberof OSjs.VFS
 *
 * @param {Number}      idx     Watch index (from watch() method)
 */
module.exports.unwatch = function VFS_unwatch(idx) {
  if ( typeof watches[idx] !== 'undefined' ) {
    delete watches[idx];
  }
};

module.exports.broadcastMessage = broadcastMessage;

/////////////////////////////////////////////////////////////////////////////
// FILE ABSTRACTION
/////////////////////////////////////////////////////////////////////////////

/**
 * This is the Metadata object you have to use when passing files around
 * in the VFS API.
 *
 * This object has the same properties as in the option list below
 *
 * If you construct without a MIME type, OS.js will try to guess what it is.
 *
 * @constructor File
 * @memberof OSjs.VFS
 * @see OSjs.VFS.file
 */
class FileMetadata {
  /*eslint valid-jsdoc: "off"*/

  /**
   * @param   {(String|Object)} arg           Either a 'path' or 'object' (filled with properties)
   * @param   {String}          arg.path      Full path
   * @param   {String}          arg.filename  Filename (automatically detected)
   * @param   {String}          arg.type      File type (file/dir)
   * @param   {Number}          arg.size      File size (in bytes)
   * @param   {String}          arg.mime      File MIME (ex: application/json)
   * @param   {Mixed}           arg.id        Unique identifier (not required)
   * @param   {String}          [mime]        MIME type of File Type (ex: 'application/json' or 'dir')
   */
  constructor(arg, mime) {
    if ( !arg ) {
      throw new Error(API._('ERR_VFS_FILE_ARGS'));
    }

    /**
     * Full path
     * @type {String}
     * @example home:///foo/bar.baz
     */
    this.path     = null;

    /**
     * Filename
     * @type {String}
     * @example foo.baz
     */
    this.filename = null;

    /**
     * Type (dir or file)
     * @type {String}
     * @example file
     */
    this.type     = null;

    /**
     * Size in bytes
     * @type {Number}
     * @example 1234
     */
    this.size     = null;

    /**
     * MIME type
     * @type {String}
     * @example application/octet-stream
     */
    this.mime     = null;

    /**
     * Unique identifier (Only used for external services requring it)
     * @type {String}
     */
    this.id       = null;

    /**
     * Internal boolean for a shortcut type file
     * @type {Boolean}
     */
    this.shortcut = false;

    if ( typeof arg === 'object' ) {
      this.setData(arg);
    } else if ( typeof arg === 'string' ) {
      this.path = arg;
      this.setData();
    }

    if ( typeof mime === 'string' ) {
      if ( mime.match(/\//) ) {
        this.mime = mime;
      } else {
        this.type = mime;
      }
    }

    this._guessMime();
  }

  /**
   * Set data from Object (key/value pair)
   *
   * @param {Object}    o     Object
   */
  setData(o) {
    if ( o ) {
      Object.keys(o).forEach((k) => {
        if ( k !== '_element' ) {
          this[k] = o[k];
        }
      });
    }

    if ( !this.filename ) {
      this.filename = FS.filename(this.path);
    }
  }

  /**
   * Get object data as key/value pair.
   *
   * @return {Object}
   */
  getData() {
    return {
      path: this.path,
      filename: this.filename,
      type: this.type,
      size: this.size,
      mime: this.mime,
      id: this.id
    };
  }

  /**
   * Copies the file to given destination.
   *
   * @alias OSjs.VFS.copy
   * @see OSjs.VFS.copy
   */
  copy(dest, callback, options, appRef) {
    return require('vfs/fs.js').copy(this, dest, callback, options, appRef);
  }

  /**
   * Downloads the file to computer
   *
   * @alias OSjs.VFS.download
   * @see OSjs.VFS.download
   */
  download(callback) {
    return require('vfs/fs.js').download(this, callback);
  }

  /**
   * Deletes the file
   *
   * @alias OSjs.VFS.File#unlink
   * @see OSjs.VFS.File#unlink
   */
  delete() {
    return this.unlink.apply(this, arguments);
  }

  /**
   * Removes the file
   *
   * @alias OSjs.VFS.unlink
   * @see OSjs.VFS.unlink
   */
  unlink(callback, options, appRef) {
    return require('vfs/fs.js').unlink(this, callback, options, appRef);
  }

  /**
   * Checks if file exists
   *
   * @alias OSjs.VFS.exists
   * @see OSjs.VFS.exists
   */
  exists(callback) {
    return require('vfs/fs.js').exists(this, callback);
  }

  /**
   * Creates a directory
   *
   * @alias OSjs.VFS.mkdir
   * @see OSjs.VFS.mkdir
   */
  mkdir(callback, options, appRef) {
    return require('vfs/fs.js').mkdir(this, callback, options, appRef);
  }

  /**
   * Moves the file to given destination
   *
   * @alias OSjs.VFS.move
   * @see OSjs.VFS.move
   */
  move(dest, callback, options, appRef) {
    return require('vfs/fs.js').move(this, dest, (err, res, newDest) => {
      if ( !err && newDest ) {
        self.setData(newDest);
      }
      callback.call(this, err, res, newDest);
    }, options, appRef);
  }

  /**
   * Reads the file contents
   *
   * @alias OSjs.VFS.read
   * @see OSjs.VFS.read
   */
  read(callback, options) {
    return require('vfs/fs.js').read(this, callback, options);
  }

  /**
   * Renames the file
   *
   * @alias OSjs.VFS.File#move
   * @see OSjs.VFS.File#move
   */
  rename() {
    return this.move.apply(this, arguments);
  }

  /**
   * Scans the folder contents
   *
   * @alias OSjs.VFS.scandir
   * @see OSjs.VFS.scandir
   */
  scandir(callback, options) {
    return require('vfs/fs.js').scandir(this, callback, options);
  }

  /**
   * Sends the file to the trash
   *
   * @alias OSjs.VFS.trash
   * @see OSjs.VFS.trash
   */
  trash(callback) {
    return require('vfs/fs.js').trash(this, callback);
  }

  /**
   * Restores the file from trash
   *
   * @alias OSjs.VFS.untrash
   * @see OSjs.VFS.untrash
   */
  untrash(callback) {
    return require('vfs/fs.js').untrash(this, callback);
  }

  /**
   * Gets the URL for physical file
   *
   * @alias OSjs.VFS.url
   * @see OSjs.VFS.url
   */
  url(callback) {
    return require('vfs/fs.js').url(this, callback);
  }

  /**
   * Writes data to the file
   *
   * @alias OSjs.VFS.write
   * @see OSjs.VFS.write
   */
  write(data, callback, options, appRef) {
    return require('vfs/fs.js').write(this, data, callback, options, appRef);
  }

  _guessMime() {
    if ( this.mime || this.type === 'dir' || (!this.path || this.path.match(/\/$/)) ) {
      return;
    }

    const ext = FS.filext(this.path);
    this.mime = API.getConfig('MIME.mapping')['.' + ext] || 'application/octet-stream';
  }

}

/**
 * This is a object you can pass around in VFS when
 * handling DataURL()s (strings). Normally you would
 * use a File, Blob or ArrayBuffer, but this is an alternative.
 *
 * Useful for canvas data etc.
 *
 * @constructor
 * @memberof OSjs.VFS
 */
class FileDataURL {

  /**
   * @param {String}    dataURL     Data URI
   */
  constructor(dataURL) {
    /**
     * File URI data (base64 encoded)
     * @type {String}
     */
    this.dataURL = dataURL;
  }

  /**
   * Get base64 data
   * @return {String}
   */
  toBase64() {
    return this.data.split(',')[1];
  }

  /**
   * Get raw data URI
   * @override
   * @return {String}
   */
  toString() {
    return this.dataURL;
  }

}

module.exports.FileData = FileDataURL;
module.exports.File = FileMetadata;
