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
const DOM = require('utils/dom.js');
const Utils = require('utils/misc.js');

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

/**
 * Common function for handling all types of XHR calls
 * including download/upload and JSONP
 *
 * @function ajax
 * @memberof OSjs.Utils
 *
 * @param   {Object}     args                        Aguments (see below)
 * @param   {String}     args.url                    The URL
 * @param   {String}     [args.method=GET]           HTTP Call method
 * @param   {Mixed}      [args.body]                 Body to send (for POST)
 * @param   {integer}    [args.timeout=0]            Timeout (in milliseconds)
 * @param   {String}     [args.responseType=null]    HTTP Response type
 * @param   {Object}     [args.requestHeaders=null]  Tuple with headers
 * @param   {Boolean}    [args.json=false]           Handle as a JSON request/response
 * @param   {Boolean}    [args.jsonp=false]          Handle as a JSONP request
 * @param   {Array}      [args.acceptcodes]          Array of accepted status codes for success signal [arraybuffer]
 * @param   {Function}   [args.onerror]              onerror callback => fn(error, evt, request, url)
 * @param   {Function}   [args.onsuccess]            onsuccess callback => fn(result, request, url)
 * @param   {Function}   [args.oncreated]            oncreated callback => fn(request)
 * @param   {Function}   [args.onfailed]             onfailed callback => fn(evt)
 * @param   {Function}   [args.oncanceled]           oncanceled callback => fn(evt)
 * @param   {Function}   [args.ontimeout]            ontimeout callback => fn(evt)
 *
 * @return {void}
 */
module.exports.ajax = function Utils_ajax(args) {
  /* eslint no-invalid-this: "off" */

  let request;
  args = Object.assign({}, {
    onerror: function() {},
    onsuccess: function() {},
    onprogress: function() {},
    oncreated: function() {},
    onfailed: function() {},
    oncanceled: function() {},
    ontimeout: function() {},
    acceptcodes: [200, 201, 304],
    method: 'GET',
    responseType: null,
    requestHeaders: {},
    body: null,
    timeout: 0,
    json: false,
    url: '',
    jsonp: false
  }, args);

  function onReadyStateChange() {
    let result;

    function _onError(error) {
      error = OSjs.API._('ERR_UTILS_XHR_FMT', error);
      console.warn('Utils::ajax()', 'onReadyStateChange()', error);
      args.onerror(error, result, this, args.url);
    }

    if ( this.readyState === 4 ) {
      result = this.responseText;
      try {
        const ctype = this.getResponseHeader('content-type') || '';
        if ( args.json && ctype.match(/^application\/json/) ) {
          result = JSON.parse(this.responseText);
        }
      } catch (ex) {
        _onError.call(this, ex.toString());
        return;
      }

      if ( this.status === 200 || this.status === 201 ) {
        args.onsuccess(result, this, args.url);
      } else {
        _onError.call(this, String(this.status));
      }
    }
  }

  function requestJSONP() {
    let loaded  = false;
    DOM.$createJS(args.url, () => {
      if ( (this.readyState === 'complete' || this.readyState === 'loaded') && !loaded) {
        loaded = true;
        args.onsuccess();
      }
    }, () => {
      if ( loaded ) {
        return;
      }
      loaded = true;
      args.onsuccess();
    }, () => {
      if ( loaded ) {
        return;
      }
      loaded = true;
      args.onerror();
    });
  }

  function cleanup() {
    if ( request.upload ) {
      request.upload.removeEventListener('progress', args.onprogress, false);
    } else {
      request.removeEventListener('progress', args.onprogress, false);
    }
    request.removeEventListener('error', args.onfailed, false);
    request.removeEventListener('abort', args.oncanceled, false);
    request.onerror = null;
    request.onload = null;
    request.onreadystatechange = null;
    request.ontimeut = null;
    request = null;
    args = null;
  }

  function requestJSON() {
    request = new XMLHttpRequest();
    try {
      request.timeout = args.timeout;
    } catch ( e ) {}

    if ( request.upload ) {
      request.upload.addEventListener('progress', args.onprogress, false);
    } else {
      request.addEventListener('progress', args.onprogress, false);
    }

    request.ontimeout = function XHR_timeout(evt) {
      args.ontimeout(evt);
    };

    if ( args.responseType === 'arraybuffer' ) { // Binary
      request.onerror = function XHR_onerror(evt) {
        const error = request.response || OSjs.API._('ERR_UTILS_XHR_FATAL');
        args.onerror(error, evt, request, args.url);

        cleanup();
      };
      request.onload = function XHR_onload(evt) {
        if ( args.acceptcodes.indexOf(request.status) >= 0 ) {
          args.onsuccess(request.response, request, args.url);
        } else {
          OSjs.VFS.Helpers.abToText(request.response, 'text/plain', (err, txt) => {
            const error = txt || err || OSjs.API._('ERR_UTILS_XHR_FATAL');
            args.onerror(error, evt, request, args.url);

            cleanup();
          });
          return;
        }

        cleanup();
      };
    } else {
      request.addEventListener('error', args.onfailed, false);
      request.addEventListener('abort', args.oncanceled, false);
      request.onreadystatechange = onReadyStateChange;
    }

    request.open(args.method, args.url, true);

    Object.keys(args.requestHeaders).forEach((h) => {
      request.setRequestHeader(h, args.requestHeaders[h]);
    });

    request.responseType = args.responseType || '';

    args.oncreated(request);
    request.send(args.body);
  }

  if ( (OSjs.API.getConfig('Connection.Type') === 'standalone') ) {
    args.onerror('You are currently running locally and cannot perform this operation!', null, request, args.url);
    return false;
  }

  if ( args.json && (typeof args.body !== 'string') && !(args.body instanceof FormData) ) {
    args.body = JSON.stringify(args.body);
    if ( typeof args.requestHeaders['Content-Type'] === 'undefined' ) {
      args.requestHeaders['Content-Type'] = 'application/json';
    }
  }

  console.debug('Utils::ajax()', args);

  return args.jsonp ? requestJSONP() : requestJSON();
};

