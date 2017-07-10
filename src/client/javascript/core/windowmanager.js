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
 * @module core/windowmanager
 */
import * as DOM from 'utils/dom';
import * as GUI from 'utils/gui';
import * as Events from 'utils/events';
import * as Utils from 'utils/misc';

import Process from 'core/process';
import Window from 'core/window';
import DialogWindow from 'core/dialog';
import Connection from 'core/connection';
import SettingsManager from 'core/settings-manager';

import {_} from 'core/locales';
import {getConfig} from 'core/config';

/////////////////////////////////////////////////////////////////////////////
// WINDOW MOVEMENT BEHAVIOUR
/////////////////////////////////////////////////////////////////////////////

/*
 * Holds information about current behaviour
 */
function BehaviourState(wm, win, action, mousePosition) {
  this.win = win;
  this.$element = win._$element;
  this.$top = win._$top;
  this.$handle = win._$resize;

  this.rectWorkspace  = wm.getWindowSpace(true);
  this.rectWindow     = {
    x: win._position.x,
    y: win._position.y,
    w: win._dimension.w,
    h: win._dimension.h,
    r: win._dimension.w + win._position.x,
    b: win._dimension.h + win._position.y
  };

  const theme = Utils.cloneObject(wm.getStyleTheme(true, true));
  if ( !theme.style ) {
    theme.style = {'window': {margin: 0, border: 0}};
  }

  this.theme = {
    topMargin: theme.style.window.margin || 0, // FIXME
    borderSize: theme.style.window.border || 0
  };

  this.snapping   = {
    cornerSize: wm.getSetting('windowCornerSnap') || 0,
    windowSize: wm.getSetting('windowSnap') || 0
  };

  this.action     = action;
  this.moved      = false;
  this.direction  = null;
  this.startX     = mousePosition.x;
  this.startY     = mousePosition.y;
  this.minWidth   = win._properties.min_width;
  this.minHeight  = win._properties.min_height;

  const windowRects = [];
  wm.getWindows().forEach((w) => {
    if ( w && w._wid !== win._wid ) {
      const pos = w._position;
      const dim = w._dimension;
      const rect = {
        left: pos.x - this.theme.borderSize,
        top: pos.y - this.theme.borderSize,
        width: dim.w + (this.theme.borderSize * 2),
        height: dim.h + (this.theme.borderSize * 2) + this.theme.topMargin
      };

      rect.right = rect.left + rect.width;
      rect.bottom = (pos.y + dim.h) + this.theme.topMargin + this.theme.borderSize;//rect.top + rect.height;

      windowRects.push(rect);
    }
  });

  this.snapRects = windowRects;
}

BehaviourState.prototype.getRect = function() {
  const win = this.win;

  return {
    left: win._position.x,
    top: win._position.y,
    width: win._dimension.w,
    height: win._dimension.h
  };
};

BehaviourState.prototype.calculateDirection = function() {
  const dir = DOM.$position(this.$handle);
  const dirX = this.startX - dir.left;
  const dirY = this.startY - dir.top;
  const dirD = 20;

  const checks = {
    nw: (dirX <= dirD) && (dirY <= dirD),
    n: (dirX > dirD) && (dirY <= dirD),
    w: (dirX <= dirD) && (dirY >= dirD),
    ne: (dirX >= (dir.width - dirD)) && (dirY <= dirD),
    e: (dirX >= (dir.width - dirD)) && (dirY > dirD),
    se: (dirX >= (dir.width - dirD)) && (dirY >= (dir.height - dirD)),
    sw: (dirX <= dirD) && (dirY >= (dir.height - dirD))
  };

  let direction = 's';
  Object.keys(checks).forEach(function(k) {
    if ( checks[k] ) {
      direction = k;
    }
  });

  this.direction = direction;
};

/*
 * Window Behavour Abstraction
 */
