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

/**
 * @module core/connection
 */

const API = require('core/api.js');
const XHR = require('utils/xhr.js');
const Events = require('utils/events.js');

let _CALL_INDEX = 1;

/*
 * Attaches options to a XHR call
 */
function appendRequestOptions(data, options) {
  options = options || {};

  const onprogress = options.onprogress || function() {};
  const ignore = ['onsuccess', 'onerror', 'onprogress', 'oncanceled'];

  Object.keys(options).forEach((key) => {
    if ( ignore.indexOf(key) === -1 ) {
      data[key] = options[key];
    }
  });

  data.onprogress = function XHR_onprogress(ev) {
    if ( ev.lengthComputable ) {
      onprogress(ev, ev.loaded / ev.total);
    } else {
      onprogress(ev, -1);
    }
  };

  return data;
}

let _instance;

/**
 * Default Connection Implementation
 *
 * @summary Wrappers for communicating over HTTP, WS and NW
 *
 * @constructor Connection
 * @mixes utils/event-handler~EventHandler
 */
class Connection {

  static get instance() {
    return _instance;
  }

  /**
   * Create a new Connection
   */
  constructor() {
    /* eslint consistent-this: "warn" */
    _instance = this;

    /**
     * If browser is offline
     * @type {Boolean}
     */
    this.offline    = false;

    this.index = 0;
    this._evHandler = new OSjs.Helpers.EventHandler(name, []);
  }

  /**
   * Initializes the instance
   *
   * @param {Function}  callback    Callback function
   */
  init(callback) {
    if ( typeof navigator.onLine !== 'undefined' ) {
      Events.$bind(window, 'offline', (ev) => {
        this.onOffline();
      });
      Events.$bind(window, 'online', (ev) => {
        this.onOnline();
      });
    }

    callback();
  }

  /**
   * Destroys the instance
   */
  destroy() {
    Events.$unbind(window, 'offline');
    Events.$unbind(window, 'online');

    if ( this._evHandler ) {
      this._evHandler = this._evHandler.destroy();
    }

    _instance = null;
  }

