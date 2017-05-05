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

/////////////////////////////////////////////////////////////////////////////
// FS
/////////////////////////////////////////////////////////////////////////////

/**
 * Gets the path from a location
 *
 * @function getPathFromVirtual
 * @memberof OSjs.Utils
 *
 * @param   {String}    str         Path name
 *
 * @return  {String}
 */
module.exports.getPathFromVirtual = function Utils_getPathFromVirtual(str) {
  str = str || '';
  const res = str.split(/([A-z0-9\-_]+)\:\/\/(.*)/)[2] || '';
  return res.replace(/^\/?/, '/');
};

/**
 * Gets the protocol from a location
 *
 * @function getPathProtocol
 * @memberof OSjs.Utils
 *
 * @param   {String}    orig        Path name
 *
 * @return  {String}
 */
module.exports.getPathProtocol = function Utils_getPathProtocol(orig) {
  //return orig.replace(/^([A-z0-9\-_]+)\:\/\//, '');
  const tmp = document.createElement('a');
  tmp.href = orig;
  return tmp.protocol.replace(/:$/, '');
};

/**
 * Get file extension of filename/path
 *
 * @function filext
 * @memberof OSjs.Utils
 *
 * @param   {String}    d       filename/path
 *
 * @return  {String}            The file extension
 */
module.exports.filext = function Utils_filext(d) {
  const ext = module.exports.filename(d).split('.').pop();
  return ext ? ext.toLowerCase() : null;
};

/**
 * Get directory from path
 *
 * If you use this on a directory path, you will
 * get the parent
 *
 * @function dirname
 * @memberof OSjs.Utils
 *
 * @param   {String}    f       filename/path
 *
 * @return  {String}            The resulted path
 */