function createWindowBehaviour(win, wm) {
  let current = null;
  let newRect = {};

  /*
   * Resizing action
   */
  function onWindowResize(ev, mousePosition, dx, dy) {
    if ( !current || !current.direction ) {
      return false;
    }

    let nw, nh, nl, nt;

    (function() { // North/South
      if ( current.direction.indexOf('s') !== -1 ) {
        nh = current.rectWindow.h + dy;

        newRect.height = Math.max(current.minHeight, nh);
      } else if ( current.direction.indexOf('n') !== -1 ) {
        nh = current.rectWindow.h - dy;
        nt = current.rectWindow.y + dy;

        if ( nt < current.rectWorkspace.top ) {
          nt = current.rectWorkspace.top;
          nh = newRect.height;
        } else {
          if ( nh < current.minHeight ) {
            nt = current.rectWindow.b - current.minHeight;
          }
        }

        newRect.height = Math.max(current.minHeight, nh);
        newRect.top = nt;
      }
    })();

    (function() { // East/West
      if ( current.direction.indexOf('e') !== -1 ) {
        nw = current.rectWindow.w + dx;

        newRect.width = Math.max(current.minWidth, nw);
      } else if ( current.direction.indexOf('w') !== -1 ) {
        nw = current.rectWindow.w - dx;
        nl = current.rectWindow.x + dx;

        if ( nw < current.minWidth ) {
          nl = current.rectWindow.r - current.minWidth;
        }

        newRect.width = Math.max(current.minWidth, nw);
        newRect.left = nl;
      }
    })();

    return newRect;
  }

  /*
   * Movement action
   */
  function onWindowMove(ev, mousePosition, dx, dy) {
    let newWidth = null;
    let newHeight = null;
    let newLeft = current.rectWindow.x + dx;
    let newTop = current.rectWindow.y + dy;

    const borderSize = current.theme.borderSize;
    const topMargin = current.theme.topMargin;
    const cornerSnapSize = current.snapping.cornerSize;
    const windowSnapSize = current.snapping.windowSize;

    if ( newTop < current.rectWorkspace.top ) {
      newTop = current.rectWorkspace.top;
    }

    let newRight = newLeft + current.rectWindow.w + (borderSize * 2);
    let newBottom = newTop + current.rectWindow.h + topMargin + (borderSize);

    // 8-directional corner window snapping
    if ( cornerSnapSize > 0 ) {
      if ( ((newLeft - borderSize) <= cornerSnapSize) && ((newLeft - borderSize) >= -cornerSnapSize) ) { // Left
        newLeft = borderSize;
      } else if ( (newRight >= (current.rectWorkspace.width - cornerSnapSize)) && (newRight <= (current.rectWorkspace.width + cornerSnapSize)) ) { // Right
        newLeft = current.rectWorkspace.width - current.rectWindow.w - borderSize;
      }
      if ( (newTop <= (current.rectWorkspace.top + cornerSnapSize)) && (newTop >= (current.rectWorkspace.top - cornerSnapSize)) ) { // Top
        newTop = current.rectWorkspace.top + (borderSize);
      } else if (
        (newBottom >= ((current.rectWorkspace.height + current.rectWorkspace.top) - cornerSnapSize)) &&
          (newBottom <= ((current.rectWorkspace.height + current.rectWorkspace.top) + cornerSnapSize))
      ) { // Bottom
        newTop = (current.rectWorkspace.height + current.rectWorkspace.top) - current.rectWindow.h - topMargin - borderSize;
      }
    }

    // Snapping to other windows
    if ( windowSnapSize > 0 ) {
      current.snapRects.every(function(rect) {
        // >
        if ( newRight >= (rect.left - windowSnapSize) && newRight <= (rect.left + windowSnapSize) ) { // Left
          newLeft = rect.left - (current.rectWindow.w + (borderSize * 2));
          return false;
        }

        // <
        if ( (newLeft - borderSize) <= (rect.right + windowSnapSize) && (newLeft - borderSize) >= (rect.right - windowSnapSize) ) { // Right
          newLeft = rect.right + (borderSize * 2);
          return false;
        }

        // \/
        if ( newBottom >= (rect.top - windowSnapSize) && newBottom <= (rect.top + windowSnapSize) ) { // Top
          newTop = rect.top - (current.rectWindow.h + (borderSize * 2) + topMargin);
          return false;
        }

        // /\
        if ( newTop <= (rect.bottom + windowSnapSize) && newTop >= (rect.bottom - windowSnapSize) ) { // Bottom
          newTop = rect.bottom + borderSize * 2;
          return false;
        }

        return true;
      });

    }

    return {left: newLeft, top: newTop, width: newWidth, height: newHeight};
  }

  /*
   * When mouse button is released
   */
  function onMouseUp(ev, action, win, mousePosition) {
    if ( !current ) {
      return;
    }

    if ( current.moved ) {
      if ( action === 'move' ) {
        win._onChange('move', true);
        win._emit('moved', [win._position.x, win._position.y]);
      } else if ( action === 'resize' ) {
        win._onChange('resize', true);
        win._emit('resized', [win._dimension.w, win._dimension.h]);
      }
    }

    current.$element.setAttribute('data-hint', '');

    win._emit('postop');

    current = null;
  }

  /*
   * When mouse is moved
   */
  function onMouseMove(ev, action, win, mousePosition) {
    if ( !wm.getMouseLocked() || !action || !current ) {
      return;
    }

    ev.preventDefault();

    let result;

    const dx = mousePosition.x - current.startX;
    const dy = mousePosition.y - current.startY;

    if ( action === 'move' ) {
      result = onWindowMove(ev, mousePosition, dx, dy);
    } else {
      result = onWindowResize(ev, mousePosition, dx, dy);
    }

    if ( result ) {
      if ( result.left !== null && result.top !== null ) {
        win._move(result.left, result.top);
        win._emit('move', [result.left, result.top]);
      }
      if ( result.width !== null && result.height !== null ) {
        win._resize(result.width, result.height, true);
        win._emit('resize', [result.width, result.height]);
      }
    }

    current.moved = true;
  }

  /*
   * When mouse button is pressed
   */
  function onMouseDown(ev, action, win, mousePosition) {
    GUI.blurMenu();
    ev.preventDefault();

    if ( win._state.maximized ) {
      return;
    }

    current = new BehaviourState(wm, win, action, mousePosition);
    newRect = {};

    win._focus();

    if ( action === 'move' ) {
      current.$element.setAttribute('data-hint', 'moving');
    } else {
      current.calculateDirection();
      current.$element.setAttribute('data-hint', 'resizing');

      newRect = current.getRect();
    }

    win._emit('preop');

    function _onMouseMove(ev, pos) {
      if ( wm._mouselock ) {
        onMouseMove(ev, action, win, pos);
      }
    }
    function _onMouseUp(ev, pos) {
      onMouseUp(ev, action, win, pos);
      Events.$unbind(document, 'mousemove:movewindow');
      Events.$unbind(document, 'mouseup:movewindowstop');
    }

    Events.$bind(document, 'mousemove:movewindow', _onMouseMove, false);
    Events.$bind(document, 'mouseup:movewindowstop', _onMouseUp, false);
  }

  /*
   * Register a window
   */
  if ( win._properties.allow_move ) {
    Events.$bind(win._$top, 'mousedown', (ev, pos) => {
      onMouseDown(ev, 'move', win, pos);
    }, true);
  }
  if ( win._properties.allow_resize ) {
    Events.$bind(win._$resize, 'mousedown', (ev, pos) => {
      onMouseDown(ev, 'resize', win, pos);
    });
  }
}