  /**
   * Default method to perform a resolve on a VFS File object.
   *
   * This should return the URL for given resource.
   *
   * @param   {OSjs.VFS.File}       item      The File Object
   * @param   {Object}              [options] Options. These are added to the URL
   *
   * @return  {String}
   */
  getVFSPath(item, options) {
    options = options || {};

    const base = API.getConfig('Connection.RootURI', '/');
    if ( window.location.protocol === 'file:' ) {
      return base + item.path.replace(/^osjs:\/\/\//, '');
    }

    let url = API.getConfig('Connection.FSURI', '/');
    if ( item ) {
      url += '/read';
      options.path = item.path;
    } else {
      url += '/upload';
    }

    if ( options ) {
      const q = Object.keys(options).map((k) => {
        return k + '=' + encodeURIComponent(options[k]);
      });

      if ( q.length ) {
        url += '?' + q.join('&');
      }
    }

    return url;
  }

  /**
   * Get if connection is Online
   *
   * @return {Boolean}
   */
  isOnline() {
    return !this.offline;
  }

  /**
   * Get if connection is Offline
   *
   * @return {Boolean}
   */
  isOffline() {
    return this.offline;
  }

  /**
   * Called upon a VFS request
   *
   * You can use this to interrupt/hijack operations.
   *
   * It is what gets called 'before' a VFS request takes place
   *
   * @param   {String}    vfsModule     VFS Module Name
   * @param   {String}    vfsMethod     VFS Method Name
   * @param   {Object}    vfsArguments  VFS Method Arguments
   * @param   {Function}  callback      Callback function
   */
  onVFSRequest(vfsModule, vfsMethod, vfsArguments, callback) {
    // If you want to interrupt/hijack or modify somehow, just send the two arguments to the
    // callback: (error, result)
    callback(/* continue normal behaviour */);
  }

  /**
   * Called upon a VFS request completion
   *
   * It is what gets called 'after' a VFS request has taken place
   *
   * @param   {String}    vfsModule     VFS Module Name
   * @param   {String}    vfsMethod     VFS Method Name
   * @param   {Object}    vfsArguments  VFS Method Arguments
   * @param   {String}    vfsError      VFS Response Error
   * @param   {Mixed}     vfsResult     VFS Response Result
   * @param   {Function}  callback      Callback function
   */
  onVFSRequestCompleted(vfsModule, vfsMethod, vfsArguments, vfsError, vfsResult, callback) {
    // If you want to interrupt/hijack or modify somehow, just send the two arguments to the
    // callback: (error, result)
    callback(/* continue normal behaviour */);
  }

  /**
   * When browser goes online
   */
  onOnline() {
    console.warn('Connection::onOnline()', 'Going online...');
    this.offline = false;

    const wm = require('core/windowmanager.js').instance;
    if ( wm ) {
      wm.notification({title: API._('LBL_INFO'), message: API._('CONNECTION_RESTORED')});
    }

    if ( this._evHandler ) {
      this._evHandler.emit('online');
    }
  }

  /**
   * When browser goes offline
   *
   * @param {Number} reconnecting Amount retries for connection
   */
  onOffline(reconnecting) {
    console.warn('Connection::onOffline()', 'Going offline...');

    if ( !this.offline && this._evHandler ) {
      this._evHandler.emit('offline');
    }

    this.offline = true;

    const wm = require('core/windowmanager.js').instance;
    if ( wm ) {
      wm.notification({title: API._('LBL_WARNING'), message: API._(reconnecting ? 'CONNECTION_RESTORE_FAILED' : 'CONNECTION_LOST')});
    }
  }

  /**
   * Default method to perform a call to the backend (API)
   *
   * Please note that this function is internal, and if you want to make
   * a actual API call, use "API.call()" instead.
   *
   * @param {String}    method      API method name
   * @param {Object}    args        API method arguments
   * @param {Function}  cbSuccess   On success
   * @param {Function}  cbError     On error
   * @param {Object}    [options]   Options passed on to the connection request method (ex: XHR.ajax)
   *
   * @return {Boolean}
   *
   * @see OSjs.Core.API.call
   */
  createRequest(method, args, cbSuccess, cbError, options) {
    args = args || {};
    cbSuccess = cbSuccess || function() {};
    cbError = cbError || function() {};

    if ( this.offline ) {
      cbError('You are currently off-line and cannot perform this operation!');
      return false;
    } else if ( (API.getConfig('Connection.Type') === 'standalone') ) {
      cbError('You are currently running locally and cannot perform this operation!');
      return false;
    }

    if ( method.match(/^FS:/) ) {
      return this.requestVFS(method.replace(/^FS:/, ''), args, options, cbSuccess, cbError);
    }

    return this.requestAPI(method, args, options, cbSuccess, cbError);
  }

  /**
   * Wrapper for server API XHR calls
   *
   * @param   {String}    method    API Method name
   * @param   {Object}    args      API Method arguments
   * @param   {Object}    options   Call options
   * @param   {Function}  cbSuccess Callback on success
   * @param   {Function}  cbError   Callback on error
   *
   * @return {Boolean}
   *
   * @see OSjs.Core.Connection.request
   */
  requestAPI(method, args, options, cbSuccess, cbError) {
    return false;
  }

  /**
   * Wrapper for server VFS XHR calls
   *
   * @param   {String}    method    API Method name
   * @param   {Object}    args      API Method arguments
   * @param   {Object}    options   Call options
   * @param   {Function}  cbSuccess Callback on success
   * @param   {Function}  cbError   Callback on error
   *
   * @return {Boolean}
   *
   * @see OSjs.Core.Connection.request
   */
  requestVFS(method, args, options, cbSuccess, cbError) {
    if ( method === 'get' ) {
      return this._requestGET(args, options, cbSuccess, cbError);
    } else if ( method === 'upload' ) {
      return this._requestPOST(args, options, cbSuccess, cbError);
    }

    return false;
  }

  /**
   * Makes a HTTP POST call
   *
   * @param   {Object}    form      Call data
   * @param   {Object}    options   Call options
   * @param   {Function}  onsuccess Callback on success
   * @param   {Function}  onerror   Callback on error
   *
   * @return {Boolean}
   */
  _requestPOST(form, options, onsuccess, onerror) {
    onerror = onerror || function() {
      console.warn('Connection::_requestPOST()', 'error', arguments);
    };

    XHR.ajax(appendRequestOptions({
      url: OSjs.VFS.Transports.OSjs.path(),
      method: 'POST',
      body: form,
      onsuccess: function Connection_POST_success(result) {
        onsuccess(false, result);
      },
      onerror: function Connection_POST_error(result) {
        onerror('error', null, result);
      },
      oncanceled: function Connection_POST_cancel(evt) {
        onerror('canceled', null, evt);
      }
    }, options));

    return true;
  }

  /**
   * Makes a HTTP GET call
   *
   * @param   {Object}    args      Call data
   * @param   {Object}    options   Call options
   * @param   {Function}  onsuccess Callback on success
   * @param   {Function}  onerror   Callback on error
   *
   * @return {Boolean}
   */
  _requestGET(args, options, onsuccess, onerror) {
    onerror = (onerror || function() {
      console.warn('Connection::_requestGET()', 'error', arguments);
    }).bind(this);

    XHR.ajax(appendRequestOptions({
      url: args.url || OSjs.VFS.Transports.OSjs.path(args.path),
      method: args.method || 'GET',
      responseType: 'arraybuffer',
      onsuccess: (response, xhr) => {
        if ( !xhr || xhr.status === 404 || xhr.status === 500 ) {
          onsuccess({error: xhr.statusText || response, result: null});
          return;
        }
        onsuccess.bind(this)({error: false, result: response});
      },
      onerror: onerror
    }, options));

    return true;
  }

  /**
   * Makes a HTTP XHR call
   *
   * @param   {String}    url       Call URL
   * @param   {Object}    args      Call data
   * @param   {Object}    options   Call options
   * @param   {Function}  onsuccess Callback on success
   * @param   {Function}  onerror   Callback on error
   *
   * @return {Boolean}
   */
  _requestXHR(url, args, options, onsuccess, onerror) {
    onerror = onerror || function() {
      console.warn('Connection::_requestXHR()', 'error', arguments);
    };

    XHR.ajax(appendRequestOptions({
      url: url,
      method: 'POST',
      json: true,
      body: args,
      onsuccess: onsuccess.bind(this),
      onerror: onerror.bind(this)
    }, options));

    return true;
  }

  /**
   * Subscribe to a event
   *
   * NOTE: This is only available on WebSocket connections
   *
   * @param   {String}    k       Event name
   * @param   {Function}  func    Callback function
   *
   * @return  {Number}
   *
   * @see OSjs.Helpers.EventHandler#on
   */
  subscribe(k, func) {
    return this._evHandler.on(k, func, this);
  }

  /**
   * Removes an event subscription
   *
   * @param   {String}    k       Event name
   * @param   {Number}    [idx]   The hook index returned from subscribe()
   *
   * @return {Boolean}
   *
   * @see OSjs.Helpers.EventHandler#off
   */
  unsubscribe(k, idx) {
    return this._evHandler.off(k, idx);
  }

  static request(m, a, cb, options) {
    a = a || {};
    options = options || {};

    const lname = 'APICall_' + _CALL_INDEX;

    if ( typeof cb !== 'function' ) {
      throw new TypeError('call() expects a function as callback');
    }

    if ( options && typeof options !== 'object' ) {
      throw new TypeError('call() expects an object as options');
    }

    if ( options.indicator !== false ) {
      API.createLoading(lname, {className: 'BusyNotification', tooltip: 'API Call'});
    }

    if ( typeof options.indicator !== 'undefined' ) {
      delete options.indicator;
    }

    _CALL_INDEX++;

    return Connection.instance.createRequest(m, a, function API_call_success(response) {
      API.destroyLoading(lname);
      response = response || {};
      cb(response.error || false, response.result);
    }, function API_call_error(err) {
      API.destroyLoading(lname);
      cb(err);
    }, options);

  }
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = Connection;

