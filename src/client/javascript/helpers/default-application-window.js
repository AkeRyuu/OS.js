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

/*eslint valid-jsdoc: "off"*/
'use strict';

const API = require('core/api.js');
const VFS = require('vfs/fs.js');
const Window = require('core/window.js');
const Scheme = require('gui/scheme.js');

/////////////////////////////////////////////////////////////////////////////
// Default Application Window Helper
/////////////////////////////////////////////////////////////////////////////

/**
 * This is a helper to more easily create an application.
 *
 * Use in combination with 'DefaultApplication'
 *
 * @summary Helper for making Applications with file interaction.
 *
 * @constructor
 * @memberof OSjs.Helpers
 * @see OSjs.Helpers.DefaultApplication
 * @see OSjs.Core.Window
 */
class DefaultApplicationWindow extends Window {

  constructor(name, app, args, scheme, file) {
    super(...arguments);
    this.hasClosingDialog = false;
    this.currentFile = file ? new VFS.File(file) : null;
    this.hasChanged = false;
  }

  /*
   * Destroy
   */
  destroy() {
    super.destroy(...arguments);
    this.currentFile = null;
  }

  /*
   * Initialize
   */
  init(wm, app, scheme) {
    const root = super.init(...arguments);
    return root;
  }

  /*
   * Applies default Window GUI stuff
   */
  _inited() {
    const result = Window.prototype._inited.apply(this, arguments);
    const app = this._app;

    const menuMap = {
      MenuNew: () => {
        app.newDialog(this.currentFile, this);
      },
      MenuSave: () => {
        app.saveDialog(this.currentFile, this);
      },
      MenuSaveAs: () => {
        app.saveDialog(this.currentFile, this, true);
      },
      MenuOpen: () => {
        app.openDialog(this.currentFile, this);
      },
      MenuClose: () => {
        this._close();
      }
    };

    this._find('SubmenuFile').on('select', (ev) => {
      if ( menuMap[ev.detail.id] ) {
        menuMap[ev.detail.id]();
      }
    });

    this._find('MenuSave').set('disabled', true);

    // Load given file
    if ( this.currentFile ) {
      if ( !this._app.openFile(this.currentFile, this) ) {
        this.currentFile = null;
      }
    }

    return result;
  }

  /*
   * On Drag-And-Drop Event
   */
  _onDndEvent(ev, type, item, args) {
    if ( !Window.prototype._onDndEvent.apply(this, arguments) ) {
      return;
    }

    if ( type === 'itemDrop' && item ) {
      const data = item.data;
      if ( data && data.type === 'file' && data.mime ) {
        this._app.openFile(new VFS.File(data), this);
      }
    }
  }

  /*
   * On Close
   */
  _close() {
    if ( this.hasClosingDialog ) {
      return;
    }

    if ( this.hasChanged ) {
      this.hasClosingDialog = true;
      this.checkHasChanged((discard) => {
        this.hasClosingDialog = false;
        if ( discard ) {
          this.hasChanged = false; // IMPORTANT
          this._close();
        }
      });
      return;
    }

    Window.prototype._close.apply(this, arguments);
  }

  /**
   * Checks if current file has changed
   *
   * @function  checkHasChanged
   * @memberof OSjs.Helpers.DefaultApplicationWindow#
   *
   * @param   {Function}      cb        Callback => fn(discard_changes)
   */
  checkHasChanged(cb) {
    if ( this.hasChanged ) {
      API.createDialog('Confirm', {
        buttons: ['yes', 'no'],
        message: API._('MSG_GENERIC_APP_DISCARD')
      }, function(ev, button) {
        cb(button === 'ok' || button === 'yes');
      }, {parent: this, modal: true});
      return;
    }

    cb(true);
  }

  /**
   * Show opened/created file
   *
   * YOU SHOULD EXTEND THIS METHOD IN YOUR WINDOW TO ACTUALLY DISPLAY CONTENT
   *
   * @function  showFile
   * @memberof OSjs.Helpers.DefaultApplicationWindow#
   *
   * @param   {OSjs.VFS.File}       file        File
   * @param   {Mixed}               content     File contents
   */
  showFile(file, content) {
    this.updateFile(file);
  }

  /**
   * Updates current view for given File
   *
   * @function updateFile
   * @memberof OSjs.Helpers.DefaultApplicationWindow#
   *
   * @param   {OSjs.VFS.File}       file        File
   */
  updateFile(file) {
    this.currentFile = file || null;
    this.hasChanged = false;

    if ( this._scheme && (this._scheme instanceof Scheme) ) {
      this._find('MenuSave').set('disabled', !file);
    }

    if ( file ) {
      this._setTitle(file.filename, true);
    } else {
      this._setTitle();
    }
  }

  /**
   * Gets file data
   *
   * YOU SHOULD IMPLEMENT THIS METHOD IN YOUR WINDOW TO RETURN FILE CONTENTS
   *
   * @function getFileData
   * @memberof OSjs.Helpers.DefaultApplicationWindow#
   *
   * @return  {Mixed} File contents
   */
  getFileData() {
    return null;
  }

  /**
   * Window key
   */
  _onKeyEvent(ev, type, shortcut) {
    if ( shortcut === 'SAVE' ) {
      this._app.saveDialog(this.currentFile, this, !this.currentFile);
      return false;
    } else if ( shortcut === 'SAVEAS' ) {
      this._app.saveDialog(this.currentFile, this, true);
      return false;
    } else if ( shortcut === 'OPEN' ) {
      this._app.openDialog(this.currentFile, this);
      return false;
    }

    return Window.prototype._onKeyEvent.apply(this, arguments);
  }
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = DefaultApplicationWindow;