/////////////////////////////////////////////////////////////////////////////
// WINDOW MANAGER
/////////////////////////////////////////////////////////////////////////////

/**
 * WindowManager Process Class
 *
 * @example
 * require(...).instance
 *
 * @summary Class used for basis as a Window Manager.
 *
 * @abstract
 * @extends core/process~Process
 */
export default class WindowManager extends Process {

  static get instance() {
    return window.___osjs__wm_instance;
  }

  /**
   * @param   {String}                      name      Window Manager name
   * @param   {OSjs.Core.WindowManager}     ref       Constructed instance ref
   * @param   {Object}                      args      Constructed arguments
   * @param   {Object}                      metadata  Package Metadata
   * @param   {Object}                      settings  Restored settings
   */
  constructor(name, ref, args, metadata, settings) {
    console.group('WindowManager::constructor()');
    console.debug('Name', name);
    console.debug('Arguments', args);

    super(name, args, metadata);

    /* eslint consistent-this: "warn" */
    window.___osjs__wm_instance = this;

    this._$notifications = null;
    this._windows        = [];
    this._settings       = SettingsManager.instance(name, settings);
    this._currentWin     = null;
    this._lastWin        = null;
    this._mouselock      = true;
    this._stylesheet     = null;
    this._sessionLoaded  = false;
    this._fullyLoaded    = false;
    this._isResponsive   = false;
    this._responsiveRes  = 800;
    this._scheme         = null;
    this._dcTimeout      = null;

    // Important for usage as "Application"
    this.__name    = (name || 'WindowManager');
    this.__path    = metadata.path;
    this.__iter    = metadata.iter;

    Connection.instance.subscribe('online', () => {
      this.notification({title: _('LBL_INFO'), message: _('CONNECTION_RESTORED')});
    });

    Connection.instance.subscribe('offline', (reconnecting) => {
      this.notification({title: _('LBL_WARNING'), message: _(reconnecting ? 'CONNECTION_RESTORE_FAILED' : 'CONNECTION_LOST')});
    });

    console.groupEnd();
  }

