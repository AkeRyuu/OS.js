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
 * @module core/package-manager
 */

import Promise from 'bluebird';
import Authenticator from 'core/authenticator';
import SettingsManager from 'core/settings-manager';
import {preload} from 'utils/preloader';
import {cloneObject} from 'utils/misc';
import {_, getLocale} from 'core/locales';
import {getConfig, getBrowserPath, isStandalone} from 'core/config';

import * as FS from 'utils/fs';

import Connection from 'core/connection';

/**
 * This is the contents of a 'metadata.json' file for a package.
 * @typedef Metadata
 */

/////////////////////////////////////////////////////////////////////////////
// PACKAGE MANAGER
/////////////////////////////////////////////////////////////////////////////

class PackageManager {

  constructor() {
    this.packages = [];
    this.blacklist = [];
  }

  destroy() {
    this.packages = [];
    this.blacklist = [];
  }

  /**
   * Load Metadata from server and set packages
   */
  init() {
    console.debug('PackageManager::load()');

    return new Promise((resolve, reject) => {
      this._loadMetadata((err) => {
        if ( err ) {
          reject(err);
        } else {
          const len = Object.keys(this.packages).length;
          if ( len ) {
            this._loadExtensions().then(resolve).catch(reject);
          } else {
            reject(_('ERR_PACKAGE_ENUM_FAILED'));
          }
        }
      });
    });
  }

  /**
   * Internal method for loading all extensions
   * @return {Promise}
   */
  _loadExtensions() {
    let preloads = [];

    Object.keys(this.packages).forEach((k) => {
      const iter = this.packages[k];
      if ( iter.type === 'extension' && iter.preload ) {
        preloads = preloads.concat(iter.preload);
      }
    });

    if ( preloads.length ) {
      return preload(preloads);
    }

    return Promise.resolve();
  }

  /**
   * Internal method for loading all package metadata
   *
   * @param  {Function} callback      callback
   */
  _loadMetadata(callback) {
    const packageURI = getConfig('Connection.PackageURI').replace(/\/?$/, '/');
    const rootURI = getBrowserPath().replace(/\/$/, packageURI);

    function checkEntry(key, iter, scope) {
      iter = cloneObject(iter);

      iter.type = iter.type || 'application';

      if ( scope ) {
        iter.scope = scope;
      }

      if ( iter.preload ) {
        iter.preload.forEach((it) => {
          if ( it.src && !it.src.match(/^(\/)|(http)|(ftp)/) ) {
            if ( iter.scope === 'user' ) {
              it.src = FS.pathJoin(iter.path, it.src);
            } else {
              it.src = FS.pathJoin(rootURI, key, it.src);
            }
          }
        });
      }

      return iter;
    }

    if ( isStandalone() ) {
      const uri = getConfig('Connection.MetadataURI');
      preload([uri]).then((result) => {
        if ( result.failed.length ) {
          callback(_('ERR_PACKAGE_MANIFEST'), result.failed);
          return;
        }

        this.packages = {};

        const list = OSjs.Core.getMetadata();
        Object.keys(list).forEach((name) => {
          const iter = list[name];
          this.packages[iter.className] = checkEntry(name, iter);
        });

        callback();
      }).catch(callback);
      return;
    }

    const paths = SettingsManager.instance('PackageManager').get('PackagePaths', []);
    Connection.request('packages', {command: 'list', args: {paths: paths}}, (err, res) => {
      if ( res ) {
        const packages = {};

        Object.keys(res).forEach((key) => {
          const iter = res[key];
          if ( iter && !packages[iter.className] ) {
            packages[iter.className] = checkEntry(key, iter);
          }
        });

        this.packages = packages;
      }

      callback(err);
    });
  }

  /**
   * Generates user-installed package metadata (on runtime)
   *
   * @param  {Function} callback      callback
   */
  generateUserMetadata(callback) {
    const paths = SettingsManager.instance('PackageManager').get('PackagePaths', []);
    Connection.request('packages', {command: 'cache', args: {action: 'generate', scope: 'user', paths: paths}}, () => {
      this._loadMetadata(callback);
    });
  }

  /**
   * Add a list of packages
   *
   * @param   {Object}    result    Package dict (manifest data)
   * @param   {String}    scope     Package scope (system/user)
   */
  _addPackages(result, scope) {
    console.debug('PackageManager::_addPackages()', result);

    const keys = Object.keys(result);
    if ( !keys.length ) {
      return;
    }

    const currLocale = getLocale();

    keys.forEach((i) => {
      const newIter = cloneObject(result[i]);
      if ( typeof newIter !== 'object' ) {
        return;
      }

      if ( typeof newIter.names !== 'undefined' && newIter.names[currLocale] ) {
        newIter.name = newIter.names[currLocale];
      }
      if ( typeof newIter.descriptions !== 'undefined' && newIter.descriptions[currLocale] ) {
        newIter.description = newIter.descriptions[currLocale];
      }
      if ( !newIter.description ) {
        newIter.description = newIter.name;
      }

      newIter.scope = scope || 'system';
      newIter.type  = newIter.type || 'application';

      this.packages[i] = newIter;
    });
  }

