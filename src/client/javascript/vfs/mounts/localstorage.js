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
/*eslint no-use-before-define: "off"*/
'use strict';

const FS = require('utils/fs.js');
const API = require('core/api.js');
const Utils = require('utils/misc.js');
const VFS = require('vfs/fs.js');

/**
 * @namespace LocalStorage
 * @memberof OSjs.VFS.Modules
 */

/*
 * This storage works like this:
 *
 * A map of folders with arrays of metadata
 *  namespace/tree  = {'/': [{id: -1, size: -1, mime: 'str', filename: 'str'}, ...], ...}
 *
 * A flat map of data
 *  namespace/data = {'path': %base64%}
 *
 */

/////////////////////////////////////////////////////////////////////////////
// GLOBALS
/////////////////////////////////////////////////////////////////////////////

let NAMESPACE = 'OSjs/VFS/LocalStorage';

let _isMounted = false;
let _cache = {};
let _fileCache = {};

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

/*
 * Get's the "real" path of a object (which is basically a path without protocol)
 */
function getRealPath(p, par) {
  if ( typeof p !== 'string' || !p ) {
    throw new TypeError('Expected p as String');
  }

  p = FS.getPathFromVirtual(p).replace(/\/+/g, '/');

  let path = par ? (FS.dirname(p) || '/') : p;
  if ( path !== '/' ) {
    path = path.replace(/\/$/, '');
  }

  return path;
}

/*
 * This methods creates a VFS.File from cache and fills in the gaps
 */
function createMetadata(i, path, p) {
  i = Utils.cloneObject(i);
  if ( !p.match(/(\/\/)?\/$/) ) {
    p += '/';
  }
  i.path = p + i.filename;

  return new VFS.File(i);
}

/////////////////////////////////////////////////////////////////////////////
// LOCALSTORAGE ABSTRACTION
/////////////////////////////////////////////////////////////////////////////

/*
 * Initialize and restore data from localStorage
 */
function initStorage() {
  if ( !_isMounted ) {
    try {
      _cache = JSON.parse(localStorage.getItem(NAMESPACE + '/tree')) || {};
    } catch ( e ) {}

    try {
      _fileCache = JSON.parse(localStorage.getItem(NAMESPACE + '/data')) || {};
    } catch ( e ) {}

    if ( typeof _cache['/'] === 'undefined' ) {
      _cache['/'] = [];
    }

    _isMounted = true;

    API.message('vfs:mount', 'LocalStorage', {source: null});
  }
}

/*
 * Store tree and data to localStorage
 */
function commitStorage() {
  try {
    localStorage.setItem(NAMESPACE + '/tree', JSON.stringify(_cache));
    localStorage.setItem(NAMESPACE + '/data', JSON.stringify(_fileCache));

    return true;
  } catch ( e ) {}

  return false;
}

/////////////////////////////////////////////////////////////////////////////
// CACHE
/////////////////////////////////////////////////////////////////////////////

/*
 * Adds an entry to the cache
 */
function addToCache(iter, data, dab) {
  const path = getRealPath(iter.path);
  const dirname = FS.dirname(path);

  const type = typeof data === 'undefined' || data === null ? 'dir' : 'file';
  const mimeConfig = API.getConfig('MIME.mapping');

  const mime = ((type) => {
    if ( type !== 'dir' ) {
      if ( iter.mime ) {
        return iter.mime;
      } else {
        const ext = FS.filext(iter.filename);
        return mimeConfig['.' + ext] || 'application/octet-stream';
      }
    }
    return null;
  })(iter.type);

  const file = {
    size: iter.size || (type === 'file' ? (dab.byteLength || dab.length || 0) : 0),
    mime: mime,
    type: type,
    filename: iter.filename
  };

  if ( typeof _cache[dirname] === 'undefined' ) {
    _cache[dirname] = [];
  }

  ((found) => {
    if ( found !== false) {
      _cache[dirname][found] = file;
    } else {
      _cache[dirname].push(file);
    }
  })(findInCache(iter));

  if ( file.type === 'dir' ) {
    if ( _fileCache[path] ) {
      delete _fileCache[path];
    }
    _cache[path] = [];
  } else {
    const iof = data.indexOf(',');
    _fileCache[path] = data.substr(iof + 1);
  }

  return true;
}

/*
 * Removes an entry from cache (recursively)
 */