  /**
   * Destroy the WindowManager
   *
   * @return {Boolean}
   */
  destroy() {
    console.debug('WindowManager::destroy()');

    this.destroyStylesheet();

    Events.$unbind(document, 'mouseout:windowmanager');
    Events.$unbind(document, 'mouseenter:windowmanager');

    // Destroy all windows
    this._windows.forEach((win, i) => {
      if ( win ) {
        win.destroy(true);
        this._windows[i] = null;
      }
    });

    if ( this._scheme ) {
      this._scheme.destroy();
    }

    this._windows = [];
    this._currentWin = null;
    this._lastWin = null;
    this._scheme = null;

    window.___osjs__wm_instance = null;

    return super.destroy();
  }

  /**
   * Initialize the WindowManager
   *
   * @param   {Object}            metadata      Package metadata
   * @param   {Object}            settings      Package settings
   * @param   {OSjs.GUI.Scheme}   [scheme]      GUI Scheme instance
   */
  init(metadata, settings, scheme) {
    console.debug('WindowManager::init()');

    this._scheme = scheme;

    Events.$bind(document, 'mouseout:windowmanager', (ev) => {
      this._onMouseLeave(ev);
    });
    Events.$bind(document, 'mouseenter:windowmanager', (ev) => {
      this._onMouseLeave(ev);
    });

    const queries = this.getDefaultSetting('mediaQueries') || {};

    let maxWidth = 0;
    Object.keys(queries).forEach((q) => {
      maxWidth = Math.max(maxWidth, queries[q]);
    });
    this._responsiveRes = maxWidth || 800;

    this.resize();
  }

  /**
   * Setup features
   *
   * THIS IS IMPLEMENTED IN COREWM
   *
   * @param   {Function}  cb        Callback
   */
  setup(cb) {
    // Implement in your WM
    cb();
  }

