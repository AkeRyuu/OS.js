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
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
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
import axios from 'axios';
import Promise from 'bluebird';
import {_} from 'core/locales';

export default class Transport {

  /**
   * Performs a request
   *
   * @param {String}      method    Method name
   * @param {Array}       args      Method arguments
   * @param {Object}      options   Options
   * @param {Mountpoint}  mount     Requested from this mountpoint
   * @return {Promise}
   */
  request(method, args, options, mount) {
    const readOnly = ['upload', 'unlink', 'write', 'mkdir', 'move', 'trash', 'untrash', 'emptyTrash'];
    if ( mount.isReadOnly() ) {
      if ( readOnly.indexOf(method) !== -1 ) {
        return Promise.reject(_('ERR_VFSMODULE_READONLY'));
      }
    }

    const newArgs = args.concat([options]);
    return this[method](...newArgs);
  }

  scandir(item, options) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  read(item, options) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  write(file, data, options) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  unlink(src) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  copy(src, dest) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  move(src, dest) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  exists(item) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  fileinfo(item) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  mkdir(dir) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  upload(file, dest) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  download(item) {
    return new Promise((resolve, reject) => {
      this.url(item).then((url) => {
        axios({
          responseType: 'arraybuffer',
          url: url,
          method: 'GET'
        }).then((result) => {
          return resolve(result.data);
        }).catch((error) => {
          reject(error.message);
        });
      }).catch(reject);
    });
  }

  url(item) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  find(file, options) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  trash(file) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  untrash(file) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  emptyTrash() {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

  freeSpace(root) {
    return Promise.reject(_('ERR_VFS_UNAVAILABLE'));
  }

}