/**
 * Preload a list of resources
 *
 * @example
 * [
 *  {
 *
 *    "type": "javascript" // or "stylesheet",
 *    "src": "url/uri",
 *    "force": true // force to load even (reload)
 *  },
 *  "mycoolscript.js",
 *  "mycoolstyle.css"
 * ]
 *
 * @function preload
 * @memberof OSjs.Utils
 *
 * @param   {Array}     list                The list of resources
 * @param   {Function}  ondone              Callback when done => fn(totalCount, failedArray, successArray)
 * @param   {Function}  onprogress          Callback on progress => fn(current, total, src, succeeded, failed, progress)
 * @param   {Object}    [args]              Set of options
 * @param   {Boolean}   [args.force=false]  Force reloading of file if it was already added
 */
let _LOADED = {};
let _CACHE = {};

module.exports.preload = (function() {
  function checkCache(item, args) {
    if ( item && _LOADED[item.src] === true ) {
      if ( item.force !== true && args.force !== true ) {
        return true;
      }
    }
    return false;
  }

  const preloadTypes = {
    //
    // CSS
    //
    stylesheet: function createStylesheet(item, cb) {
      let src = item.src;
      let loaded = false;
      let timeout;

      function _done(res) {
        timeout = clearTimeout(timeout);
        if ( !loaded ) {
          _LOADED[src] = true;
          loaded = true;
          cb(res, src);
        }
      }

      function _check(path) {
        let result = false;
        (document.styleSheet || []).forEach((iter, i) => {
          if ( iter.href.indexOf(path) !== -1 ) {
            result = true;
            return false;
          }
          return true;
        });
        return result;
      }

      DOM.$createCSS(src, () => {
        _done(true);
      }, () => {
        _done(false);
      });

      // This probably always fires. The official docs on this is a bit vague
      if ( typeof document.styleSheet === 'undefined' || (!loaded && _check(src)) ) {
        _done(true);
        return;
      }

      // Fall back to a timeout, just in case
      timeout = setTimeout(() => {
        _done(false);
      }, 30000);
    },

    //
    // JS
    //
    javascript: function createScript(item, cb) {
      const src = item.src;

      let loaded = false;

      function _done(res) {
        if ( !loaded ) {
          _LOADED[src] = true;
          loaded = true;
          cb(res, src);
        }
      }

      DOM.$createJS(src, () => {
        if ( (this.readyState === 'complete' || this.readyState === 'loaded') ) {
          _done(true);
        }
      }, () => {
        _done(true);
      }, () => {
        _done(false);
      }, {async: false});
    },

    //
    // Scheme
    //
    scheme: function createHTML(item, cb, args) {
      let scheme;

      function _cache(err, html) {
        if ( !err && html ) {
          _CACHE[item.src] = html;
        }
      }

      function _cb() {
        scheme = null;
        cb.apply(null, arguments);
      }

      if ( _CACHE[item.src] && item.force !== true && args.force !== true  ) {
        scheme = new OSjs.GUI.Scheme();
        scheme.loadString(_CACHE[item.src]);
        _cb(true, item.src, scheme);
      } else {
        if ( OSjs.API.isStandalone() ) {
          scheme = new OSjs.GUI.Scheme();

          preloadTypes.javascript({
            src: FS.pathJoin(FS.dirname(item.src), '_scheme.js'),
            type: 'javascript'
          }, () => {
            const look = item.src.replace(OSjs.API.getBrowserPath(), '/').replace(/^\/?packages/, '');
            const html = OSjs.STANDALONE.SCHEMES[look];
            scheme.loadString(html);
            _cache(false, html);
            _cb(true, item.src, scheme);
          });
        } else {
          scheme = new OSjs.GUI.Scheme(item.src);
          scheme.load((err, res) => {
            _cb(err ? false : true, item.src, scheme);
          }, (err, html) => {
            _cache(err, html);
          });
        }
      }

    }
  };

  function getType(src) {
    if ( src.match(/\.js$/i) ) {
      return 'javascript';
    } else if ( src.match(/\.css$/i) ) {
      return 'stylesheet';
    }/* else if ( src.match(/\.html?$/i) ) {
      return 'html';
    }*/
    return 'unknown';
  }

  function getTypeCorrected(t) {
    const typemap = {
      script: 'javascript',
      js: 'javascript',
      style: 'stylesheet',
      css: 'stylesheet'
    };
    return typemap[t] || t;
  }

  function preloadList(list, ondone, onprogress, args) {
    args = args || {};
    ondone = ondone || function() {};
    onprogress = onprogress || function() {};

    let succeeded  = [];
    let failed = [];
    let len = list.length;
    let total = 0;

    list = (list || []).map((item) => {
      if ( typeof item === 'string' ) {
        item = {src: item};
      }

      let src = item.src;
      if ( !src.match(/^(\/|file|https?)/) ) {
        src = OSjs.API.getBrowserPath(item.src);
      }
      item._src = src;
      item.src = src;
      item.type = item.type ? getTypeCorrected(item.type) : getType(item.src);

      return item;
    });

    console.group('Utils::preload()', len);

    let data = [];
    Utils.asyncp(list, {max: args.max || 1}, function asyncIter(item, index, next) {
      function _onentryloaded(state, src, setData) {
        total++;
        (state ? succeeded : failed).push(src);
        onprogress(index, len, src, succeeded, failed, total);

        if ( setData ) {
          data.push({
            item: item,
            data: setData
          });
        }

        next();
      }

      if ( item ) {
        console.debug('->', item);

        if ( checkCache(item, args) ) {
          return _onentryloaded(true, item.src);
        } else {
          if ( preloadTypes[item.type] ) {
            return preloadTypes[item.type](item, _onentryloaded, args);
          }
        }

        failed.push(item.src);
      }
      return next();
    }, function asyncDone() {
      console.groupEnd();

      ondone(len, failed, succeeded, data);
    });
  }

  return preloadList;
})();

module.exports._clearPreloadCache = function() {
  _LOADED = {};
  _CACHE = {};
};

