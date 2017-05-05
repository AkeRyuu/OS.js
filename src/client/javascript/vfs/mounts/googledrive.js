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
const MountManager = require('core/mount-manager.js');

/**
 * @namespace GoogleDrive
 * @memberof OSjs.VFS.Modules
 */

const gapi = window.gapi = window.gapi  || {};

// https://developers.google.com/drive/web/quickstart/quickstart-js
// https://developers.google.com/+/web/signin/javascript-flow
// https://developers.google.com/drive/realtime/realtime-quickstart
// https://developers.google.com/drive/v2/reference/

// https://developers.google.com/drive/web/search-parameters
// https://developers.google.com/drive/v2/reference/files/list
// http://stackoverflow.com/questions/22092402/python-google-drive-api-list-the-entire-drive-file-tree
// https://developers.google.com/drive/web/folder

// If the user idles the connection for this amount of time, the cache will automatically clean
// forcing an update. If user uploads from another place etc. OS.js will make sure to fetch these
let CACHE_CLEAR_TIMEOUT = 7000;

let _isMounted    = false;
let _rootFolderId = null;
let _treeCache    = null;

let _clearCacheTimeout;

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

function createBoundary(file, data, callback) {
  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const close_delim = '\r\n--' + boundary + '--';
  const contentType = file.mime || 'text/plain'; //fileData.type || 'application/octet-stream';

  function createBody(result) {
    const metadata = {
      title: file.filename,
      mimeType: contentType
    };
    const base64Data = result;
    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delim;

    return multipartRequestBody;
  }

  const reqContentType = 'multipart/mixed; boundary=\'' + boundary + '\'';

  if ( data instanceof VFS.FileData ) {
    callback(false, {
      contentType: reqContentType,
      body: createBody(data.toBase64())
    });
  } else {
    FS.abToBinaryString(data, contentType, (error, response) => {
      callback(error, error ? false : {
        contentType: reqContentType,
        body: createBody(btoa(response))
      });
    });
  }
}

/*
 * Scans entire file tree for given path
 */
function getFileFromPath(dir, type, callback) {
  if ( dir instanceof VFS.File ) {
    dir = dir.path;
  }

  const tmpItem = new VFS.File({
    filename: FS.filename(dir),
    type: 'dir',
    path: FS.dirname(dir)
  });

  console.debug('GoogleDrive::*getFileIdFromPath()', dir, type, tmpItem);

  getAllDirectoryFiles(tmpItem, (error, list, ldir) => {
    if ( error ) {
      callback(error);
      return;
    }

    let found = null;
    list.forEach((iter) => {
      if ( iter.title === FS.filename(dir) ) {
        if ( type ) {
          if ( iter.mimeType === type ) {
            found = iter;
            return false;
          }
        } else {
          found = iter;
        }
      }
      return true;
    });

    callback(false, found);
  });
}

/*
 * Gets the parent path
 */
function getParentPathId(item, callback) {
  const dir = FS.dirname(item.path);
  const type = 'application/vnd.google-apps.folder';

  console.debug('GoogleDrive::*getParentPathId()', item);

  getFileFromPath(dir, type, (error, item) => {
    if ( error ) {
      callback(error);
    } else {
      callback(false, item ? item.id : null);
    }
  });
}

/*
 * Generate FileView compatible array of scandir()
 */
function createDirectoryList(dir, list, item, options) {
  const result = [];
  const rdir = dir.replace(/^google-drive\:\/+/, '/'); // FIXME
  const isOnRoot = rdir === '/';

  function createItem(iter, i) {
    let path = dir;
    if ( iter.title === '..' ) {
      path = FS.dirname(dir);
    } else {
      if ( !isOnRoot ) {
        path += '/';
      }
      path += iter.title;
    }
    let fileType = iter.mimeType === 'application/vnd.google-apps.folder' ? 'dir' : (iter.kind === 'drive#file' ? 'file' : 'dir');
    if ( iter.mimeType === 'application/vnd.google-apps.trash' ) {
      fileType = 'trash';
    }

    return new VFS.File({
      filename: iter.title,
      path: path,
      id: iter.id,
      size: iter.quotaBytesUsed || 0,
      mime: iter.mimeType === 'application/vnd.google-apps.folder' ? null : iter.mimeType,
      type: fileType
    });
  }

  if ( list ) {
    list.forEach((iter, i) => {
      if ( !iter ) {
        return;
      }
      result.push(createItem(iter, i));
    });
  }
  return result ? FS.filterScandir(result, options) : [];
}