module.exports.dirname = function Utils_dirname(f) {

  function _parentDir(p) {
    const pstr = p.split(/^(.*)\:\/\/(.*)/).filter(function(n) {
      return n !== '';
    });

    const args   = pstr.pop();
    const prot   = pstr.pop();
    let result = '';

    const tmp = args.split('/').filter(function(n) {
      return n !== '';
    });

    if ( tmp.length ) {
      tmp.pop();
    }
    result = tmp.join('/');

    if ( !result.match(/^\//) ) {
      result = '/' + result;
    }

    if ( prot ) {
      result = prot + '://' + result;
    }

    return result;
  }

  return f.match(/^((.*)\:\/\/)?\/$/) ? f : _parentDir(f.replace(/\/$/, ''));
};

/**
 * Get filename from path
 *
 * @function filename
 * @memberof OSjs.Utils
 *
 * @param   {String}    p     Path
 *
 * @return  {String}          The filename
 */
module.exports.filename = function Utils_filename(p) {
  return (p || '').replace(/\/$/, '').split('/').pop();
};

/**
 * Get human-readable size from integer
 *
 * Example return: '128 MB'
 *
 * @function humanFileSize
 * @memberof OSjs.Utils
 * @link http://stackoverflow.com/users/65387/mark
 *
 * @param   {Number}  bytes     Size in bytes
 * @param   {String}  si        Use SI units ?
 *
 * @return  {String}            Size
 */
module.exports.humanFileSize = function Utils_humanFileSize(bytes, si) {
  const units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  const thresh = si ? 1000 : 1024;

  if (bytes < thresh) {
    return bytes + ' B';
  }

  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (bytes >= thresh);
  return bytes.toFixed(1) + ' ' + units[u];
};

/**
 * Escape filename (removes invalid characters)
 *
 * @function escapeFilename
 * @memberof OSjs.Utils
 *
 * @param   {String}    n     Filename
 *
 * @return  {String}          Escaped filename
 */
module.exports.escapeFilename = function Utils_escapeFilename(n) {
  return (n || '').replace(/[\|&;\$%@"<>\(\)\+,\*\/]/g, '').trim();
};

/**
 * Replace file extension of filename
 *
 * @function replaceFileExtension
 * @memberof OSjs.Utils
 *
 * @param   {String}    filename      The filename
 * @param   {String}    rep           New file extension (without dot)
 *
 * @return  {String}                  New filename
 */
module.exports.replaceFileExtension = function Utils_replaceFileExtension(filename, rep) {
  const spl = filename.split('.');
  spl.pop();
  spl.push(rep);
  return spl.join('.');
};

/**
 * Replace the filename of a path
 *
 * @function replaceFilename
 * @memberof OSjs.Utils
 *
 * @param   {String}    orig      The full path to file
 * @param   {String}    newname   Replace with this filename
 *
 * @return  {String}              The new path
 */
module.exports.replaceFilename = function Utils_replaceFilename(orig, newname) {
  const spl = orig.split('/');
  spl.pop();
  spl.push(newname);
  return spl.join('/');
};

/**
 * Joins arguments to a path (path.join)
 *
 * @function pathJoin
 * @memberof OSjs.Utils
 *
 * @param   {...String}   s   Input
 * @return  {String}
 */
module.exports.pathJoin = function Utils_pathJoin() {
  let parts = [];
  let prefix = '';

  function getPart(s) {
    if ( s.match(/^([A-z0-9\-_]+)\:\//) ) {
      const spl = s.split(':/');
      if ( !prefix ) {
        prefix = spl[0] + '://';
      }
      s = spl[1] || '';
    }

    s = s.replace(/^\/+/, '').replace(/\/+$/, '');

    return s.split('/').filter(function(i) {
      return ['', '.', '..'].indexOf(i) === -1;
    }).join('/');
  }

  for ( let i = 0; i < arguments.length; i++ ) {
    const str = getPart(String(arguments[i]));
    if ( str ) {
      parts.push(str);
    }
  }

  return prefix + parts.join('/').replace(/^\/?/, '/');
};

/**
 * Gets the range of filename in a path (without extension)
 *
 * This is used for example in text boxes to highlight the filename
 *
 * @function getFilenameRange
 * @memberof OSjs.Utils
 *
 * @param   {String}    val     The path
 *
 * @return  {Object}            Range in form of min/max
 */
module.exports.getFilenameRange = function Utils_getFileNameRange(val) {
  val = val || '';

  const range = {min: 0, max: val.length};
  if ( val.match(/^\./) ) {
    if ( val.length >= 2 ) {
      range.min = 1;
    }
  } else {
    if ( val.match(/\.(\w+)$/) ) {
      const m = val.split(/\.(\w+)$/);
      for ( let i = m.length - 1; i >= 0; i-- ) {
        if ( m[i].length ) {
          range.max = val.length - m[i].length - 1;
          break;
        }
      }
    }
  }
  return range;
};

/**
 * (Encode) Convert URL-safe String to Base64
 *
 * @function btoaUrlsafe
 * @memberof OSjs.Utils
 *
 * @param   {String}      str     String
 *
 * @return  {String}              Base64 String
 */
module.exports.btoaUrlsafe = function Utils_btoaUrlsafe(str) {
  return (!str || !str.length) ? '' : btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * (Decode) Convert Base64 to URL-safe String
 *
 * @function atobUrlsafe
 * @memberof OSjs.Utils
 *
 * @param   {String}      str     Base64 String
 *
 * @return  {String}              String
 */
module.exports.atobUrlsafe = function Utils_atobUrlsafe(str) {
  if ( str && str.length ) {
    str = (str + '===').slice(0, str.length + (str.length % 4));
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }
  return '';
};

/**
 * (Encode) Convert String to Base64 with UTF-8
 *
 * @function btoaUtf
 * @memberof OSjs.Utils
 *
 * @param   {String}      str     String
 *
 * @return  {String}              Base64 String
 */
module.exports.btoaUtf = function Utils_btoaUtfh(str) { // Encode
  const _unescape = window.unescape || function(s) {
    function d(x, n) {
      return String.fromCharCode(parseInt(n, 16));
    }
    return s.replace(/%([0-9A-F]{2})/i, d);
  };
  str = _unescape(encodeURIComponent(str));
  return btoa(str);
};

/**
 * (Decode) Convert Base64 with UTF-8 to String
 *
 * @function atobUtf
 * @memberof OSjs.Utils
 *
 * @param   {String}      str     Base64 String
 *
 * @return  {String}              String
 */
module.exports.atobUtf = function Utils_atobUtf(str) { // Decode
  const _escape = window.escape || function(s) {
    function q(c) {
      c = c.charCodeAt();
      return '%' + (c < 16 ? '0' : '') + c.toString(16).toUpperCase();
    }
    return s.replace(/[\x00-),:-?[-^`{-\xFF]/g, q);
  };

  const trans = _escape(atob(str));
  return decodeURIComponent(trans);
};

/**
 * Check if this MIME type is inside list
 * This matches by regex
 *
 * @function checkAcceptMime
 * @memberof OSjs.Utils
 *
 * @param   {String}      mime      The mime string
 * @param   {Array}       list      Array of regex matches
 *
 * @return  {Boolean}               If found
 */
module.exports.checkAcceptMime = function Utils_checkAcceptMime(mime, list) {
  if ( mime && list.length ) {
    let re;
    for ( let i = 0; i < list.length; i++ ) {
      re = new RegExp(list[i]);
      if ( re.test(mime) === true ) {
        return true;
      }
    }
  }
  return false;
};

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

/**
 * Filters a scandir() request
 *
 * @function filterScandir
 * @memberof OSjs.VFS.Helpers
 *
 * @param     {Array}     list                      List of results from scandir()
 * @param     {Object}    options                   Filter options
 * @param     {String}    options.typeFilter        `type` filter
 * @param     {Array}     options.mimeFilter        `mime` filter
 * @param     {Boolean}   options.showHiddenFiles   Show dotfiles
 * @param     {String}    [options.sortBy=null]     Sort by this key
 * @param     {String}    [options.sortDir='asc']   Sort in this direction
 *
 * @return  {Boolean}
 */
module.exports.filterScandir = function filterScandir(list, options) {
  const Utils = require('utils/misc.js');
  const SettingsManager = require('core/settings-manager.js');

  const defaultOptions = Utils.cloneObject(SettingsManager.get('VFS') || {});
  const ioptions = Utils.cloneObject(options, true);

  let ooptions = Object.assign({}, defaultOptions.scandir || {}, ioptions);
  ooptions = Object.assign({}, {
    sortBy: null,
    sortDir: 'asc',
    typeFilter: null,
    mimeFilter: [],
    showHiddenFiles: true
  }, ooptions);

  function filterFile(iter) {
    if ( (ooptions.typeFilter && iter.type !== ooptions.typeFilter) || (!ooptions.showHiddenFiles && iter.filename.match(/^\.\w/)) ) {
      return false;
    }
    return true;
  }

  function validMime(iter) {
    if ( ooptions.mimeFilter && ooptions.mimeFilter.length && iter.mime ) {
      return ooptions.mimeFilter.some(function(miter) {
        if ( iter.mime.match(miter) ) {
          return true;
        }
        return false;
      });
    }
    return true;
  }

  const result = list.filter(function(iter) {
    if ( iter.filename === '..' || !filterFile(iter) ) {
      return false;
    }

    if ( iter.type === 'file' && !validMime(iter) ) {
      return false;
    }

    return true;
  }).map(function(iter) {
    if ( iter.mime === 'application/vnd.google-apps.folder' ) {
      iter.type = 'dir';
    }
    return iter;
  });

  const sb = ooptions.sortBy;
  const types = {
    mtime: 'date',
    ctime: 'date'
  };

  if ( ['filename', 'size', 'mime', 'ctime', 'mtime'].indexOf(sb) !== -1  ) {
    if ( types[sb] === 'date' ) {
      result.sort(function(a, b) {
        a = new Date(a[sb]);
        b = new Date(b[sb]);
        return (a > b) ? 1 : ((b > a) ? -1 : 0);
      });
    } else {
      if ( sb === 'size' || !String.prototype.localeCompare ) {
        result.sort(function(a, b) {
          return (a[sb] > b[sb]) ? 1 : ((b[sb] > a[sb]) ? -1 : 0);
        });
      } else {
        result.sort(function(a, b) {
          return String(a[sb]).localeCompare(String(b[sb]));
        });
      }
    }

    if ( ooptions.sortDir === 'desc' ) {
      result.reverse();
    }
  }

  return result.filter(function(iter) {
    return iter.type === 'dir';
  }).concat(result.filter(function(iter) {
    return iter.type !== 'dir';
  }));
};

/*
 * Wrapper for converting data
 */
function _abToSomething(m, arrayBuffer, mime, callback) {
  mime = mime || 'application/octet-stream';

  try {
    const blob = new Blob([arrayBuffer], {type: mime});
    const r = new FileReader();
    r.onerror = function(e) {
      callback(e);
    };
    r.onloadend = function()  {
      callback(false, r.result);
    };
    r[m](blob);
  } catch ( e ) {
    console.warn(e, e.stack);
    callback(e);
  }
}

/////////////////////////////////////////////////////////////////////////////
// CONVERSION HELPERS
/////////////////////////////////////////////////////////////////////////////

/**
 * This is a helper to add a File to FormData
 *
 * @function addFormFile
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {FormData}                        fd      FormData instance
 * @param   {String}                          key     FormData entry name
 * @param   {(window.File|window.Blob)}       data    File Data (see supported types)
 * @param   {OSjs.VFS.File}                   file    File Metadata
 */
module.exports.addFormFile = function addFormFile(fd, key, data, file) {
  file = file || {mime: 'application/octet-stream', filename: 'filename'};

  if ( data instanceof window.File ) {
    fd.append(key, data);
  } else if ( data instanceof window.ArrayBuffer ) {
    try {
      data = new Blob([data], {type: file.mime});
    } catch ( e ) {
      data = null;
      console.warn(e, e.stack);
    }

    fd.append(key, data, file.filename);
  } else {
    if ( data.data && data.filename ) { // In case user defines custom
      fd.append(key, data.data, data.filename);
    }
  }
};

/**
 * Convert DataSourceURL to ArrayBuffer
 *
 * @function dataSourceToAb
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {String}        data        The datasource string
 * @param   {String}        mime        The mime type
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.dataSourceToAb = function dataSourceToAb(data, mime, callback) {
  const byteString = atob(data.split(',')[1]);
  //const mimeString = data.split(',')[0].split(':')[1].split(';')[0];

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  callback(false, ab);
};

/**
 * Convert PlainText to ArrayBuffer
 *
 * @function textToAb
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {String}        data        The plaintext string
 * @param   {String}        mime        The mime type
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.textToAb = function textToAb(data, mime, callback) {
  _abToSomething('readAsArrayBuffer', data, mime, callback);
};

/**
 * Convert ArrayBuffer to DataSourceURL
 *
 * @function abToDataSource
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {ArrayBuffer}   arrayBuffer The ArrayBuffer
 * @param   {String}        mime        The mime type
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.abToDataSource = function abToDataSource(arrayBuffer, mime, callback) {
  _abToSomething('readAsDataURL', arrayBuffer, mime, callback);
};

/**
 * Convert ArrayBuffer to PlainText
 *
 * @function abToText
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {ArrayBuffer}   arrayBuffer The ArrayBuffer
 * @param   {String}        mime        The mime type
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.abToText = function abToText(arrayBuffer, mime, callback) {
  _abToSomething('readAsText', arrayBuffer, mime, callback);
};

/**
 * Convert ArrayBuffer to BinaryString
 *
 * @function abToBinaryString
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {ArrayBuffer}   arrayBuffer The ArrayBuffer
 * @param   {String}        mime        The mime type
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.abToBinaryString = function abToBinaryString(arrayBuffer, mime, callback) {
  _abToSomething('readAsBinaryString', arrayBuffer, mime, callback);
};

/**
 * Convert ArrayBuffer to Blob
 *
 * @function abToBlob
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {ArrayBuffer}   arrayBuffer The ArrayBuffer
 * @param   {String}        mime        The mime type
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.abToBlob = function abToBlob(arrayBuffer, mime, callback) {
  mime = mime || 'application/octet-stream';

  try {
    const blob = new Blob([arrayBuffer], {type: mime});
    callback(false, blob);
  } catch ( e ) {
    console.warn(e, e.stack);
    callback(e);
  }
};

/**
 * Convert Blob to ArrayBuffer
 *
 * @function blobToAb
 * @memberof OSjs.VFS.Helpers
 *
 * @param   {Blob}          data        The blob
 * @param   {Function}      callback    Callback function => fn(error, result)
 */
module.exports.blobToAb = function blobToAb(data, callback) {
  try {
    const r = new FileReader();
    r.onerror = function(e) {
      callback(e);
    };
    r.onloadend = function() {
      callback(false, r.result);
    };
    r.readAsArrayBuffer(data);
  } catch ( e ) {
    console.warn(e, e.stack);
    callback(e);
  }
};
