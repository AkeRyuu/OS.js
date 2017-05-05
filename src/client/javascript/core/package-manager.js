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
 * @module core/package-manager
 */

const FS = require('utils/fs.js');
const API = require('core/api.js');
const XHR = require('utils/xhr.js');
const Utils = require('utils/misc.js');
const SettingsManager = require('core/settings-manager.js');

/**
 * This is the contents of a 'metadata.json' file for a package.
 * @typedef Metadata
 */

/////////////////////////////////////////////////////////////////////////////
// PACKAGE MANAGER
/////////////////////////////////////////////////////////////////////////////

/**
 * Package Manager Class
 *
 * For maintaining packages
 *
 * @summary Used for managing packages
 */
const PackageManager = (function() {
  let blacklist = [];
  let packages = {};

  return Object.seal({
    destroy: function() {
      blacklist = [];
      packages = {};
    },

    /**
     * Load Metadata from server and set packages
     *
     * @function load
     * @memberof OSjs.Core.PackageManager#
     *
     * @param  {Function} callback      callback
     */
    load: function(callback) {
      callback = callback || {};

      console.debug('PackageManager::load()');

      const loadMetadata = (cb) => {
        this._loadMetadata((err) => {
          if ( err ) {
            callback(err, false, PackageManager);
            return;
          }

          const len = Object.keys(packages).length;
          if ( len ) {
            cb();
          } else {
            callback(false, API._('ERR_PACKAGE_ENUM_FAILED'), PackageManager);
          }
        });
      };

      loadMetadata(() => {
        this._loadExtensions(() => {
          callback(true, false, PackageManager);
        });
      });
    },

    /**
     * Internal method for loading all extensions
     *
     * @function _loadExtensions
     * @memberof OSjs.Core.PackageManager#
     *
     * @param  {Function} callback      callback
     */
    _loadExtensions: function(callback) {
      let preloads = [];

      Object.keys(packages).forEach((k) => {
        const iter = packages[k];
        if ( iter.type === 'extension' && iter.preload ) {
          preloads = preloads.concat(iter.preload);
        }
      });

      if ( preloads.length ) {
        XHR.preload(preloads, (total, failed) => {
          callback();
        });
      } else {
        callback();
      }
    },

    /**
     * Internal method for loading all package metadata
     *
     * @function _loadMetadata
     * @memberof OSjs.Core.PackageManager#
     *
     * @param  {Function} callback      callback
     */
    _loadMetadata: function(callback) {
      const packageURI = API.getConfig('Connection.PackageURI').replace(/\/?$/, '/');
      const rootURI = API.getBrowserPath().replace(/\/$/, packageURI);

      function checkEntry(key, iter, scope) {
        iter = Utils.cloneObject(iter);

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

      if ( API.isStandalone() ) {
        const uri = API.getConfig('Connection.MetadataURI');
        XHR.preload([uri], (total, failed) => {
          if ( failed.length ) {
            callback(API._('ERR_PACKAGE_MANIFEST'), failed);
            return;
          }

          packages = {};

          const list = OSjs.Core.getMetadata();
          Object.keys(list).forEach((name) => {
            const iter = list[name];
            packages[iter.className] = checkEntry(name, iter);
          });

          callback();
        });
        return;
      }

      const Connection = require('core/connection.js');

      const paths = SettingsManager.instance('PackageManager').get('PackagePaths', []);
      Connection.request('packages', {command: 'list', args: {paths: paths}}, (err, res) => {
        if ( res ) {
          packages = {};

          Object.keys(res).forEach((key) => {
            const iter = res[key];
            if ( iter && !packages[iter.className] ) {
              packages[iter.className] = checkEntry(key, iter);
            }
          });
        }

        callback(err);
      });
    },

    /**
     * Generates user-installed package metadata (on runtime)
     *
     * @function generateUserMetadata
     * @memberof OSjs.Core.PackageManager#
     *
     * @param  {Function} callback      callback
     */
    generateUserMetadata: function(callback) {
      const Connection = require('core/connection.js');

      const paths = SettingsManager.instance('PackageManager').get('PackagePaths', []);
      Connection.request('packages', {command: 'cache', args: {action: 'generate', scope: 'user', paths: paths}}, () => {
        this._loadMetadata(callback);
      });
    },

    /**
     * Add a list of packages
     *
     * @param   {Object}    result    Package dict (manifest data)
     * @param   {String}    scope     Package scope (system/user)
     *
     *
     * @function _addPackages
     * @memberof OSjs.Core.PackageManager#
     */
    _addPackages: function(result, scope) {
      console.debug('PackageManager::_addPackages()', result);

      const keys = Object.keys(result);
      if ( !keys.length ) {
        return;
      }

      const currLocale = API.getLocale();

      keys.forEach((i) => {
        const newIter = Utils.cloneObject(result[i]);
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

        packages[i] = newIter;
      });
    },

    /**
     * Installs a package by ZIP
     *
     * @function install
     * @memberof OSjs.Core.PackageManager#
     *
     * @param {OSjs.VFS.File}   file        The ZIP file
     * @param {String}          root        Packge install root (defaults to first path)
     * @param {Function}        cb          Callback function
     */
    install: function(file, root, cb) {
      const Connection = require('core/connection.js');

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
    },

    /**
     * Uninstalls given package
     *
     * @function uninstall
     * @memberof OSjs.Core.PackageManager#
     *
     * @param {OSjs.VFS.File}   file        The path
     * @param {Function}        cb          Callback function
     */
    uninstall: function(file, cb) {
      const Connection = require('core/connection.js');

      Connection.request('packages', {command: 'uninstall', args: {path: file.path}}, (e, r) => {
        if ( e ) {
          cb(e);
        } else {
          this.generateUserMetadata(cb);
        }
      });
    },

    /**
     * Sets the package blacklist
     *
     * @function setBlacklist
     * @memberof OSjs.Core.PackageManager#
     *
     * @param   {String[]}       list        List of package names
     */
    setBlacklist: function(list) {
      blacklist = list || [];
    },

    /**
     * Get a list of packges from online repositories
     *
     * @function getStorePackages
     * @memberof OSjs.Core.PackageManager#
     *
     * @param {Object}    opts      Options
     * @param {Function}  callback  Callback => fn(error, result)
     */
    getStorePackages: function(opts, callback) {
      const repos = SettingsManager.instance('PackageManager').get('Repositories', []);

      let entries = [];

      Utils.asyncs(repos, (url, idx, next) => {
        API.curl({
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
          next();
        });
      }, () => {
        callback(false, entries);
      });
    },

    /**
     * Get package by name
     *
     * @function getPackage
     * @memberof OSjs.Core.PackageManager#
     *
     * @param {String}    name      Package name
     *
     * @return {Metadata}
     */
    getPackage: function(name) {
      if ( typeof packages[name] !== 'undefined' ) {
        return Object.freeze(Utils.cloneObject(packages)[name]);
      }
      return false;
    },

    /**
     * Get all packages
     *
     * @function getPackages
     * @memberof OSjs.Core.PackageManager#
     *
     * @param {Boolean}     [filtered=true]      Returns filtered list
     *
     * @return {Metadata[]}
     */
    getPackages: function(filtered) {
      const hidden = SettingsManager.instance('PackageManager').get('Hidden', []);
      const p = Utils.cloneObject(packages);

      function allowed(i, iter) {
        if ( blacklist.indexOf(i) >= 0 ) {
          return false;
        }

        if ( iter && (iter.groups instanceof Array) ) {
          if ( !API.checkPermission(iter.groups) ) {
            return false;
          }
        }

        return true;
      }

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
    },

    /**
     * Get packages by Mime support type
     *
     * @function getPackagesByMime
     * @memberof OSjs.Core.PackageManager#
     *
     * @param {String}    mime      MIME string
     *
     * @return  {Metadata[]}
     */
    getPackagesByMime: function(mime) {
      const list = [];
      const p = Utils.cloneObject(packages);

      Object.keys(p).forEach((i) => {
        if ( blacklist.indexOf(i) < 0 ) {
          const a = p[i];
          if ( a && a.mime ) {
            if ( FS.checkAcceptMime(mime, a.mime) ) {
              list.push(i);
            }
          }
        }
      });
      return list;
    },

    /**
     * Add a dummy package (useful for having shortcuts in the launcher menu)
     *
     * @function addDummyPackage
     * @memberof OSjs.Core.PackageManager#
     * @throws {Error} On invalid package name or callback
     *
     * @param   {String}      n             Name of your package
     * @param   {String}      title         The display title
     * @param   {String}      icon          The display icon
     * @param   {Function}    fn            The function to run when the package tries to launch
     */
    addDummyPackage: function(n, title, icon, fn) {
      if ( packages[n] || OSjs.Applications[n] ) {
        throw new Error('A package already exists with this name!');
      }
      if ( typeof fn !== 'function' ) {
        throw new TypeError('You need to specify a function/callback!');
      }

      packages[n] = Object.seal({
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
  });
})();

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = PackageManager;
