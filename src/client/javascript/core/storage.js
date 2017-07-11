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
 * @module core/storage
 */
import Promise from 'bluebird';
import Connection from 'core/connection';
import Process from 'core/process';
import SettingsManager from 'core/settings-manager';
import * as Utils from 'utils/misc';

let _instance;

/**
 * Storage Base Class
 *
 * @abstract
 */
export default class Storage {

  static get instance() {
    return _instance;
  }

  constructor() {
    /* eslint consistent-this: "warn" */
    _instance = this;

    this.saveTimeout = null;
  }

  /**
   * Initializes the Storage
   */
  init() {
    return Promise.resolve();
  }

  /**
   * Destroys the Storage
   */
  destroy() {
    _instance = null;
  }

  /**
   * Internal for saving settings
   *
   * @param   {String}               [pool]          Settings pool
   * @param   {Object}               storage         Settings storage data
   * @param   {CallbackHandler}      callback        Callback function
   */
  _settings(pool, storage, callback) {
    Connection.request('settings', {pool: pool, settings: Utils.cloneObject(storage)}, callback);
  }

  /**
   * Default method to save given settings pool
   *
   * @param   {String}           [pool]        Pool Name
   * @param   {Mixed}            storage       Storage data
   * @param   {CallbackHandler}  callback      Callback function
   */
  saveSettings(pool, storage, callback) {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this._settings(pool, storage, callback);
      clearTimeout(this.saveTimeout);
    }, 250);
  }

  /**
   * Default method for saving current sessions
   *
   * @param   {CallbackHandler}  callback      Callback function
   */
  saveSession(callback) {
    const data = [];
    Process.getProcesses().forEach((proc, i) => {
      if ( proc && (typeof proc._getSessionData === 'function') ) {
        data.push(proc._getSessionData());
      }
    });
    SettingsManager.set('UserSession', null, data, callback);
  }

  /**
   * Get last saved sessions
   *
   * @param   {CallbackHandler}  callback      Callback function
   */
  getLastSession(callback) {
    callback = callback || function() {};

    const res = SettingsManager.get('UserSession');
    const list = [];
    (res || []).forEach((iter, i) => {
      const args = iter.args;
      args.__resume__ = true;
      args.__windows__ = iter.windows || [];

      list.push({name: iter.name, args: args});
    });

    callback(false, list);
  }
}