  /**
   * Installs a package by ZIP
   *
   * @param {OSjs.VFS.File}   file        The ZIP file
   * @param {String}          root        Packge install root (defaults to first path)
   * @param {Function}        cb          Callback function
   */
  install(file, root, cb) {
    const paths = SettingsManager.instance('PackageManager').get('PackagePaths', []);
    if ( typeof root !== 'string' ) {
      root = paths[0];
    }

    const dest = FS.pathJoin(root, file.filename.replace(/\.zip$/i, ''));
    Connection.request('packages', {command: 'install', args: {zip: file.path, dest: dest, paths: paths}}, (e, r) => {
      if ( e ) {
        cb(e);
      } else {
        this.generateUserMetadata(cb);
      }
    });
  }

  /**
   * Uninstalls given package
   *
   * @param {OSjs.VFS.File}   file        The path
   * @param {Function}        cb          Callback function
   */
  uninstall(file, cb) {
    Connection.request('packages', {command: 'uninstall', args: {path: file.path}}, (e, r) => {
      if ( e ) {
        cb(e);
      } else {
        this.generateUserMetadata(cb);
      }
    });
  }

  /**
   * Sets the package blacklist
   *
   * @param   {String[]}       list        List of package names
   */
  setBlacklist(list) {
    this.blacklist = list || [];
  }

  /**
   * Get a list of packges from online repositories
   *
   * @param {Object}    opts      Options
   * @param {Function}  callback  Callback => fn(error, result)
   */
  getStorePackages(opts, callback) {
    const repos = SettingsManager.instance('PackageManager').get('Repositories', []);

    let entries = [];

    Promise.all(repos, (url) => {
      return new Promise((yes, no) => {
        Connection.request('curl', {
          url: url,
          method: 'GET'
        }, (error, result) => {
          if ( !error && result.body ) {
            let list = [];
            if ( typeof result.body === 'string' ) {
              try {
                list = JSON.parse(result.body);
              } catch ( e ) {}
            }

            entries = entries.concat(list.map((iter) => {
              iter._repository = url;
              return iter;
            }));
          }
          yes();
        });
      });
    }).then(() => callback(false, entries));
  }

  /**
   * Get package by name
   *
   * @param {String}    name      Package name
   *
   * @return {Metadata}
   */
  getPackage(name) {
    if ( typeof this.packages[name] !== 'undefined' ) {
      return Object.freeze(cloneObject(this.packages)[name]);
    }
    return false;
  }

  /**
   * Get all packages
   *
   * @param {Boolean}     [filtered=true]      Returns filtered list
   *
   * @return {Metadata[]}
   */
  getPackages(filtered) {
    const hidden = SettingsManager.instance('PackageManager').get('Hidden', []);
    const p = cloneObject(this.packages);

    const allowed = (i, iter) => {
      if ( this.blacklist.indexOf(i) >= 0 ) {
        return false;
      }

      if ( iter && (iter.groups instanceof Array) ) {
        if ( !Authenticator.instance().checkPermission(iter.groups) ) {
          return false;
        }
      }

      return true;
    };

    if ( typeof filtered === 'undefined' || filtered === true ) {
      const result = {};
      Object.keys(p).forEach((name) => {
        const iter = p[name];
        if ( !allowed(name, iter) ) {
          return;
        }
        if ( iter && hidden.indexOf(name) < 0 ) {
          result[name] = iter;
        }
      });

      return Object.freeze(result);
    }

    return Object.freeze(p);
  }

  /**
   * Get packages by Mime support type
   *
   * @param {String}    mime      MIME string
   *
   * @return  {Metadata[]}
   */
  getPackagesByMime(mime) {
    const list = [];
    const p = cloneObject(this.packages);

    Object.keys(p).forEach((i) => {
      if ( this.blacklist.indexOf(i) < 0 ) {
        const a = p[i];
        if ( a && a.mime ) {
          if ( FS.checkAcceptMime(mime, a.mime) ) {
            list.push(i);
          }
        }
      }
    });
    return list;
  }

  /**
   * Add a dummy package (useful for having shortcuts in the launcher menu)
   *
   * @throws {Error} On invalid package name or callback
   *
   * @param   {String}      n             Name of your package
   * @param   {String}      title         The display title
   * @param   {String}      icon          The display icon
   * @param   {Function}    fn            The function to run when the package tries to launch
   */
  addDummyPackage(n, title, icon, fn) {
    if ( this.packages[n] || OSjs.Applications[n] ) {
      throw new Error('A package already exists with this name!');
    }
    if ( typeof fn !== 'function' ) {
      throw new TypeError('You need to specify a function/callback!');
    }

    this.packages[n] = Object.seal({
      _dummy: true,
      type: 'application',
      className: n,
      description: title,
      name: title,
      icon: icon,
      cateogry: 'other',
      scope: 'system'
    });

    OSjs.Applications[n] = fn;
  }

}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

export default (new PackageManager());
