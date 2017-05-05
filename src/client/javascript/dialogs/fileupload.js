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
const VFS = require('vfs/fs.js');
const DialogWindow = require('core/dialog.js');

/**
 * An 'FileUpload' dialog
 *
 * @example
 *
 * OSjs.API.createDialog('FileUpload', {}, fn);
 *
 * @constructor FileUpload
 * @memberof OSjs.Dialogs
 */
class FileUploadDialog extends DialogWindow {

  /**
   * @param  {Object}          args              An object with arguments
   * @param  {String}          args.title        Dialog title
   * @param  {String}          args.dest         VFS destination
   * @param  {OSjs.VFS.File}   [args.file]       File to upload
   * @param  {CallbackDialog}  callback          Callback when done
   */
  constructor(args, callback) {
    args = Object.assign({}, {
      dest: API.getDefaultPath(),
      progress: {},
      file: null
    }, args);

    if ( args.destination ) {
      args.dest = args.destination;
    }
    if ( !args.dest ) {
      args.dest = API.getDefaultPath();
    }

    super('FileUploadDialog', {
      title: args.title || API._('DIALOG_UPLOAD_TITLE'),
      icon: 'actions/document-new.png',
      width: 400,
      height: 100
    }, args, callback);
  }

  init() {
    const root = super.init(...arguments);
    const message = this._find('Message');
    const maxSize = API.getConfig('VFS.MaxUploadSize');

    message.set('value', API._('DIALOG_UPLOAD_DESC', this.args.dest, maxSize), true);

    const input = this._find('File');
    if ( this.args.file ) {
      this.setFile(this.args.file, input);
    } else {
      input.on('change', (ev) => {
        this.setFile(ev.detail, input);
      });
    }

    return root;
  }

  setFile(file, input) {
    let progressDialog;

    const error = (msg, ev) => {
      API.error(
        API._('DIALOG_UPLOAD_FAILED'),
        API._('DIALOG_UPLOAD_FAILED_MSG'),
        msg || API._('DIALOG_UPLOAD_FAILED_UNKNOWN')
      );

      progressDialog._close(true);
      this.onClose(ev, 'cancel');
    };

    if ( file ) {
      let fileSize = 0;
      if ( file.size > 1024 * 1024 ) {
        fileSize = (Math.round(file.size * 100 / (1024 * 1024)) / 100).toString() + 'MB';
      } else {
        fileSize = (Math.round(file.size * 100 / 1024) / 100).toString() + 'KB';
      }

      if ( input ) {
        input.set('disabled', true);
      }

      this._find('ButtonCancel').set('disabled', true);

      const desc = OSjs.API._('DIALOG_UPLOAD_MSG_FMT', file.name, file.type, fileSize, this.args.dest);

      progressDialog = API.createDialog('FileProgress', {
        message: desc,
        dest: this.args.dest,
        filename: file.name,
        mime: file.type,
        size: fileSize
      }, (ev, button) => {
        // Dialog closed
      }, this);

      if ( this._wmref ) {
        this._wmref.createNotificationIcon(this.notificationId, {className: 'BusyNotification', tooltip: desc, image: false});
      }

      VFS.upload({files: [file], destination: this.args.dest}, (err, result, ev) => {
        if ( err ) {
          error(err, ev);
          return;
        }
        progressDialog._close(true);
        self.onClose(ev, 'ok', file);
      }, {
        onprogress: (ev) => {
          if ( ev.lengthComputable ) {
            const p = Math.round(ev.loaded * 100 / ev.total);
            progressDialog.setProgress(p);
          }
        }
      });

      setTimeout(() => {
        if ( progressDialog ) {
          progressDialog._focus();
        }
      }, 100);
    }
  }

  onClose(ev, button, result) {
    result = result || null;
    this.closeCallback(ev, button, result);
  }

}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = FileUploadDialog;
