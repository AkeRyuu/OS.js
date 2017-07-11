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

/**
 * @module core/authenticator
 */
import Promise from 'bluebird';
import {_, setLocale} from 'core/locales';
import {getConfig, getUserLocale} from 'core/config';
import Connection from 'core/connection';
import SettingsManager from 'core/settings-manager';
import PackageManager from 'core/package-manager';

let _instance;

/**
 * Authenticator Base Class
 *
 * @abstract
 */
export default class Authenticator {

  static get instance() {
    return _instance;
  }

  constructor() {
    /* eslint consistent-this: "warn" */
    _instance = this;

    /**
     * User data
     * @type {Object}
     * @example
     * {
     *  id: -1,
     *  username: 'foo',
     *  groups: []
     * }
     */
    this.userData = {
      id: 0,
      username: 'root',
      name: 'root user',
      groups: ['admin']
    };

    /**
     * If user is logged in
     * @type {Boolean}
     */
    this.loggedIn = false;
  }

  /**
   * Initializes the Authenticator
   * return {Promise}
   */
  init() {
    return new Promise((resolve, reject) => {
      this.onCreateUI((err, res) => {
        if ( err ) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  /**
   * Destroys the Authenticator
   */
  destroy() {
    _instance = null;
  }

  /**
   * Get data for logged in user
   *
   * @return  {Object}      JSON With user data
   */
  getUser() {
    return Object.assign({}, this.userData);
  }

  /**
   * Gets if there is a user logged in
   *
   * @return {Boolean}
   */
  isLoggedIn() {
    return this.isLoggedIn;
  }

  /**
   * Log in user
   *
   * @param   {Object}               data            Login form data
   * @param   {CallbackHandler}      callback        Callback function
   */
  login(data, callback) {
    Connection.request('login', data, function onLoginResponse(error, result) {
      if ( result ) {
        callback(false, result);
      } else {
        error = error || _('ERR_LOGIN_INVALID');
        callback(_('ERR_LOGIN_FMT', error), false);
      }
    });
  }

  /**
   * Log out user
   *
   * @param   {CallbackHandler}      callback        Callback function
   */
  logout(callback) {
    const opts = {};

    Connection.request('logout', opts, function onLogoutResponse(error, result) {
      if ( result ) {
        callback(false, true);
      } else {
        callback('An error occured: ' + (error || 'Unknown error'));
      }
    });
  }

  /**
   * Checks the given permission (groups) against logged in user
   *
   * @param   {Mixed}     group         Either a string or array of groups
   *
   * @return {Boolean}
   */
  checkPermission(group) {
    const user = this.getUser();
    const userGroups = user.groups || [];

    if ( !(group instanceof Array) ) {
      group = [group];
    }

    let result = true;
    if ( userGroups.indexOf('admin') < 0 ) {
      group.every((g) => {
        if ( userGroups.indexOf(g) < 0 ) {
          result = false;
        }
        return result;
      });
    }
    return result;
  }

  /**
   * When login is requested
   *
   * @param   {Object}               data            Login data
   * @param   {CallbackHandler}      callback        Callback function
   */
  onLoginRequest(data, callback) {
    this.login(data, (err, result) => {
      if ( err ) {
        callback(err);
      } else {
        this.onLogin(result, callback);
      }
    });
  }

  /**
   * When login has occured
   *
   * @param   {Object}               data            User data
   * @param   {CallbackHandler}      callback        Callback function
   */
  onLogin(data, callback) {
    let userSettings = data.userSettings;
    if ( !userSettings || userSettings instanceof Array ) {
      userSettings = {};
    }

    this.userData = data.userData;

    // Ensure we get the user-selected locale configured from WM
    function getLocale() {
      let curLocale = getConfig('Locale');
      let detectedLocale = getUserLocale();

      if ( getConfig('LocaleOptions.AutoDetect', true) && detectedLocale ) {
        console.info('Auto-detected user locale via browser', detectedLocale);
        curLocale = detectedLocale;
      }

      let result = SettingsManager.get('CoreWM');
      if ( !result ) {
        try {
          result = userSettings.CoreWM;
        } catch ( e )  {}
      }
      return result ? (result.language || curLocale) : curLocale;
    }

    document.getElementById('LoadingScreen').style.display = 'block';

    setLocale(getLocale());
    SettingsManager.init(userSettings);

    if ( data.blacklistedPackages ) {
      PackageManager.setBlacklist(data.blacklistedPackages);
    }

    this.loggedIn = true;

    callback(null, true);
  }

  /**
   * When login UI is requested
   *
   * @param   {CallbackHandler}      callback        Callback function
   */
  onCreateUI(callback) {
    const container = document.getElementById('Login');
    const login = document.getElementById('LoginForm');
    const u = document.getElementById('LoginUsername');
    const p = document.getElementById('LoginPassword');
    const s = document.getElementById('LoginSubmit');

    if ( !container ) {
      throw new Error('Could not find Login Form Container');
    }

    function _restore() {
      s.removeAttribute('disabled');
      u.removeAttribute('disabled');
      p.removeAttribute('disabled');
    }

    function _lock() {
      s.setAttribute('disabled', 'disabled');
      u.setAttribute('disabled', 'disabled');
      p.setAttribute('disabled', 'disabled');
    }

    login.onsubmit = (ev) => {
      _lock();
      if ( ev ) {
        ev.preventDefault();
      }

      this.onLoginRequest({
        username: u.value,
        password: p.value
      }, (err) => {
        if ( err ) {
          alert(err);
          _restore();
        } else {
          container.parentNode.removeChild(container);
          callback();
        }
      });
    };

    container.style.display = 'block';

    _restore();
  }

}