/*
 * Get all files in a directory
 */
function getAllDirectoryFiles(item, callback) {
  console.debug('GoogleDrive::*getAllDirectoryFiles()', item);

  function retrieveAllFiles(cb) {
    if ( _clearCacheTimeout ) {
      clearTimeout(_clearCacheTimeout);
      _clearCacheTimeout = null;
    }
    if ( _treeCache ) {
      console.info('USING CACHE FROM PREVIOUS FETCH!');
      cb(false, _treeCache);
      return;
    }
    console.info('UPDATING CACHE');

    let list = [];

    function retrievePageOfFiles(request, result) {
      request.execute((resp) => {
        if ( resp.error ) {
          console.warn('GoogleDrive::getAllDirectoryFiles()', 'error', resp);
        }

        result = result.concat(resp.items);

        const nextPageToken = resp.nextPageToken;
        if (nextPageToken) {
          request = gapi.client.drive.files.list({
            pageToken: nextPageToken
          });
          retrievePageOfFiles(request, result);
        } else {
          _treeCache = result;

          cb(false, result);
        }
      });
    }

    try {
      const initialRequest = gapi.client.drive.files.list({});
      retrievePageOfFiles(initialRequest, list);
    } catch ( e ) {
      console.warn('GoogleDrive::getAllDirectoryFiles() exception', e, e.stack);
      console.warn('THIS ERROR OCCURS WHEN MULTIPLE REQUESTS FIRE AT ONCE ?!'); // FIXME
      cb(false, list);
    }
  }

  function getFilesBelongingTo(list, root, cb) {
    const idList = {};
    const parentList = {};
    list.forEach((iter) => {
      if ( iter ) {
        idList[iter.id] = iter;
        const parents = [];
        if ( iter.parents ) {
          iter.parents.forEach((piter) => {
            if ( piter ) {
              parents.push(piter.id);
            }
          });
        }
        parentList[iter.id] = parents;
      }
    });

    let resolves = FS.getPathFromVirtual(root).replace(/^\/+/, '').split('/');
    resolves = resolves.filter((el) => {
      return el !== '';
    });

    let currentParentId = _rootFolderId;
    let isOnRoot = !resolves.length;

    function _getFileList(foundId) {
      const result = [];

      if ( !isOnRoot ) {
        result.push({
          title: '..',
          path: FS.dirname(root),
          id: item.id,
          quotaBytesUsed: 0,
          mimeType: 'application/vnd.google-apps.folder'
        });
      }

      list.forEach((iter) => {
        if ( iter && parentList[iter.id] && parentList[iter.id].indexOf(foundId) !== -1 ) {
          result.push(iter);
        }
      });
      return result;
    }

    function _nextDir(completed) {
      let current = resolves.shift();
      let done = resolves.length <= 0;
      let found;

      if ( isOnRoot ) {
        found = currentParentId;
      } else {
        if ( current ) {
          list.forEach((iter) => {
            if ( iter ) {
              if ( iter.title === current && parentList[iter.id] && parentList[iter.id].indexOf(currentParentId) !== -1 ) {
                currentParentId = iter.id;
                found  = iter.id;
              }
            }
          });
        }
      }

      if ( done ) {
        completed(found);
      } else {
        _nextDir(completed);
      }
    }

    _nextDir((foundId) => {
      if ( foundId && idList[foundId] ) {
        cb(false, _getFileList(foundId));
        return;
      } else {
        if ( isOnRoot ) {
          cb(false, _getFileList(currentParentId));
          return;
        }
      }

      cb('Could not list directory');
    });
  }

  function doRetrieve() {
    retrieveAllFiles((error, list) => {
      const root = item.path;
      if ( error ) {
        callback(error, false, root);
        return;
      }

      getFilesBelongingTo(list, root, (error, response) => {
        console.groupEnd();

        _clearCacheTimeout = setTimeout(() => {
          console.info('Clearing GoogleDrive filetree cache!');
          _treeCache = null;
        }, CACHE_CLEAR_TIMEOUT);

        console.debug('GoogleDrive::*getAllDirectoryFiles()', '=>', response);
        callback(error, response, root);
      });
    });

  }

  console.group('GoogleDrive::*getAllDirectoryFiles()');

  if ( !_rootFolderId ) {
    const request = gapi.client.drive.about.get();
    request.execute((resp) => {
      if ( !resp || !resp.rootFolderId ) {
        callback(API._('ERR_VFSMODULE_ROOT_ID'));
        return;
      }
      _rootFolderId = resp.rootFolderId;

      doRetrieve();
    });
  } else {
    doRetrieve();
  }

}