function removeFromCache(iter) {
  function _removef(i) {
    const path = getRealPath(i.path);
    //console.warn('-->', '_removef', i, path);

    // Remove data
    if ( _fileCache[path] ) {
      delete _fileCache[path];
    }

    // Remove from parent tree
    _removefromp(i);
  }

  function _removed(i) {
    const path = getRealPath(i.path);

    //console.warn('-->', '_removed', i, path);

    if ( path !== '/' ) {
      // Remove from parent node
      _removefromp(i);

      // Remove base node if a root directory
      if ( _cache[path] ) {
        delete _cache[path];
      }
    }
  }

  function _removefromp(i) {
    const path = getRealPath(i.path);
    const dirname = FS.dirname(path);

    //console.warn('-->', '_removefromp', i, path, dirname);

    if ( _cache[dirname] ) {
      let found = -1;
      _cache[dirname].forEach((ii, idx) => {
        if ( found === -1 && ii ) {
          if ( ii.type === i.type && i.filename === i.filename ) {
            found = idx;
          }
        }
      });

      if ( found >= 0 ) {
        _cache[dirname].splice(found, 1);
      }
    }
  }

  function _op(i) {
    //console.warn('-->', '_op', i);

    if ( i ) {
      if ( i.type === 'dir' ) {
        // First go up in the tree
        scanStorage(i, false).forEach((ii) => {
          _op(ii);
        });

        // Then go down
        _removed(i);
      } else {
        _removef(i);
      }
    }
  }

  _op(iter);

  return true;
}

/*
 * Looks up a file from the cache and returns index
 */
function findInCache(iter) {
  const path = getRealPath(iter.path);
  const dirname = FS.dirname(path);

  let found = false;
  _cache[dirname].forEach((chk, idx) => {
    if ( found === false && chk.filename === iter.filename ) {
      found = idx;
    }
  });

  return found;
}

/*
 * Fetches a VFS.File object from cache from path
 */