  /**
   * Get a Window by name
   *
   * @param   {String}      name        Window name
   *
   * @return  {OSjs.Core.Window}
   */
  getWindow(name) {
    let result = null;
    this._windows.every((w) => {
      if ( w && w._name === name ) {
        result = w;
      }
      return result ? false : true;
    });
    return result;
  }

  /**
   * Add a Window
   *
   * @throws {Error} If invalid window is given
   *
   * @param   {OSjs.Core.Window}      w         Window reference
   * @param   {Boolean}               focus     Focus the window
   *
   * @return  {OSjs.Core.Window}                The added window
   */
  addWindow(w, focus) {
    if ( !(w instanceof Window) ) {
      console.warn('WindowManager::addWindow()', 'Got', w);
      throw new TypeError('given argument was not instance of Core.Window');
    }
    console.debug('WindowManager::addWindow()');

    try {
      w.init(this, w._app, w._scheme);
    } catch ( e ) {
      console.error('WindowManager::addWindow()', '=>', 'Window::init()', e, e.stack);
    }

    createWindowBehaviour(w, this);

    this._windows.push(w);
    w._inited();

    if ( focus === true || w instanceof DialogWindow ) {
      setTimeout(() => {
        w._focus();
      }, 10);
    }

    return w;
  }

  /**
   * Remove a Window
   *
   * @throws {Error} If invalid window is given
   *
   * @param   {OSjs.Core.Window}      w         Window reference
   *
   * @return  {Boolean}               On success
   */
  removeWindow(w) {
    if ( !(w instanceof Window) ) {
      console.warn('WindowManager::removeWindow()', 'Got', w);
      throw new TypeError('given argument was not instance of Core.Window');
    }
    console.debug('WindowManager::removeWindow()', w._wid);

    let result = false;
    this._windows.every((win, i) => {
      if ( win && win._wid === w._wid ) {
        this._windows[i] = null;
        result = true;
      }
      return result ? false : true;
    });

    return result;
  }

  /**
   * Set WindowManager settings
   *
   * OVERRIDE THIS IN YOUR WM IMPLEMENTATION
   *
   * @param   {Object}      settings              JSON Settings
   * @param   {Boolean}     force                 If forced, no merging will take place
   * @param   {Boolean}     save                  Saves settings
   * @param   {Boolean}     [triggerWatch=true]   Trigger change event for watchers
   *
   * @return  {Boolean}                     On success
   */
  applySettings(settings, force, save, triggerWatch) {
    settings = settings || {};
    console.debug('WindowManager::applySettings()', 'forced?', force);

    const result = force ? settings : Utils.mergeObject(this._settings.get(), settings);
    this._settings.set(null, result, save, triggerWatch);

    return true;
  }

  /**
   * Create Window Manager self-contained CSS from this object
   *
   * {
   *    '.classname': {
   *      'background-image': 'url()'
   *    }
   * }
   *
   * @param   {Object}    styles      Style object
   * @param   {String}    [rawStyles] Raw CSS data
   */
  createStylesheet(styles, rawStyles) {
    this.destroyStylesheet();

    let innerHTML = [];
    Object.keys(styles).forEach((key) => {
      let rules = [];
      Object.keys(styles[key]).forEach((r) => {
        rules.push(Utils.format('    {0}: {1};', r, styles[key][r]));
      });

      rules = rules.join('\n');
      innerHTML.push(Utils.format('{0} {\n{1}\n}', key, rules));
    });

    innerHTML = innerHTML.join('\n');
    if ( rawStyles ) {
      innerHTML += '\n' + rawStyles;
    }

    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = 'WMGeneratedStyles';
    style.innerHTML = innerHTML;
    document.getElementsByTagName('head')[0].appendChild(style);

    this._stylesheet = style;
  }

  /**
   * Destroy Window Manager self-contained CSS
   */
  destroyStylesheet() {
    if ( this._stylesheet ) {
      if ( this._stylesheet.parentNode ) {
        this._stylesheet.parentNode.removeChild(this._stylesheet);
      }
    }
    this._stylesheet = null;
  }

