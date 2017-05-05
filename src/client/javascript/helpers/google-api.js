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

const API = require('core/api.js');
const XHR = require('utils/xhr.js');
const MountManager = require('core/mount-manager.js');

/**
 * @namespace GoogleAPI
 * @memberof OSjs.Helpers
 */

const gapi = window.gapi = window.gapi || {};

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

let SingletonInstance = null;

/**
 * The GoogleAPI wrapper class
 *
 * <pre><b>
 * Generally you want to create an instance of this helper
 * and when successfully created use `window.gapi`.
 *
 * This is a private class and can only be aquired through
 * OSjs.Helpers.GoogleAPI.createInsatance()
 * </b></pre>
 *
 * @summary Helper for communicating with Google API.
 *
 * @constructor Class
 * @memberof OSjs.Helpers.GoogleAPI
 * @see OSjs.Helpers.GoogleAPI.createInsatance
 *
 * @link https://developers.google.com/api-client-library/javascript/start/start-js
 * @link https://developers.google.com/api-client-library/javascript/
 * @link https://console.developers.google.com/project
 */
class GoogleAPI {

  /**
   * @param {String}  clientId    Client ID (key)
   */
  constructor(clientId) {
    this.clientId       = clientId;
    this.accessToken    = null;
    this.userId         = null;
    this.preloaded      = false;
    this.authenticated  = false;
    this.loaded         = [];
    this.preloads       = [
      {
        type: 'javascript',
        src: 'https://apis.google.com/js/api.js'
      }
    ];
  }

  /*
   * Destroy the class
   */
  destroy() {
  }

  /*
   * Initializes (preloads) the API
   */
  init(callback) {
    callback = callback || function() {};
    if ( this.preloaded ) {
      callback(false, true);
    } else {
      XHR.preload(this.preloads, (total, failed) => {
        if ( !failed.length ) {
          this.preloaded = true;
        }
        callback(failed.join('\n'));
      });
    }
  }

  /*
   * Loads the API
   */
  load(load, scope, client, callback) {
    const auth = (cb) => {
      this.authenticate(scope, (error, result) => {
        if ( error ) {
          cb(error);
        } else {
          if ( !this.authenticated ) {
            cb(API._('GAPI_AUTH_FAILURE'));
            return;
          }
          cb(false, result);
        }
      });
    };

    const loadAll = (finished) => {
      const lload = [];
      load.forEach((i) => {
        if ( this.loaded.indexOf(i) === -1 ) {
          lload.push(i);
        }
      });

      let current = 0;
      let total = lload.length;

      console.debug('GoogleAPI::load()', load, '=>', lload, scope);

      const _load = (iter, cb) => {
        let args = [];
        let name = null;

        if ( iter instanceof Array ) {
          if ( iter.length > 0 && iter.length < 3 ) {
            args = args.concat(iter);
            name = iter[0];
          }
        } else {
          args.push(iter);
          name = iter;
        }

        args.push((a, b, c, d) => {
          this.loaded.push(name);

          /* eslint no-invalid-this: "off" */
          cb.call(this, a, b, c, d);
        });

        if ( client ) {
          gapi.client.load.apply(gapi, args);
        } else {
          gapi.load.apply(gapi, args);
        }
      };

      function _next() {
        if ( current >= total ) {
          finished();
        } else {
          _load(lload[current], () => {
            _next();
          });

          current++;
        }
      }

      _next();
    };

    this.init((error) => {
      if ( error ) {
        callback(error);
        return;
      }

      if ( !window.gapi || !gapi.load ) {
        callback(API._('GAPI_LOAD_FAILURE'));
        return;
      }

      auth((error) => {
        if ( error ) {
          callback(error);
          return;
        }

        loadAll((error, result) => {
          callback(error, result, SingletonInstance);
        });
      });

    });
  }

