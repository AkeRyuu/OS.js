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
const XHR = require('utils/xhr.js');
const MountManager = require('core/mount-manager.js');

/**
 * @namespace Web
 * @memberof OSjs.VFS.Transports
 */

/*
 * THIS IS AN EXPERIMENTAL WEB TRANSPORT MODULE FOR OS.js VFS
 *
 * IT IS READ-ONLY!
 *
 * To make this work you *will need* CORS support!
 *
 * scandir() works by loading a file named `_scandir.json` in the
 * requested folder.
 *
 * Example _scandir.json file in doc/vfs/web/_scandir.json
 */

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

/**
 * Make a Web HTTP URL for VFS
 *
 * @param   {(String|OSjs.VFS.File)}    file        VFS File
 *
 * @return  {String}                  URL based on input
 *
 * @function path
 * @memberof OSjs.VFS.Transports.Web
 */
function makePath(file) {
  const rel = MountManager.getPathProtocol(file.path);
  const module = MountManager.getModuleFromPath(file.path, false, true);
  const base = (module.options || {}).url;
  return base + rel.replace(/^\/+/, '/');
}

/*
 * Wrapper for making a request
 */
function httpCall(func, item, callback) {
  let url = makePath(item);

  if ( func === 'scandir' ) {
    url += '/_scandir.json';
  }

  const args = {
    method: func === 'exists' ? 'HEAD' : 'GET',
    url: url,
    onerror: (error) => {
      callback(error);
    },
    onsuccess: (response) => {
      callback(false, response);
    }
  };

  if ( func === 'read' ) {
    args.responseType = 'arraybuffer';
  }

  XHR.ajax(args);
}

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

/**
 * Web/HTTP VFS Transport Module
 *
 * @api OSjs.VFS.Transports.Web
 */
const Transport = {
  scandir: function(item, callback, options) {
    const root = MountManager.getRootFromPath(item.path);

    httpCall('scandir', item, (error, response) => {
      let list = null;
      if ( !error ) {
        let json = null;
        try {
          json = JSON.parse(response);
        } catch ( e ) {}

        if ( json === null ) {
          error = 'Failed to parse directory JSON';
        } else {
          list = json.map((iter) => {
            iter.path = root + iter.path.replace(/^\//, '');
            return iter;
          });

          const rel = FS.getPathProtocol(item.path);
          if ( rel !== '/' ) {
            list.unshift({
              filename: '..',
              path: FS.dirname(item.path),
              type: 'dir',
              size: 0
            });
          }
        }
      }
      callback(error, list);
    });
  },

  read: function(item, callback, options) {
    options = options || {};

    const mime = item.mime || 'application/octet-stream';

    httpCall('read', item, (error, response) => {
      if ( !error ) {
        if ( options.type === 'text' ) {
          FS.abToText(response, mime, (error, text) => {
            callback(error, text);
          });
          return;
        }
      }
      callback(error, response);
    });
  },

  exists: function(item, callback) {
    httpCall('exists', item, (err) => {
      callback(err, err ? false : true);
    });
  },

  url: function(item, callback, options) {
    callback(false, makePath(item));
  }
};

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = {
  defaults: (iter) => {
    iter.readOnly = true;
    iter.match = /^https?\:\/\//;
  },
  module: Transport,
  path: makePath
};