function getFromCache(pp) {
  const path = FS.dirname(pp);
  const fname = FS.filename(pp);
  const tpath = path.replace(/^(.*)\:\/\//, '');

  let result = null;
  (_cache[tpath] || []).forEach((v) => {
    if ( !result && v.filename === fname ) {
      result = createMetadata(v, null, path);
    }
  });

  return result;
}

/*
 * Scans a directory and returns file list
 */
function scanStorage(item, ui) {
  const path = getRealPath(item.path);
  const data = _cache[path] || false;

  const list = (data === false) ? false : data.filter((i) => {
    return !!i;
  }).map((i) => {
    return createMetadata(i, path, item.path);
  });

  return list;
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

const LocalStorageStorage = {

  scandir: function(item, callback, options) {
    const list = scanStorage(item, true);
    callback(list === false ? API._('ERR_VFSMODULE_NOSUCH') : false, list);
  },

  read: function(item, callback, options) {
    options = options || {};

    const path = getRealPath(item.path);

    function readStorage(cb) {
      const metadata = getFromCache(path);

      if ( metadata ) {
        const data = _fileCache[path];

        if ( data ) {
          const ds  = 'data:' + metadata.mime + ',' + data;
          FS.dataSourceToAb(ds, metadata.mime, (err, res) => {
            if ( err ) {
              cb(err);
            } else {
              if ( options.url ) {
                FS.abToBlob(res, metadata.mime, (err, blob) => {
                  cb(err, URL.createObjectURL(blob));
                });
              } else {
                cb(err, res);
              }
            }
          });

          return true;
        }
      }

      return false;
    }

    if ( readStorage(callback) === false ) {
      callback(API._('ERR_VFS_FATAL'), false);
    }
  },

  write: function(file, data, callback, options) {
    options = options || {};

    const mime = file.mime || 'application/octet-stream';

    function writeStorage(cb) {
      if ( options.isds ) {
        cb(false, data);
      } else {
        FS.abToDataSource(data, mime, (err, res) => {
          if ( err ) {
            callback(err, false);
          } else {
            cb(false, res);
          }
        });
      }
    }

    writeStorage((err, res) => {
      try {
        if ( addToCache(file, res, data) && commitStorage() ) {
          callback(err, true);
        } else {
          callback(API._('ERR_VFS_FATAL'), false);
        }
      } catch ( e ) {
        callback(e);
      }
    });
  },

  unlink: function(src, callback) {
    try {
      src = getFromCache(src.path) || src;

      if ( removeFromCache(src) && commitStorage() ) {
        callback(false, true);
      } else {
        callback(API._('ERR_VFS_FATAL'), false);
      }
    } catch ( e ) {
      callback(e);
    }
  },

  copy: function(src, dest, callback) {

    function _write(s, d, cb) {
      VFS.read(s, (err, data) => {
        if ( err ) {
          cb(err);
        } else {
          VFS.write(d, data, cb);
        }
      });
    }

    function _op(s, d, cb) {
      if ( s.type === 'file' ) {
        d.mime = s.mime;
      }

      d.size = s.size;
      d.type = s.type;

      if ( d.type === 'dir' ) {
        VFS.mkdir(d, (err, res) => {
          if ( err ) {
            cb(err);
          } else {
            const list = scanStorage(s, false);

            if ( list && list.length ) {
              Utils.asyncs(list, (entry, idx, next) => {
                const rp = entry.path.substr(src.path.length);
                const nd = new VFS.File(dest.path + rp);

                //console.warn('----->', 'source root', s);
                //console.warn('----->', 'dest root', d);
                //console.warn('----->', 'files', list.length, idx);
                //console.warn('----->', 'relative', rp);
                //console.warn('----->', 'new file', nd);

                _op(entry, nd, next);
              }, () => {
                cb(false, true);
              });
            } else {
              cb(false, true);
            }
          }
        });
      } else {
        _write(s, d, cb);
      }
    }

    // Force retrieval of real data so MIME is correctly synced etc
    src = getFromCache(src.path) || src;

    // Check if destination exists
    const droot = getRealPath(FS.dirname(dest.path));
    if ( droot !== '/' && !getFromCache(droot) ) {
      callback(API._('ERR_VFS_TARGET_NOT_EXISTS'));
      return;
    }

    if ( src.type === 'dir' && src.path === FS.dirname(dest.path) ) {
      callback('You cannot copy a directory into itself'); // FIXME
      return;
    }

    _op(src, dest, callback);
  },

  move: function(src, dest, callback) {
    const spath = getRealPath(src.path);
    const dpath = getRealPath(dest.path);

    const sdirname = FS.dirname(spath);
    const ddirname = FS.dirname(dpath);

    if ( _fileCache[dpath] ) {
      callback(API._('ERR_VFS_FILE_EXISTS'));
      return;
    }

    // Rename
    if ( sdirname === ddirname ) {
      if ( _fileCache[spath] ) {
        const tmp = _fileCache[spath];
        delete _fileCache[spath];
        _fileCache[dpath] = tmp;
      }

      if ( _cache[sdirname] ) {
        let found = -1;
        _cache[sdirname].forEach((i, idx) => {
          if ( i && found === -1 ) {
            if ( i.filename === src.filename && i.type === src.type ) {
              found = idx;
            }
          }
        });

        if ( found >= 0 ) {
          _cache[sdirname][found].filename = dest.filename;
        }
      }

      callback(false, commitStorage());
    } else {
      OSjs.VSF.copy(src, dest, (err) => {
        if ( err ) {
          callback(err);
        } else {
          VFS.unlink(src, callback);
        }
      });
    }
  },

  exists: function(item, callback) {
    const data = getFromCache(getRealPath(item.path));
    callback(false, !!data);
  },

  fileinfo: function(item, callback) {
    const data = getFromCache(item.path);
    callback(data ? false : API._('ERR_VFSMODULE_NOSUCH'), data);
  },

  mkdir: function(dir, callback) {
    const dpath = getRealPath(dir.path);
    if ( dpath !== '/' && getFromCache(dpath) ) {
      callback(API._('ERR_VFS_FILE_EXISTS'));
      return;
    }

    dir.mime = null;
    dir.size = 0;
    dir.type = 'dir';

    try {
      if ( addToCache(dir) && commitStorage() ) {
        callback(false, true);
      } else {
        callback(API._('ERR_VFS_FATAL'));
      }
    } catch ( e ) {
      callback(e);
    }
  },

  upload: function(file, dest, callback) {
    const check = new VFS.File(FS.pathJoin((new VFS.File(dest)).path, file.name), file.type);
    check.size = file.size;
    check.type = 'file';

    VFS.exists(check, (err, exists) => {
      if ( err || exists ) {
        callback(err || API._('ERR_VFS_FILE_EXISTS'));
      } else {
        const reader = new FileReader();
        reader.onerror = (e) => {
          callback(e);
        };
        reader.onloadend = () => {
          VFS.write(check, reader.result, callback, {isds: true});
        };
        reader.readAsDataURL(file);
      }
    });
  },

  url: function(item, callback) {
    VFS.exists(item, (err, exists) => {
      if ( err || !exists ) {
        callback(err || API._('ERR_VFS_FILE_EXISTS'));
      } else {
        VFS.read(item, callback, {url: true});
      }
    });
  },

  find: function(file, callback) {
    callback(API._('ERR_VFS_UNAVAILABLE'));
  },

  trash: function(file, callback) {
    callback(API._('ERR_VFS_UNAVAILABLE'));
  },

  untrash: function(file, callback) {
    callback(API._('ERR_VFS_UNAVAILABLE'));
  },

  emptyTrash: function(callback) {
    callback(API._('ERR_VFS_UNAVAILABLE'));
  },

  freeSpace: function(root, callback) {
    const total = 5 * 1024 * 1024;
    const used = JSON.stringify(_cache).length + JSON.stringify(_fileCache).length;

    callback(false, total - used);
  }
};

/////////////////////////////////////////////////////////////////////////////
// WRAPPERS
/////////////////////////////////////////////////////////////////////////////

function makeRequest(name, args, callback, options) {
  initStorage();

  const ref = LocalStorageStorage[name];
  const fargs = (args || []).slice(0);
  fargs.push(callback || function() {});
  fargs.push(options || {});

  return ref.apply(ref, fargs);
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = {
  module: LocalStorageStorage,
  unmount: (cb) => {
    cb = cb || function() {};
    _isMounted = false;
    API.message('vfs:unmount', 'LocalStorage', {source: null});
    cb(false, true);
  },
  mounted: () => {
    return _isMounted;
  },
  enabled: () => {
    try {
      if ( API.getConfig('VFS.LocalStorage.Enabled') ) {
        return true;
      }
    } catch ( e ) {
      console.warn('OSjs.VFS.Modules.LocalStorage::enabled()', e, e.stack);
    }
    return false;
  },
  request: makeRequest
};
