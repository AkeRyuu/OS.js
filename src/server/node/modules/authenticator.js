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
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND
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

const _settings = require('./../core/settings.js');
const _vfs = require('./../core/vfs.js');
const _env = require('./../core/env.js');
const _logger = require('./../lib/logger.js');
const _utils = require('./../lib/utils.js');

/**
 * @namespace core.auth
 */

let MODULE;

class Authenticator {

  register(config) {
    return Promise.resolve(true);
  }

  destroy() {
    return Promise.resolve(true);
  }

  login(http, data) {
    return Promise.reject('Not implemented');
  }

  logout(http) {
    return Promise.resolve(true);
  }

  manage(http, command, args) {
    return Promise.reject('Not implemented');
  }

  initSession(http) {
    return Promise.resolve(true);
  }

  checkPermission(http, type, options) {
    return Promise.resolve(true);
  }

  checkSession(http) {
    return new Promise((resolve, reject) => {
      if ( http.session.get('username') ) {
        resolve();
      } else {
        reject('You have no OS.js Session, please log in!');
      }
    });
  }

  getGroups(http, username) {
    return Promise.resolve([]);
  }

  getBlacklist(http, username) {
    return Promise.resolve([]);
  }

  setBlacklist(http, username, list) {
    return Promise.resolve(true);
  }

  /////////////////////////////////////////////////////////////////////////////
  // STATIC METHODS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Loads the authentication module
   *
   * @param {Object}  opts   Initial options
   *
   * @function load
   * @memberof core.auth
   * @return {Promise}
   */
  static load(opts) {
    return new Promise((resolve, reject) => {
      const config = _settings.get();
      const name = opts.AUTH || (config.authenticator || 'demo');
      const ok = () => resolve(opts);

      _utils.loadModule(_env.get('MODULEDIR'), 'auth', name).then((path) => {
        _logger.lognt('INFO', 'Loading:', _logger.colored('Authenticator', 'bold'), path.replace(_env.get('ROOTDIR'), ''));

        try {
          const a = require(path);
          const c = _settings.get('modules.auth')[name] || {};
          const r = a.register(c);

          MODULE = a;

          if ( r instanceof Promise ) {
            r.then(ok).catch(reject);
          } else {
            ok();
          }
        } catch ( e ) {
          _logger.lognt('WARN', _logger.colored('Warning:', 'yellow'), e);
          console.warn(e.stack);
          reject(e);
        }
      }).catch(reject);
    });
  }

  /**
   * Gets the authentication module
   *
   * @function get
   * @memberof core.auth
   * @return {Object}
   */
  static get() {
    return MODULE;
  }

  /**
   * Checks a permission
   *
   * @param   {ServerRequest}    http          OS.js Server Request
   * @param   {String}           type          Permission type
   * @param   {Object}           [options]     Permission options/arguments
   *
   * @function checkModulePermission
   * @memberof core.auth
   * @return {Promise}
   */
  static checkModulePermission(http, type, options) {
    const config = _settings.get();
    const groups = config.api.groups;
    const username = http.session.get('username');
    const defaultGroups = config.api.defaultGroups instanceof Array ? config.api.defaultGroups : [];

    const checkApiPermission = (userGroups) => new Promise((resolve, reject) => {
      let checks = [];
      if ( type === 'fs' ) {
        checks = [type];
      } else {
        if ( options.method && typeof groups[options.method] !== 'undefined' ) {
          checks = [groups[options.method]];
        }
      }

      if ( this.hasGroup(userGroups, checks) ) {
        resolve();
      } else {
        reject('Access denied!');
      }
    });

    const checkMountPermission = (userGroups) => {
      const mountpoints = config.vfs.mounts || {};
      const groups = config.vfs.groups || {};

      const _checkMount = (p, d) => {
        const parsed = _vfs.parseVirtualPath(p, http);
        const mount = mountpoints[parsed.protocol];
        const map = d ? ['upload', 'write', 'delete', 'copy', 'move', 'mkdir'] : ['upload', 'write', 'delete', 'mkdir'];

        if ( typeof mount === 'object' ) {
          if ( mount.enabled === false || (mount.ro === true && map.indexOf(options.method) !== -1) ) {
            return false;
          }
        }

        if ( groups[parsed.protocol] ) {
          if ( !this.hasGroup(userGroups, groups[parsed.protocol]) ) {
            return false;
          }
        }

        return true;
      };

      function _check() {
        const args = options.args;
        const src = args.path || args.root || args.src || '';

        if ( _checkMount(src) ) {
          if ( typeof args.dest !== 'undefined' ) {
            return _checkMount(args.dest, true);
          }
          return true;
        }

        return false;
      }

      return new Promise((resolve, reject) => {
        if ( type === 'fs' ) {
          if ( _check() ) {
            resolve();
          } else {
            reject('Access Denied!');
          }
        } else {
          resolve();
        }
      });
    };

    function checkPackagePermission(userGroups) {
      return new Promise((resolve, reject) => {
        if ( type === 'package' ) {
          MODULE.getBlacklist(http, username).then((blacklist) => {
            if ( blacklist && blacklist.indexOf(options.path) !== -1 ) {
              reject('Access Denied!');
            } else {
              resolve();
            }
          }).catch(() => {
            reject('Access Denied!');
          });
        } else {
          resolve();
        }
      });
    }

    return new Promise((resolve, reject) => {
      MODULE.checkPermission(http, type, options).then((checkGroups) => {
        if ( typeof checkGroups === 'undefined' ) {
          checkGroups = true;
        }

        if ( checkGroups ) {
          MODULE.getGroups(http, username).then((userGroups) => {
            if ( !(userGroups instanceof Array) || !userGroups.length ) {
              userGroups = defaultGroups;
            }

            checkApiPermission(userGroups).then(() => {
              checkMountPermission(userGroups).then(() => {
                checkPackagePermission(userGroups).then(resolve).catch(reject);
              }).catch(reject);
            }).catch(reject);
          }).catch(reject);
        } else {
          resolve();
        }
      }).catch(reject);
    });
  }

  /**
   * Initializes a session
   *
   * @param   {ServerRequest}    http          OS.js Server Request
   *
   * @function initModuleSession
   * @memberof core.auth
   * @return {Promise}
   */
  static initModuleSession(http) {
    return MODULE.initSession(http);
  }

  /**
   * Checks a session
   *
   * @param   {ServerRequest}    http          OS.js Server Request
   *
   * @function checkModuleSession
   * @memberof core.auth
   * @return {Promise}
   */
  static checkModuleSession(http) {
    return MODULE.checkSession(http);
  }

  /**
   * Checks if user has given group(s)
   *
   * @param   {Array}            userGroups    User groups
   * @param   {String|Array}     groupList     Group(s)
   * @param   {Boolean}          [all=true]    Check if all and not some
   *
   * @function hasGroup
   * @memberof core.auth
   * @return {Promise}
   */
  static hasGroup(userGroups, groupList, all) {
    if ( !(groupList instanceof Array) ) {
      groupList = [];
    }

    if ( !groupList.length ) {
      return true;
    }

    if ( userGroups.indexOf('admin') !== -1 ) {
      return true;
    }

    if ( !(groupList instanceof Array) ) {
      groupList = [groupList];
    }

    const m = (typeof all === 'undefined' || all) ? 'every' : 'some';
    return groupList[m]((name) => {
      if ( userGroups.indexOf(name) !== -1 ) {
        return true;
      }

      return false;
    });
  }
}

module.exports = Authenticator;