/*
 * Sets the folder for a file
 */
function setFolder(item, pid, callback) {
  console.info('GoogleDrive::setFolder()', item, pid);

  pid = pid || 'root';

  function _clearFolders(cb) {
    item.parents.forEach((p, i) => {
      const request = gapi.client.drive.children.delete({
        folderId: p.id,
        childId: item.id
      });

      request.execute((resp) => {
        if ( i >= (item.parents.length - 1) ) {
          cb();
        }
      });
    });
  }

  function _setFolder(rootId, cb) {
    const request = gapi.client.drive.children.insert({
      folderId: pid,
      resource: {id: item.id}
    });

    request.execute((resp) => {
      console.info('GoogleDrive::setFolder()', '=>', resp);
      callback(false, true);
    });
  }

  _clearFolders(() => {
    _setFolder(pid, callback);
  });
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

let GoogleDriveStorage = {};

GoogleDriveStorage.scandir = function(item, callback, options) {
  console.info('GoogleDrive::scandir()', item);

  getAllDirectoryFiles(item, (error, list, dir) => {
    if ( error ) {
      callback(error);
    } else {
      let result = createDirectoryList(dir, list, item, options);
      callback(false, result, list);
    }
  });
};

GoogleDriveStorage.read = function(item, callback, options) {
  console.info('GoogleDrive::read()', item);

  function doRead() {
    let request = gapi.client.drive.files.get({
      fileId: item.id
    });

    request.execute((file) => {
      console.info('GoogleDrive::read()', '=>', file);

      if ( file && file.id ) {
        let accessToken = gapi.auth.getToken().access_token;
        XHR.ajax({
          url: file.downloadUrl,
          method: 'GET',
          responseType: 'arraybuffer',
          requestHeaders: {'Authorization': 'Bearer ' + accessToken},
          onsuccess: (response) => {
            callback(false, response);
          },
          onerror: (error) => {
            callback(API._('ERR_VFSMODULE_XHR_ERROR') + ' - ' + error);
          }
        });
      } else {
        callback(API._('ERR_VFSMODULE_NOSUCH'));
      }
    });
  }

  if ( item.downloadUrl ) {
    doRead();
  } else {
    getFileFromPath(item.path, item.mime, function(error, response) {
      if ( error ) {
        callback(error);
        return;
      }
      if ( !response ) {
        callback(API._('ERR_VFSMODULE_NOSUCH'));
        return;
      }

      item = response;
      doRead();
    });
  }
};

GoogleDriveStorage.write = function(file, data, callback) {
  console.info('GoogleDrive::write()', file);

  function doWrite(parentId, fileId) {
    console.debug('GoogleDrive::write()->doWrite()', parentId, fileId);
    let uri = '/upload/drive/v2/files';
    let method = 'POST';
    if ( fileId ) {
      uri = '/upload/drive/v2/files/' + fileId;
      method = 'PUT';
    }

    createBoundary(file, data, (error, fileData) => {
      if ( error ) {
        callback(error);
        return;
      }

      const request = gapi.client.request({
        path: uri,
        method: method,
        params: {uploadType: 'multipart'},
        headers: {'Content-Type': fileData.contentType},
        body: fileData.body
      });

      request.execute((resp) => {
        console.info('GoogleDrive::write()', '=>', resp);
        console.groupEnd();

        _treeCache = null; // Make sure we refetch any cached stuff
        if ( resp && resp.id ) {
          if ( parentId ) {
            setFolder(resp, parentId, callback);
          } else {
            callback(false, true);
          }
        } else {
          callback(API._('ERR_VFSMODULE_NOSUCH'));
        }
      });
    });
  }

  console.group('GoogleDrive::write()');
  getParentPathId(file, (error, id) => {
    console.debug('GoogleDrive::write()->getParentPathId', id);
    if ( error ) {
      console.groupEnd();
      callback(error);
      return;
    }

    if ( file.id ) {
      doWrite(id, file.id);
    } else {
      this.exists(file, (error, exists) => {
        const fileid = error ? null : (exists ? exists.id : null);
        doWrite(id, fileid);
      });
    }
  });
};

GoogleDriveStorage.copy = function(src, dest, callback) {
  console.info('GoogleDrive::copy()', src, dest);
  const request = gapi.client.drive.files.copy({
    fileId: FS.filename(src),
    resource: {title: FS.filename(dest)}
  });
  request.execute((resp) => {
    console.info('GoogleDrive::copy()', '=>', resp);

    if ( resp.id ) {
      callback(false, true);
      return;
    }

    const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
    callback(msg);
  });
};

GoogleDriveStorage.unlink = function(src, callback) {
  console.info('GoogleDrive::unlink()', src);

  function doDelete() {
    _treeCache = null; // Make sure we refetch any cached stuff

    const request = gapi.client.drive.files.delete({
      fileId: src.id
    });
    request.execute((resp) => {
      console.info('GoogleDrive::unlink()', '=>', resp);
      if ( resp && (typeof resp.result === 'object') ) {
        callback(false, true);
      } else {
        const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
        callback(msg);
      }
    });
  }

  if ( !src.id ) {
    getFileFromPath(src.path, src.mime, (error, response) => {
      if ( error ) {
        callback(error);
        return;
      }
      if ( !response ) {
        callback(API._('ERR_VFSMODULE_NOSUCH'));
        return;
      }

      src = response;
      doDelete();
    });
  } else {
    doDelete();
  }
};

GoogleDriveStorage.move = function(src, dest, callback) {
  console.info('GoogleDrive::move()', src, dest);

  const request = gapi.client.drive.files.patch({
    fileId: src.id,
    resource: {
      title: FS.filename(dest.path)
    }
  });

  request.execute((resp) => {
    if ( resp && resp.id ) {
      _treeCache = null; // Make sure we refetch any cached stuff
      callback(false, true);
    } else {
      const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
      callback(msg);
    }
  });
};

// FIXME Is there a better way to do this ?
GoogleDriveStorage.exists = function(item, callback) {
  console.info('GoogleDrive::exists()', item);

  const req = new VFS.File(FS.dirname(item.path));

  this.scandir(req, (error, result) => {
    if ( error ) {
      callback(error);
      return;
    }

    let found = false;
    if ( result ) {
      result.forEach((iter) => {
        if ( iter.path === item.path ) {
          found = new VFS.File(item.path, iter.mimeType);
          found.id = iter.id;
          found.title = iter.title;
          return false;
        }
        return true;
      });
    }

    callback(false, found);
  });
};

GoogleDriveStorage.fileinfo = function(item, callback) {
  console.info('GoogleDrive::fileinfo()', item);

  const request = gapi.client.drive.files.get({
    fileId: item.id
  });
  request.execute((resp) => {
    if ( resp && resp.id ) {
      const useKeys = ['createdDate', 'id', 'lastModifyingUser', 'lastViewedByMeDate', 'markedViewedByMeDate', 'mimeType', 'modifiedByMeDate', 'modifiedDate', 'title', 'alternateLink'];
      const info = {};
      useKeys.forEach((k) => {
        info[k] = resp[k];
      });
      callback(false, info);
    } else {
      callback(API._('ERR_VFSMODULE_NOSUCH'));
    }
  });
};

GoogleDriveStorage.url = function(item, callback) {
  console.info('GoogleDrive::url()', item);
  if ( !item || !item.id ) {
    throw new Error('url() expects a File ref with Id');
  }

  const request = gapi.client.drive.files.get({
    fileId: item.id
  });

  request.execute((resp) => {
    console.info('GoogleDrive::url()', resp);
    if ( resp && resp.webContentLink ) {
      callback(false, resp.webContentLink);
    } else {
      const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
      callback(msg);
    }
  });
};

GoogleDriveStorage.mkdir = function(dir, callback) {
  console.info('GoogleDrive::mkdir()', dir);

  function doMkdir(parents) {

    const request = gapi.client.request({
      'path': '/drive/v2/files',
      'method': 'POST',
      'body': JSON.stringify({
        title: dir.filename,
        parents: parents,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    request.execute((resp) => {
      console.info('GoogleDrive::mkdir()', '=>', resp);
      if ( resp && resp.id ) {
        _treeCache = null; // Make sure we refetch any cached stuff
        callback(false, true);
      } else {
        const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
        callback(msg);
      }
    });
  }

  if ( FS.getPathFromVirtual(FS.dirname(dir.path)) !== FS.getPathFromVirtual(MountManager.getModuleProperty('GoogleDrive', 'root')) ) {
    getParentPathId(dir, (error, id) => {
      console.debug('GoogleDrive::mkdir()->getParentPathId()', id, 'of', dir);
      if ( error || !id ) {
        error = error || API._('ERR_VFSMODULE_PARENT');
        callback(API._('ERR_VFSMODULE_PARENT_FMT', error));
        return;
      }
      doMkdir([{id: id}]);
    });

    return;
  }

  doMkdir(null);
};

GoogleDriveStorage.upload = function(file, dest, callback) {
  console.info('GoogleDrive::upload()', file, dest);

  const item = new VFS.File({
    filename: file.name,
    path: FS.pathJoin((new VFS.File(dest)).path, file.name),
    mime: file.type,
    size: file.size
  });

  this.write(item, file, callback);
};

GoogleDriveStorage.trash = function(file, callback) {
  const request = gapi.client.drive.files.trash({
    fileId: file.id
  });
  request.execute((resp) => {
    console.info('GoogleDrive::trash()', '=>', resp);

    if ( resp.id ) {
      callback(false, true);
      return;
    }

    const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
    callback(msg);
  });
};

GoogleDriveStorage.untrash = function(file, callback) {
  const request = gapi.client.drive.files.untrash({
    fileId: file.id
  });
  request.execute((resp) => {
    console.info('GoogleDrive::untrash()', '=>', resp);

    if ( resp.id ) {
      callback(false, true);
      return;
    }

    const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
    callback(msg);
  });
};

GoogleDriveStorage.emptyTrash = function(callback) {
  const request = gapi.client.drive.files.emptyTrash({});
  request.execute((resp) => {
    console.info('GoogleDrive::emptyTrash()', '=>', resp);
    if ( resp && resp.message ) {
      const msg = resp && resp.message ? resp.message : API._('ERR_APP_UNKNOWN_ERROR');
      callback(msg);
      return;
    }
    callback(false, true);
  });
};

GoogleDriveStorage.freeSpace = function(root, callback) {
  callback(false, -1);
};

/////////////////////////////////////////////////////////////////////////////
// WRAPPERS
/////////////////////////////////////////////////////////////////////////////

function getGoogleDrive(callback, onerror) {
  callback = callback || function() {};
  onerror  = onerror  || function() {};

  // Check if user has signed out or revoked permissions
  if ( _isMounted ) {
    const inst = OSjs.Helpers.GoogleAPI.getInstance();
    if ( inst && !inst.authenticated ) {
      _isMounted = false;
    }
  }

  if ( !_isMounted ) {
    const scopes = [
      'https://www.googleapis.com/auth/drive.install',
      'https://www.googleapis.com/auth/drive.file',
      'openid'
    ];
    const loads = [
      'drive-realtime',
      'drive-share'
    ];
    const iargs = {load: loads, scope: scopes};
    OSjs.Helpers.GoogleAPI.createInstance(iargs, (error, result) => {
      if ( error ) {
        onerror(error);
        return;
      }

      gapi.client.load('drive', 'v2', () => {
        _isMounted = true;

        API.message('vfs:mount', 'GoogleDrive', {source: null});

        callback(GoogleDriveStorage);
      });
    });
    return;
  }

  callback(GoogleDriveStorage);
}

function makeRequest(name, args, callback, options) {
  args = args || [];
  callback = callback || function() {};

  getGoogleDrive((instance) => {
    if ( !instance ) {
      throw new Error('No GoogleDrive instance was created. Load error ?');
    } else if ( !instance[name] ) {
      throw new Error('Invalid GoogleDrive API call name');
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

module.exports = {
  module: GoogleDriveStorage,
  unmount: (cb) => {
    // FIXME: Should we sign out here too ?
    cb = cb || function() {};
    _isMounted = false;
    API.message('vfs:unmount', 'GoogleDrive', {source: null});
    cb(false, true);
  },
  mounted: () => {
    return _isMounted;
  },
  enabled: () => {
    try {
      if ( API.getConfig('VFS.GoogleDrive.Enabled') ) {
        return true;
      }
    } catch ( e ) {
      console.warn('OSjs.VFS.Modules.GoogleDrive::enabled()', e, e.stack);
    }
    return false;
  },
  request: makeRequest
};
