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
 * @module core/application
 */

const Process = require('core/process.js');
const SettingsManager = require('core/settings-manager.js');
const WindowManager = require('core/windowmanager.js');

/**
 * Look at the 'ProcessEvent' for more.
 * The predefined events are as follows:
 *
 * <pre><code>
 *  init        When application was inited              => (settings, metadata, scheme)
 * </code></pre>
 * @typedef ApplicationEvent
 */

/////////////////////////////////////////////////////////////////////////////
// APPLICATION
/////////////////////////////////////////////////////////////////////////////

/**
 * Application Class
 *
 * The 'Process arguments' is a JSON object with the arguments the
 * Applications was launched with. Just like 'argv'
 *
 * <pre><b>
 * YOU CANNOT CANNOT USE THIS VIA 'new' KEYWORD.
 * </b></pre>
 *
 * @summary Class used for basis as an Application.
 *
 * @param   {String}            name        Process name
 * @param   {Object}            args        Process arguments
 * @param   {Metadata}          metadata    Application metadata
 * @param   {Object}            [settings]  Application settings
 *
 * @link https://os-js.org/manual/package/application/
 *
 * @abstract
 * @extends core/process~Process
 */
class Application extends Process {

  constructor(name, args, metadata, settings) {
    console.group('Application::constructor()', arguments);

    super(...arguments);

    /**
     * If Application was inited
     * @type {Boolean}
     */
    this.__inited     = false;

    /**
     * Registered main window
     * @type {OSjs.Core.Window}
     */
    this.__mainwindow = null;

    /**
     * Scheme reference
     * @type {OSjs.GUI.Scheme}
     */
    this.__scheme     = null;

    /**
     * Registered Windows
     * @type {OSjs.Core.Window[]}
     */
    this.__windows    = [];

    /**
     * Registered Settings
     * @type {Object}
     */
    this.__settings   = {};

    /**
     * If is in the process of destroying
     * @type {Boolean}
     */
    this.__destroying = false;

    try {
      this.__settings = SettingsManager.instance(name, settings || {});
    } catch ( e ) {
      console.warn('Application::construct()', 'An error occured while loading application settings', e);
      console.warn(e.stack);
      this.__settings = SettingsManager.instance(name, {});
    }

    console.groupEnd();
  }

  /**
   * Initialize the Application
   *
   * @param   {Object}            settings      Settings JSON
   * @param   {Metadata}          metadata      Metadata JSON
   * @param   {OSjs.GUI.Scheme}   [scheme]      GUI Scheme instance
   */
  init(settings, metadata, scheme) {

    const wm = WindowManager.instance;

    const focusLastWindow = () => {
      let last;

      if ( wm ) {
        this.__windows.forEach((win, i) => {
          if ( win ) {
            wm.addWindow(win);
            last = win;
          }
        });
      }

      if ( last ) {
        last._focus();
      }
    };

    if ( !this.__inited ) {
      console.debug('Application::init()', this.__pname);

      if ( scheme ) {
        this._setScheme(scheme);
      }

      this.__settings.set(null, settings);

      this.__inited = true;

      this.__evHandler.emit('init', [settings, metadata, scheme]);

      focusLastWindow();
    }
  }

  /**
   * Destroy the application
   *
   * @override
   */
  destroy(sourceWid) {
    if ( this.__destroying || this.__destroyed ) { // From 'process.js'
      return true;
    }
    this.__destroying = true;

    console.group('Application::destroy()', this.__pname);

    this.__windows.forEach((w) => {
      try {
        if ( w && w._wid !== sourceWid ) {
          w.destroy();
        }
      } catch ( e ) {
        console.warn('Application::destroy()', e, e.stack);
      }
    });

    this.__mainwindow = null;
    this.__settings = {};
    this.__windows = [];

    if ( this.__scheme && typeof this.__scheme.destroy === 'function' ) {
      this.__scheme.destroy();
    }
    this.__scheme = null;

    const result = super.destroy(...arguments);
    console.groupEnd();
    return result;
  }

  /**
   * Application has received a message
   *
   * @override
   */
  _onMessage(msg, obj, args) {
    if ( this.__destroying || this.__destroyed ) {
      return false;
    }

    if ( msg === 'destroyWindow' ) {
      if ( obj._name === this.__mainwindow ) {
        this.destroy(obj._wid);
      } else {
        this._removeWindow(obj);
      }
    } else if ( msg === 'attention' ) {
      if ( this.__windows.length && this.__windows[0] ) {
        this.__windows[0]._focus();
      }
    }

    return super._onMessage(...arguments);
  }

  /**
   * Default method for loading a Scheme file
   *
   * @TODO DEPRECATED This is kept for backward compability
   *
   * @function _loadScheme
   * @memberof OSjs.Core.Application#
   *
   * @param   {String}        str     Scheme filename
   * @param   {Function}      cb      Callback => fn(scheme)
   */
  _loadScheme(str, cb) {
    const Scheme = require('gui/scheme.js');

    const s = new Scheme(this._getResource(str));
    s.load(function __onApplicationLoadScheme(error, result) {
      if ( error ) {
        console.error('Application::_loadScheme()', error);
      }
      cb(s);
    });

    this._setScheme(s);
  }

