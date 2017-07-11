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
import MountManager from 'core/mount-manager';
import Connection from 'core/connection';
import * as FS from 'utils/fs';
import * as Utils from 'utils/misc';
import {_} from 'core/locales';
import {getConfig} from 'core/config';
import FileMetadata from 'vfs/file';

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

function getModule(item) {
  const module = MountManager.getModuleFromPath(item.path, false, true);
  if ( !module ) {
    throw new Error(_('ERR_VFSMODULE_INVALID_FMT', item.path));
  }
  return module;
}

function getNamespace(item) {
  const module = getModule(item);
  return module.options.ns || 'DAV:';
}

function getCORSAllowed(item) {
  const module = getModule(item);
  return module.options.cors === true;
}

function getURL(item) {
  if ( typeof item === 'string' ) {
    item = new FileMetadata(item);
  }
  const module = getModule(item);
  const opts = module.options;
  return Utils.parseurl(opts.host, {username: opts.username, password: opts.password}).url;
}

function getURI(item) {
  const module = getModule(item);
  return Utils.parseurl(module.options.host).path;
}

function resolvePath(item) {
  const module = getModule(item);
  return item.path.replace(module.match, '');
}

function davCall(method, args, callback, raw) {
  function parseDocument(body) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(body, 'application/xml');
    return doc.firstChild;
  }

  function getUrl(p, f) {
    let url = getURL(p);
    url += resolvePath(f).replace(/^\//, '');
    return url;
  }

  const mime = args.mime || 'application/octet-stream';
  const headers = {};
  const sourceFile = new FileMetadata(args.path, mime);
  const sourceUrl = getUrl(args.path, sourceFile);

  let destUrl = null;
  if ( args.dest ) {
    destUrl = getUrl(args.dest, new FileMetadata(args.dest, mime));
    headers.Destination = destUrl;
  }

  function externalCall() {
    const opts = {
      url: sourceUrl,
      method: method,
      requestHeaders: headers
    };

    if ( raw ) {
      opts.binary = true;
      opts.mime = mime;
    }

    if ( typeof args.data !== 'undefined' ) {
      opts.query = args.data;
    }

    Connection.request('curl', opts, (error, result) => {
      if ( error ) {
        callback(error);
        return;
      }

      if ( !result ) {
        callback(_('ERR_VFS_REMOTEREAD_EMPTY'));
        return;
      }

      if ( ([200, 201, 203, 204, 205, 207]).indexOf(result.httpCode) < 0 ) {
        callback(_('ERR_VFSMODULE_XHR_ERROR') + ': ' + result.httpCode);
        return;
      }

      if ( opts.binary ) {
        OSjs.VFS.Helpers.dataSourceToAb(result.body, mime, callback);
      } else {
        const doc = parseDocument(result.body);
        callback(false, doc);
      }
    });
  }

  if ( getCORSAllowed(sourceFile) ) {
    OSjs.VFS.Transports.OSjs.request('get', {url: sourceUrl, method: method}, callback);
  } else {
    externalCall();
  }
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

/**
 * WebDAV (OwnCloud) VFS Transport Module
 */
const Transport = {
  scandir: function(item, callback, options) {

    function parse(doc) {
      const ns = getNamespace(item);
      const list = [];
      const reqpath = resolvePath(item);
      const root = MountManager.getRootFromPath(item.path);

      (doc.children || []).forEach((c) => {
        let type = 'file';

        function getPath() {
          let path = c.getElementsByTagNameNS(ns, 'href')[0].textContent;
          return path.substr(getURI(item).length - 1, path.length);
        }

        function getId() {
          let id = null;
          try {
            id = c.getElementsByTagNameNS(ns, 'getetag')[0].textContent;
          } catch ( e ) {
          }
          return id;
        }

        function getMime() {
          let mime = null;
          if ( type === 'file' ) {
            try {
              mime = c.getElementsByTagNameNS(ns, 'getcontenttype')[0].textContent || 'application/octet-stream';
            } catch ( e ) {
              mime = 'application/octet-stream';
            }
          }
          return mime;
        }

        function getSize() {
          let size = 0;
          if ( type === 'file' ) {
            try {
              size = parseInt(c.getElementsByTagNameNS(ns, 'getcontentlength')[0].textContent, 10) || 0;
            } catch ( e ) {
            }
          }
          return size;
        }

        try {
          let path = getPath();
          if ( path.match(/\/$/) ) {
            type = 'dir';
            path = path.replace(/\/$/, '') || '/';
          }

          if ( path !== reqpath ) {
            list.push({
              id: getId(),
              path: root + path.replace(/^\//, ''),
              filename: FS.filename(path),
              size: getSize(),
              mime: getMime(),
              type: type
            });
          }
        } catch ( e ) {
          console.warn('scandir() exception', e, e.stack);
        }
      });

      return list;
    }

    davCall('PROPFIND', {path: item.path}, (error, doc) => {
      const list = [];
      if ( !error && doc ) {
        const result = parse(doc);
        result.forEach((iter) => {
          list.push(new FileMetadata(iter));
        });
      }
      callback(error, list);
    });
  },

  write: function(item, data, callback, options) {
    davCall('PUT', {path: item.path, mime: item.mime, data: data}, callback);
  },

  read: function(item, callback, options) {
    davCall('GET', {path: item.path, mime: item.mime}, callback, true);
  },

  copy: function(src, dest, callback) {
    davCall('COPY', {path: src.path, dest: dest.path}, callback);
  },

  move: function(src, dest, callback) {
    davCall('MOVE', {path: src.path, dest: dest.path}, callback);
  },

  unlink: function(item, callback) {
    davCall('DELETE', {path: item.path}, callback);
  },

  mkdir: function(item, callback) {
    davCall('MKCOL', {path: item.path}, callback);
  },

  exists: function(item, callback) {
    davCall('PROPFIND', {path: item.path}, (error, doc) => {
      callback(false, !error);
    });
  },

  url: function(item, callback, options) {
    callback(false, OSjs.VFS.Transports.WebDAV.path(item));
  },

  freeSpace: function(root, callback) {
    callback(false, -1);
  }
};

/////////////////////////////////////////////////////////////////////////////
// WRAPPERS
/////////////////////////////////////////////////////////////////////////////

/**
 * Make a WebDAV HTTP URL for VFS
 *
 * @param   {(String|OSjs.VFS.File)}    item        VFS File
 *
 * @return  {String}                  URL based on input
 */
function makePath(item) {
  if ( typeof item === 'string' ) {
    item = new FileMetadata(item);
  }

  const url = getURL(item);
  const reqpath = resolvePath(item).replace(/^\//, '');

  let fullpath = url + reqpath;
  if ( !getCORSAllowed(item) ) {
    fullpath = getConfig('Connection.FSURI') + '/get/' + fullpath;
  }

  return fullpath;
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

export default {
  module: Transport,
  path: makePath
};
