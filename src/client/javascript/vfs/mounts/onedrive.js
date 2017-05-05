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
const XHR = require('utils/xhr.js');
const VFS = require('vfs/fs.js');

/**
 * @namespace OneDrive
 * @memberof OSjs.VFS.Modules
 */

// https://social.msdn.microsoft.com/forums/onedrive/en-US/5e259b9c-8e9e-40d7-95c7-722ef5bb6d38/upload-file-to-skydrive-using-javascript
// http://msdn.microsoft.com/en-us/library/hh826531.aspx
// http://msdn.microsoft.com/en-us/library/dn659726.aspx

let _isMounted    = false;

let _mimeCache;

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

/*
 * Perform a REST call to WL API
 */
function onedriveCall(args, callback) {
  console.debug('OneDrive::*onedriveCall()', args);

  const WL = window.WL || {};
  WL.api(args).then(
    (response) => {
      callback(false, response);
    },
    (responseFailed) => {
      console.error('OneDrive::*onedriveCall()', 'error', responseFailed, args);
      callback(responseFailed.error.message);
    }
  );
}

/*
 * Gets OS.js VFS File Metadata type from OneDrive item
 */
function getItemType(iter) {
  let type = 'file';
  if ( iter.type === 'folder' || iter.type === 'album' ) {
    type = 'dir';
  }
  return type;
}

/*
 * Get OS.js VFS File Metadata from OneDrive item
 */
function getMetadataFromItem(dir, item) {
  const path = 'onedrive://' + dir.replace(/^\/+/, '').replace(/\/+$/, '') + '/' + item.name; // FIXME

  const itemFile = new VFS.File({
    id: item.id,
    filename: item.name,
    size: item.size || 0,
    path: path,
    mime: getItemMime(item),
    type: getItemType(item)
  });
  return itemFile;
}

/*
 * Get MIME type from file extension of a file
 * Yeah... it's pretty rough, but OneDrive does
 * not support mimes yet
 */
function getItemMime(iter) {
  if ( !_mimeCache ) {
    _mimeCache = API.getConfig('MIME.mapping', {});
  }
  let mime = null;
  if ( getItemType(iter) !== 'dir' ) {
    mime = 'application/octet-stream';
    let ext = FS.filext(iter.name);
    if ( ext.length ) {
      ext = '.' + ext;
      if ( _mimeCache[ext] ) {
        mime = _mimeCache[ext];
      }
    }
  }
  return mime;
}

/*
 * Create an Array filled with OS.js VFS file metadata
 */
function createDirectoryList(dir, list, item, options) {
  const result = [];

  if ( dir !== '/' ) {
    result.push(new VFS.File({
      id: item.id,
      filename: '..',
      path: FS.dirname(item.path),
      size: 0,
      type: 'dir'
    }));
  }

  list.forEach((iter) => {
    result.push(getMetadataFromItem(dir, iter));
  });

  return result;
}

/*
 * Get files inside given folder
 */
function getFilesInFolder(folderId, callback) {
  onedriveCall({
    path: folderId + '/files',
    method: 'GET'
  }, (error, response) => {
    if ( error ) {
      callback(error);
      return;
    }

    console.debug('OneDrive::*getFilesInFolder()', '=>', response);
    callback(false, response.data || []);
  });
}

/*
 * Check if file is existent inside given folder
function isFileInFolder(folderId, file, callback, returnIter) {
  getFilesInFolder(folderId, (error, list) => {
    if ( error ) {
      callback(error);
      return;
    }

    var found;
    list.forEach((iter) => {
      if ( iter.name === file.filename ) {
        found = iter;
        return false;
      }
      return true;
    });

    if ( found ) {
      if ( returnIter ) {
        callback(false, found);
        return;
      }

      var dir = FS.getPathProtocol(FS.dirname(found.path));
      var foundFile = getMetadataFromItem(dir, found);
      callback(false, foundFile);
    } else {
      callback('Could not find requested file');
    }
  });
}
*/

/*
 * Resolve normal /path/to/file to OneDrive ID
 */