  /**
   * When Key Down Event received
   *
   * @param   {Event}                  ev      DOM Event
   * @param   {OSjs.CoreWindow}        win     Active window
   */
  onKeyDown(ev, win) {
    // Implement in your WM
  }

  /**
   * When orientation of device has changed
   *
   * @param   {Event}    ev             DOM Event
   * @param   {String}   orientation    Orientation string
   */
  onOrientationChange(ev, orientation) {
    console.info('ORIENTATION CHANGED', ev, orientation);

    this._onDisplayChange();
  }

  /**
   * When size of the device display has been changed
   *
   * @param   {Event}    ev             DOM Event
   */
  onResize(ev) {
    this._onDisplayChange();
  }

  /**
   * When session has been loaded
   *
   * @return {Boolean}
   */
  onSessionLoaded() {
    if ( this._sessionLoaded ) {
      return false;
    }

    this._sessionLoaded = true;
    return true;
  }

  resize(ev, rect) {
    // Implement in your WM
    this._isResponsive = window.innerWidth <= 1024;

    this.onResize(ev);
  }

  /**
   * Create a desktop notification.
   *
   * THIS IS IMPLEMENTED IN COREWM
   *
   * @param   {Object}    opts                   Notification options
   * @param   {String}    opts.icon              What icon to display
   * @param   {String}    opts.title             What title to display
   * @param   {String}    opts.message           What message to display
   * @param   {Number}    [opts.timeout=5000]    Timeout
   * @param   {Function}  opts.onClick           Event callback on click => fn(ev)
   */
  notification() {
    // Implement in your WM
  }

  /**
   * Create a panel notification icon.
   *
   * THIS IS IMPLEMENTED IN COREWM
   *
   * FOR OPTIONS SEE NotificationAreaItem IN CoreWM !
   *
   * @param   {String}    name      Internal name (unique)
   * @param   {Object}    opts      Notification options
   * @param   {Number}    [panelId] Panel ID
   *
   * @return  OSjs.Applications.CoreWM.NotificationAreaItem
   */
  createNotificationIcon() {
    // Implement in your WM
    return null;
  }

  /**
   * Remove a panel notification icon.
   *
   * THIS IS IMPLEMENTED IN COREWM
   *
   * @param   {String}    name      Internal name (unique)
   * @param   {Number}    [panelId] Panel ID
   *
   * @return  {Boolean}
   */
  removeNotificationIcon() {
    // Implement in your WM
    return false;
  }

  /**
   * Whenever a window event occurs
   *
   * THIS IS IMPLEMENTED IN COREWM
   *
   * @param   {String}            ev      Event name
   * @param   {OSjs.Core.Window}  win     Window ref
   *
   * @return  {Boolean}
   */
  eventWindow(ev, win) {
    // Implement in your WM
    return false;
  }

  /**
   * Show Settings Window (Application)
   *
   * THIS IS IMPLEMENTED IN COREWM
   */
  showSettings() {
    // Implement in your WM
  }

  _onMouseEnter(ev) {
    this._mouselock = true;
  }

  _onMouseLeave(ev) {
    const from = ev.relatedTarget || ev.toElement;
    if ( !from || from.nodeName === 'HTML' ) {
      this._mouselock = false;
    } else {
      this._mouselock = true;
    }
  }

  _onDisplayChange() {
    this._dcTimeout = clearTimeout(this._dcTimeout);
    this._dcTimeout = setTimeout(() => {
      if ( !this._windows ) {
        return;
      }

      this._windows.filter((w) => {
        return !!w;
      }).forEach((w) => {
        w._onResize();
        w._emit('resize');
      });
    }, 100);

    document.body.setAttribute('data-responsive', String(self._isResponsive));
  }

  /**
   * Get default Settings
   *
   * @return  {Object}      JSON Data
   */
  getDefaultSetting() {
    // Implement in your WM
    return null;
  }