  /**
   * Add a window to the application
   *
   * This will automatically add it to the WindowManager and show it to you
   *
   * @param   {OSjs.Core.Window}  w           The Window
   * @param   {Function}          [cb]        Callback for when window was successfully inited
   * @param   {Boolean}           [setmain]   Set if this is the main window (First window always will be)
   *
   * @return  {OSjs.Core.Window}
   */
  _addWindow(w, cb, setmain) {
    const Window = require('core/window.js');
    if ( !(w instanceof Window) ) {
      throw new TypeError('Application::_addWindow() expects Core.Window');
    }

    console.debug('Application::_addWindow()');

    this.__windows.push(w);
    if ( setmain || this.__windows.length === 1 ) {
      this.__mainwindow = w._name;
    }

    const wm = WindowManager.instance;
    if ( this.__inited ) {
      if ( wm ) {
        wm.addWindow(w);
      }

      if ( w._properties.start_focused ) {
        setTimeout(() => {
          w._focus();
        }, 5);
      }
    }

    (cb || function() {})(w, wm);

    return w;
  }

  /**
   * Removes given Window
   *
   * @param   {OSjs.Core.Window}      w     The Windo
   *
   * @return  {Boolean}
   */
  _removeWindow(w) {
    const Window = require('core/window.js');
    if ( !(w instanceof Window) ) {
      throw new TypeError('Application::_removeWindow() expects Core.Window');
    }

    return this.__windows.some((win, i) => {
      if ( win ) {
        if ( win._wid === w._wid ) {
          console.debug('Application::_removeWindow()', w._wid);
          win.destroy();

          this.__windows.splice(i, 1);

          return true;
        }
      }

      return true;
    });
  }

  /**
   * Gets a Window by X
   *
   * If you specify 'tag' the result will end with an Array because
   * these are not unique.
   *
   * If you specify 'null' it will try to return the 'main' window.
   *
   * @param   {String}    value      The value
   * @param   {Mixed}     key        The key to check for
   *
   * @return  {OSjs.Core.Window} Or null on error or nothing
   */
  _getWindow(value, key) {
    key = key || 'name';
    if ( value === null ) {
      value = this.__mainwindow;
    }

    let result = key === 'tag' ? [] : null;
    this.__windows.every((win, i) => {
      if ( win ) {
        if ( win['_' + key] === value ) {
          if ( key === 'tag' ) {
            result.push(win);
          } else {
            result = win;
            return false;
          }
        }
      }
      return true;
    });

    return result;
  }

  /**
   * Get a Window by Name
   *
   * @see OSjs.Core.Application#_getWindow
   *
   * @param {String}  name      Window Name
   *
   * @return {OSjs.Core.Window}
   */
  _getWindowByName(name) {
    return this._getWindow(name);
  }

  /**
   * Get Windows(!) by Tag
   *
   * @see OSjs.Core.Application#_getWindow
   *
   * @param {String}  tag       Tag name
   *
   * @return {OSjs.Core.Window[]}
   */
  _getWindowsByTag(tag) {
    return this._getWindow(tag, 'tag');
  }

  /**
   * Get a list of all windows
   *
   * @return {OSjs.Core.Window[]}
   */
  _getWindows() {
    return this.__windows;
  }

  /**
   * Get the "main" window
   *
   * @return {OSjs.Core.Window}
   */
  _getMainWindow() {
    return this._getWindow(this.__mainwindow, 'name');
  }

  /**
   * Get the sessions JSON
   *
   * @param   {String}    k       The settings key
   *
   * @return  {Object}    the current settings
   */
  _getSetting(k) {
    return this.__settings.get(k);
  }

  /**
   * Get the current application session data
   *
   * @return  {Object}    the current session data
   */
  _getSessionData() {
    const args = this.__args;
    const wins = this.__windows;
    const data = {name: this.__pname, args: args, windows: []};

    wins.forEach((win, i) => {
      if ( win && win._properties.allow_session ) {
        data.windows.push({
          name: win._name,
          dimension: win._dimension,
          position: win._position,
          state: win._state
        });
      }
    });

    return data;
  }

  /**
   * Gets the scheme instance
   *
   * @return OSjs.GUI.Scheme
   */
  _getScheme() {
    return this.__scheme;
  }

  /**
   * Set a setting
   *
   * @param   {String}              k             Key
   * @param   {String}              v             Value
   * @param   {Boolean|Function}    [save=true]   Save given setting(s) (can be a callback function)
   */
  _setSetting(k, v, save) {
    if ( typeof save === 'undefined' ) {
      save = true;
    }
    if ( arguments.length === 4 && typeof arguments[3] === 'function' ) {
      save = arguments[3];
    }
    this.__settings.set(k, v, save);
  }

  /**
   * Sets the scheme instance
   *
   * @see OSjs.GUI.Scheme
   *
   * @param   {OSjs.GUI.Scheme}      s       Scheme Ref
   */
  _setScheme(s) {
    this.__scheme = s;
  }

}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = Application;
