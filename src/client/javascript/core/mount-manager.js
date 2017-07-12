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
 * @module core/mount-manager
 */
import Promise from 'bluebird';

import Mountpoint from 'vfs/mountpoint';
import {_} from 'core/locales';
import {getConfig} from 'core/config';

/////////////////////////////////////////////////////////////////////////////
// MOUNT MANAGER
/////////////////////////////////////////////////////////////////////////////

/**
 * Mount Manager Class
 *
 * @summary Class for maintaining mountpoints
 */
class MountManager {

  /**
   * Constructs a new MountManager
   */
  constructor() {
    this.inited = false;
    this.transports = { // FIXME
      osjs: require('vfs/transports/osjs').default,
      dist: require('vfs/transports/dist').default
    };
    this.mountpoints = [];
  }

  /**
   * Initializes MountManager
   *
   * @return {Promise}
   */
  init() {
    if ( this.inited ) {
      return Promise.resolve();
    }

    this.inited = true;

    const config = getConfig('VFS.Mountpoints', {});

    return Promise.each(Object.keys(config), (name) => {
      const iter = Object.assign(config[name], {
        name: name,
        title: name,
        description: name,
        dynamic: false
      });

      return new Promise((resolve) => {
        this.add(iter, true, {
          notify: false
        }).then(resolve).catch((e) => {
          console.warn('Failed to init VFS Mountpoint', name, iter, String(e));
          return resolve(false); // We skip errors on init
        });
      });
    });
  }

  /**
   * Adds a list of mountpoints
   *
   * @param {Mountpoint[]|Object[]} mountPoints Mountpoints
   * @return {Promise}
   */
  addList(mountPoints) {
    return Promise.each(mountPoints, (iter) => this.add(iter));
  }

  /**
   * Adds a mountpoint
   *
   * @param {MountPoint|Object} point   The mountpoint
   * @param {Boolean}           mount   Mounts the mountpoint
   * @param {Object}            options Mount options
   * @return {Promise}
   */
  add(point, mount, options) {
    //throw new Error(_('ERR_VFSMODULE_ALREADY_MOUNTED_FMT', name));
    try {
      if ( !(point instanceof Mountpoint) ) {

        if ( typeof point.transport === 'string' ) {
          const T = this.transports[point.transport];
          point.transport = new T();
        }

        point = new Mountpoint(point);
      }

      this.mountpoints.push(point);
    } catch ( e ) {
      return Promise.reject(e);
    }

    console.info('Mounting', point);

    return mount ? point.mount(options) : Promise.resolve();
  }

  /**
   * Removes a mountpoint
   *
   * @param {String}      moduleName      Name of the mountpoint
   * @param {Object}      options         Unmount options
   * @return {Promise}
   */
  remove(moduleName, options) {
    const module = this.getModule(moduleName);
    if ( module ) {
      return new Promise((resolve, reject) => {
        module.unmount(options).then((res) => {
          return resolve(res); // FIXME: Remove from array
        }).catch(reject);
      });
    }

    return Promise.reject(new Error(_('ERR_VFSMODULE_NOT_MOUNTED_FMT', moduleName)));
  }

  /**
   * Gets all modules (with filtering)
   *
   * @param {Object} filter The filter
   * @return {Mountpoint[]}
   */
  getModules(filter) {
    filter = Object.assign({}, {
      visible: true,
      special: false
    }, filter);

    return this.mountpoints.filter((mount) => {
      if ( mount.enabled() && mount.option('visible') ) {

        const hits = Object.keys(filter).filter((filterName) => {
          return mount.option(filterName) === filter[filterName];
        });

        return hits.length > 0;
      }

      return false;
    });
  }

  /**
   * Gets a mountpoint from a matching path
   * @param {String} test Path to test
   * @return {Mountpoint}
   */
  getModuleFromPath(test) {
    return this.mountpoints.find((mount) => {
      if ( mount.enabled() ) {
        if ( mount.option('match') && test.match(mount.option('match')) ) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Gets a mountpoint by name
   * @param {String}  name   Mountpoint name
   * @return {Mountpoint}
   */
  getModule(name) {
    return this.mountpoints.find((i) => i.option('name') === name);
  }

  /**
   * Gets a transport by name
   * @param {String}  name   Transport name
   * @return {Mountpoint}
   */
  getTransport(name) {
    return this.transports[name];
  }

  getRootFromPath(path) {
    // FIXME: Deprecate
    return this.getModuleFromPath(path).option('root');
  }

}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

export default (new MountManager());