  /**
   * Sign out of GoogleAPI
   *
   * @function signOut
   * @memberof OSjs.Helpers.GoogleAPI.Class#
   *
   * @param   {Function}    cb      Callback => fn(error, result)
   */
  signOut(cb) {
    cb = cb || function() {};

    console.info('GoogleAPI::signOut()');
    if ( this.authenticated ) {
      try {
        gapi.auth.signOut();
      } catch ( e ) {
        console.warn('GoogleAPI::signOut()', 'failed', e);
        console.warn(e.stack);
      }

      this.authenticated = false;

      const ring = API.getServiceNotificationIcon();
      if ( ring ) {
        ring.remove('Google API');
      }
    }

    MountManager.remove('GoogleDrive');

    cb(false, true);
  }

  /**
   * Revoke Google permissions for this app
   *
   * @function revoke
   * @memberof OSjs.Helpers.GoogleAPI.Class#
   *
   * @param   {Function}    callback      Callback => fn(error, result)
   */
  revoke(callback) {
    console.info('GoogleAPI::revoke()');

    if ( !this.accessToken ) {
      callback(false);
      return;
    }

    const url = 'https://accounts.google.com/o/oauth2/revoke?token=' + this.accessToken;
    XHR.ajax({
      url: url,
      jsonp: true,
      onsuccess: () => {
        callback(true);
      },
      onerror: () => {
        callback(false);
      }
    });
  }

  /*
   * Authenticates the user
   */
  authenticate(scope, callback) {
    console.info('GoogleAPI::authenticate()');

    callback = callback || function() {};

    const getUserId = (cb) => {
      cb = cb || function() {};
      gapi.client.load('oauth2', 'v2', () => {
        gapi.client.oauth2.userinfo.get().execute((resp) => {
          console.info('GoogleAPI::authenticate() => getUserId()', resp);
          cb(resp.id);
        });
      });
    };

    const login = (immediate, cb) => {
      console.info('GoogleAPI::authenticate() => login()', immediate);

      cb = cb || function() {};
      gapi.auth.authorize({
        client_id: this.clientId,
        scope: scope,
        user_id: this.userId,
        immediate: immediate
      }, cb);
    };

    const createRingNotification = () => {
      const ring = API.getServiceNotificationIcon();
      if ( ring ) {
        ring.remove('Google API');

        ring.add('Google API', [{
          title: API._('GAPI_SIGN_OUT'),
          onClick: () => {
            this.signOut();
          }
        }, {
          title: API._('GAPI_REVOKE'),
          onClick: () => {
            this.revoke(() => {
              this.signOut();
            });
          }
        }]);
      }
    };

    const handleAuthResult = (authResult, immediate) => {
      console.info('GoogleAPI::authenticate() => handleAuthResult()', authResult);

      if ( authResult.error ) {
        if ( authResult.error_subtype === 'origin_mismatch' || (authResult.error_subtype === 'access_denied' && !immediate) ) {
          const msg = API._('GAPI_AUTH_FAILURE_FMT', authResult.error, authResult.error_subtype);
          callback(msg);
          return;
        }
      }

      if ( authResult && !authResult.error ) {
        getUserId((id) => {
          this.userId = id;

          if ( id ) {
            createRingNotification();
            this.authenticated = true;
            this.accessToken = authResult.access_token || null;
            callback(false, true);
          } else {
            callback(false, false);
          }
        });
      } else {
        login(false, (res) => {
          handleAuthResult(res, false);
        });
      }
    };

    gapi.load('auth:client', (result) => {
      if ( result && result.error ) {
        const msg = API._('GAPI_AUTH_FAILURE_FMT', result.error, result.error_subtype);
        callback(msg);
        return;
      }

      login(true, (res) => {
        handleAuthResult(res, true);
      });
    });
  }
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = {
  instance: function() {
    return SingletonInstance;
  },
  create: function(args, callback) {
    const load = args.load || [];
    const scope = args.scope || [];
    const client = args.client === true;

    function _run() {
      SingletonInstance.load(load, scope, client, callback);
    }

    if ( SingletonInstance ) {
      _run();
      return;
    }

    let clientId = null;
    try {
      clientId = API.getConfig('GoogleAPI.ClientId');
    } catch ( e ) {
      console.warn('getGoogleAPI()', e, e.stack);
    }

    if ( !clientId ) {
      callback(API._('GAPI_DISABLED'));
      return;
    }

    SingletonInstance = new GoogleAPI(clientId);
    _run();
  }

};