function resolvePath(item, callback, useParent) {
  if ( !useParent ) {
    if ( item.id ) {
      callback(false, item.id);
      return;
    }
  }

  let path = FS.getPathFromVirtual(item.path).replace(/\/+/, '/');
  if ( useParent ) {
    path = FS.dirname(path);
  }
  if ( path === '/' ) {
    callback(false, 'me/skydrive');
    return;
  }

  const resolves = path.replace(/^\/+/, '').split('/');
  const isOnRoot = !resolves.length;

  let currentParentId = 'me/skydrive';

  function _nextDir(completed) {
    const current = resolves.shift();
    const done = resolves.length <= 0;
    let found;

    if ( isOnRoot ) {
      found = currentParentId;
    } else {

      if ( current ) {
        getFilesInFolder(currentParentId, (error, list) => {
          list = list || [];

          let lfound;

          if ( !error ) {
            list.forEach((iter) => { // FIXME: Not very precise
              if ( iter ) {
                if ( iter.name === current ) {
                  lfound = iter.id;
                }
              }
            });

            if ( lfound ) {
              currentParentId = lfound;
            }
          } else {
            console.warn('OneDrive', 'resolvePath()', 'getFilesInFolder() error', error);
          }

          if ( done ) {
            completed(lfound);
          } else {
            _nextDir(completed);
          }

        });

        return;
      }
    }

    if ( done ) {
      completed(found);
    } else {
      _nextDir(completed);
    }
  }

  _nextDir((foundId) => {
    if ( foundId ) {
      callback(false, foundId);
    } else {
      callback(API._('ONEDRIVE_ERR_RESOLVE'));
    }
  });
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

let OneDriveStorage = {};

OneDriveStorage.scandir = function(item, callback, options) {
  console.group('OneDrive::scandir()');

  console.info('OneDrive::scandir()', item);

  const relativePath = FS.getPathFromVirtual(item.path);

  function _finished(error, result) {
    console.groupEnd();
    callback(error, result);
  }

  function _scandir(drivePath) {
    onedriveCall({
      path: drivePath,
      method: 'GET'
    }, (error, response) => {
      if ( error ) {
        _finished(error);
        return;
      }
      console.debug('OneDrive::scandir()', '=>', response);

      getFilesInFolder(response.id, (error, list) => {
        if ( error ) {
          _finished(error);
          return;
        }
        const fileList = createDirectoryList(relativePath, list, item, options);
        _finished(false, fileList);
      });
    });
  }

  resolvePath(item, (error, drivePath) => {
    if ( error ) {
      _finished(error);
      return;
    }
    _scandir(drivePath);
  });
};

OneDriveStorage.read = function(item, callback, options) {
  options = options || {};

  this.url(item, (error, url) => {
    if ( error ) {
      callback(error);
      return;
    }

    const file = new VFS.File(url, item.mime);
    VFS.read(file, (error, response) => {
      if ( error ) {
        callback(error);
        return;
      }
      callback(false, response);
    }, options);
  });
};

OneDriveStorage.write = function(file, data, callback) {
  console.info('OneDrive::write()', file);

  const inst = OSjs.Helpers.WindowsLiveAPI.getInstance();
  const url = 'https://apis.live.net/v5.0/me/skydrive/files?access_token=' + inst.accessToken;
  const fd  = new FormData();
  FS.addFormFile(fd, 'file', data, file);

  /*
  API.curl({
    url: url,
    method: 'POST',
    json: true,
    body: fd,
  }, (err, result) => {
    if ( err ) {
    }
  });
  */

  XHR.ajax({
    url: url,
    method: 'POST',
    json: true,
    body: fd,
    onsuccess: (result) => {
      if ( result && result.id ) {
        callback(false, result.id);
        return;
      }
      callback(API._('ERR_APP_UNKNOWN_ERROR'));
    },
    onerror: (error, result) => {
      if ( result && result.error ) {
        error += ' - ' + result.error.message;
      }
      callback(error);
    }
  });
};

OneDriveStorage.copy = function(src, dest, callback) {
  resolvePath(src, (error, srcDrivePath) => {
    if ( error ) {
      callback(error);
      return;
    }

    resolvePath(dest, (error, dstDrivePath) => {
      if ( error ) {
        callback(error);
        return;
      }

      onedriveCall({
        path: srcDrivePath,
        method: 'COPY',
        body: {
          destination: dstDrivePath
        }
      }, (error, response) => {
        callback(error, error ? null : true);
      });
    });
  });
};

OneDriveStorage.unlink = function(src, callback) {
  resolvePath(src, (error, drivePath) => {
    if ( error ) {
      callback(error);
      return;
    }

    onedriveCall({
      path: drivePath,
      method: 'DELETE'
    }, (error, response) => {
      callback(error, error ? null : true);
    });
  });
};

OneDriveStorage.move = function(src, dest, callback) {
  resolvePath(src, (error, srcDrivePath) => {
    if ( error ) {
      callback(error);
      return;
    }

    resolvePath(dest, (error, dstDrivePath) => {
      if ( error ) {
        callback(error);
        return;
      }

      onedriveCall({
        path: srcDrivePath,
        method: 'MOVE',
        body: {
          destination: dstDrivePath
        }
      }, (error, response) => {
        callback(error, error ? null : true);
      });
    });
  });

};

// FIXME Is there a better way to do this ?
OneDriveStorage.exists = function(item, callback) {
  console.info('OneDrive::exists()', item); // TODO

  /*
  resolvePath(item, (error, drivePath) => {
    if ( error ) {
      callback(false, false);
      //callback(error);
      return;
    }
    isFileInFolder(drivePath, item, callback);
  });
  */
  this.fileinfo(item, (error, response) => {
    if ( error ) {
      callback(false, false);
      return;
    }
    callback(false, response ? true : false);
  });
};

OneDriveStorage.fileinfo = function(item, callback) {
  console.info('OneDrive::fileinfo()', item);
  resolvePath(item, (error, drivePath) => {
    if ( error ) {
      callback(error);
      return;
    }

    onedriveCall({
      path: drivePath,
      method: 'GET'
    }, (error, response) => {
      if ( error ) {
        callback(error);
        return;
      }

      const useKeys = ['created_time', 'id', 'link', 'name', 'type', 'updated_time', 'upload_location', 'description', 'client_updated_time'];
      const info = {};
      useKeys.forEach((k) => {
        info[k] = response[k];
      });
      callback(false, info);
    });

  });
};

OneDriveStorage.mkdir = function(dir, callback) {
  resolvePath(dir, (error, drivePath) => {
    if ( error ) {
      callback(error);
      return;
    }

    onedriveCall({
      path: drivePath,
      method: 'POST',
      body: {
        name: dir.filename
      }
    }, (error, response) => {
      callback(error, error ? null : true);
    });
  }, true);
};

OneDriveStorage.upload = function(file, dest, callback) {
  console.info('OneDrive::upload()', file, dest);

  const item = new VFS.File({
    filename: file.name,
    path: FS.pathJoin((new VFS.File(dest)).path, file.name),
    mime: file.type,
    size: file.size
  });

  this.write(item, file, callback);
};

OneDriveStorage.url = function(item, callback) {
  console.info('OneDrive::url()', item);

  /*
  const drivePath = item.id; // TODO
  const inst = OSjs.Helpers.WindowsLiveAPI.getInstance();
  const url = '//apis.live.net/v5.0/' + drivePath + '/content?access_token=' + inst.accessToken;

  callback(false, url);
  */

  resolvePath(item, function(error, drivePath) {
    if ( error ) {
      callback(error);
      return;
    }

    onedriveCall({
      path: drivePath + '/content',
      method: 'GET'
    }, (error, response) => {
      if ( error ) {
        callback(error);
        return;
      }
      callback(false, response.location);
    });
  });

};

OneDriveStorage.trash = function(file, callback) {
  callback(API._('ERR_VFS_UNAVAILABLE'));
};

OneDriveStorage.untrash = function(file, callback) {
  callback(API._('ERR_VFS_UNAVAILABLE'));
};

OneDriveStorage.emptyTrash = function(callback) {
  callback(API._('ERR_VFS_UNAVAILABLE'));
};

OneDriveStorage.freeSpace = function(root, callback) {
  callback(false, -1);
};

/////////////////////////////////////////////////////////////////////////////
// WRAPPERS
/////////////////////////////////////////////////////////////////////////////

function getOneDrive(callback, onerror) {
  callback = callback || function() {};
  onerror  = onerror  || function() {};

  // Check if user has signed out or revoked permissions
  if ( _isMounted ) {
    const inst = OSjs.Helpers.WindowsLiveAPI.getInstance();
    if ( inst && !inst.authenticated ) {
      _isMounted = false;
    }
  }

  if ( !_isMounted ) {
    const iargs = {scope: ['wl.signin', 'wl.skydrive', 'wl.skydrive_update']};

    OSjs.Helpers.WindowsLiveAPI.createInstance(iargs, (error, result) => {
      if ( error ) {
        onerror(error);
      } else {
        _isMounted = true;
        API.message('vfs:mount', 'OneDrive', {source: null});
        callback(OneDriveStorage);
      }
    });
    return;
  }

  callback(OneDriveStorage);
}

function makeRequest(name, args, callback, options) {
  args = args || [];
  callback = callback || function() {};

  getOneDrive((instance) => {
    if ( !instance ) {
      throw new Error('No OneDrive instance was created. Load error ?');
    } else if ( !instance[name] ) {
      throw new Error('Invalid OneDrive API call name');
    }

    const fargs = args;
    fargs.push(callback);
    fargs.push(options);
    instance[name].apply(instance, fargs);
  }, (error) => {
    callback(error);
  });
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

/*
 * This is the Microsoft OneDrive VFS Abstraction for OS.js
 */
module.exports = {
  module: OneDriveStorage,
  unmount: (cb) => {
    // FIXME: Should we sign out here too ?
    cb = cb || function() {};
    _isMounted = false;
    API.message('vfs:unmount', 'OneDrive', {source: null});
    cb(false, true);
  },
  mounted: () => {
    return _isMounted;
  },
  enabled: () => {
    try {
      if ( API.getConfig('VFS.OneDrive.Enabled') ) {
        return true;
      }
    } catch ( e ) {
      console.warn('OSjs.VFS.Modules.OneDrive::enabled()', e, e.stack);
    }
    return false;
  },
  request: makeRequest
};