  /**
   * Get panel
   *
   * @return {OSjs.Applications.CoreWM.Panel}
   */
  getPanel() {
    // Implement in your WM
    return null;
  }

  /**
   * Gets all panels
   *
   * @return  {OSjs.Packages.CoreWM.Panel[]}       Panel List
   */
  getPanels() {
    // Implement in your WM
    return [];
  }

  /**
   * Gets current Style theme
   *
   * @param   {Boolean}    returnMetadata      Return theme metadata instead of name
   * @param   {Boolean}    [convert=false]     Converts the measures into px
   *
   * @return  {String}                      Or JSON
   */
  getStyleTheme(returnMetadata) {
    return returnMetadata ? {} : 'default';
  }

  /**
   * Gets current Sound theme
   *
   * @return  {String}
   */
  getSoundTheme() {
    return 'default';
  }

  /**
   * Gets sound filename from key
   *
   * @param  {String}     k       Sound name key
   *
   * @return  {String}
   */
  getSoundFilename(k) {
    return null;
  }

  /**
   * Gets current Icon theme
   *
   * @return  {String}
   */
  getIconTheme() {
    return 'default';
  }

  /**
   * Gets a list of Style themes
   *
   * @return  {String[]}   The list of themes
   */
  getStyleThemes() {
    return getConfig('Styles', []);
  }

  /**
   * Gets a list of Sound themes
   *
   * @return  {String[]}   The list of themes
   */
  getSoundThemes() {
    return getConfig('Sounds', []);
  }

  /**
   * Gets a list of Icon themes
   *
   * @return  {String[]}   The list of themes
   */
  getIconThemes() {
    return getConfig('Icons', []);
  }

  /**
   * Sets a setting
   *
   * @param   {String}      k       Key
   * @param   {Mixed}       v       Value
   *
   * @return  {Boolean}             On success
   */
  setSetting(k, v) {
    return this._settings.set(k, v);
  }

  /**
   * Gets the rectangle for window space
   *
   * @return    {Object} rectangle
   */
  getWindowSpace() {
    return {
      top: 0,
      left: 0,
      width: document.body.offsetWidth,
      height: document.body.offsetHeight
    };
  }

  /**
   * Get next window position
   *
   * @return    {Object} rectangle
   */
  getWindowPosition() {
    const winCount = this._windows.reduce(function(count, win) {
      return win === null ? count : (count + 1);
    }, 0);
    return {x: 10 * winCount, y: 10 * winCount};
  }

  /**
   * Gets a setting
   *
   * @param   {String}    k     Key
   *
   * @return  {Mixed}           Setting value or 'null'
   */
  getSetting(k) {
    return this._settings.get(k);
  }

  /**
   * Gets all settings
   *
   * @return    {Object}        JSON With all settings
   */
  getSettings() {
    return this._settings.get();
  }

  /**
   * Gets all Windows
   *
   * @return    {OSjs.Core.Window[]}           List of all Windows
   */
  getWindows() {
    return this._windows;
  }

  /**
   * Gets current Window
   *
   * @return {OSjs.Core.Window}        Current Window or 'null'
   */
  getCurrentWindow() {
    return this._currentWin;
  }

  /**
   * Sets the current Window
   *
   * @param   {OSjs.Core.Window}    w       Window
   */
  setCurrentWindow(w) {
    this._currentWin = w || null;
  }

  /**
   * Gets previous Window
   *
   * @return {OSjs.Core.Window}        Current Window or 'null'
   */
  getLastWindow() {
    return this._lastWin;
  }

  /**
   * Sets the last Window
   *
   * @param   {OSjs.Core.Window}    w       Window
   */
  setLastWindow(w) {
    this._lastWin = w || null;
  }

  /**
   * If the pointer is inside the browser window
   *
   * @return  {Boolean}
   */
  getMouseLocked() {
    return this._mouselock;
  }

}

