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
import Promise from 'bluebird';
import * as Main from 'core/main';
import * as Locales from 'core/locales';
import SplashScreen from 'core/splash';
import MountManager from 'core/mount-manager';
import SettingsManager from 'core/settings-manager';
import PackageManager from 'core/package-manager';
import SearchEngine from 'core/search-engine';
import Authenticator from 'core/authenticator';
import WindowManager from 'core/windowmanager';
import DialogWindow from 'core/dialog';
import Storage from 'core/storage';
import Process from 'core/process';
import Connection from 'core/connection';
import {addHook, triggerHook} from 'helpers/hooks';
import {getConfig, setConfig} from 'core/config';
import {playSound} from 'core/assets';
import * as GUI from 'utils/gui';
import * as Utils from 'utils/misc';
import Preloader from 'utils/preloader';
import Broadway from 'broadway/broadway';
import BroadwayConnection from 'broadway/connection';
import ServiceNotificationIcon from 'helpers/service-notification-icon';

let hasBooted = false;
let hasShutDown = false;

///////////////////////////////////////////////////////////////////////////////
// INITIALIZERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Initialize: Preloading
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initPreloading = (config) => new Promise((resolve, reject) => {
  const flatten = (list) => list.reduce((a, b) =>
    a.concat(Array.isArray(b) ? flatten(b) : b), []);

  Preloader.preload(flatten(config.Preloads)).then((result) => {
    return resolve();
  }).catch(reject);
});

/**
 * Initialize: Handlers
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initHandlers = (config) => new Promise((resolve, reject) => {
  const options = config.Connection;

  const connectionType = options.Type === 'standalone'
    ? 'http'
    : options.Type;

  let Authenticator, Connection, Storage;
  try {
    Authenticator = require('core/auth/' + options.Authenticator + '.js').default;
    Connection = require('core/connections/' + connectionType + '.js').default;
    Storage = require('core/storage/' + options.Storage + '.js').default;
  } catch ( e ) {
    reject(e);
    return;
  }

  const connection = new Connection();
  const authenticator = new Authenticator();
  const storage = new Storage();

  Promise.each([connection, storage, authenticator], (iter) => {
    return iter.init();
  }).then(resolve).catch(reject);
});

/**
 * Initialize: VFS
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initVFS = (config) => new Promise((resolve, reject) => {
  const mountPoints = SettingsManager.instance('VFS').get('mounts', []);

  MountManager.init().then((res) => {
    return MountManager.addList(mountPoints).then((res) => {
      return resolve(res);
    }).catch((e) => {
      console.warn('A module failed to load!', e);
      resolve();
    });
  }).catch(reject);
});

/**
 * Initialize: Settings Manager
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initSettingsManager = (config) => new Promise((resolve, reject) => {
  const pools = config.SettingsManager || {};

  Object.keys(pools).forEach(function(poolName) {
    console.debug('initSettingsManager()', 'initializes pool', poolName, pools[poolName]);
    SettingsManager.instance(poolName, pools[poolName] || {});
  });

  resolve();
});

/**
 * Initialize: Package Manager
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initPackageManager = (config) => new Promise((resolve, reject) => {
  const list = config.PreloadOnBoot || [];

  let metadata = {};
  try {
    // In case of standalone
    metadata = OSjs.getManifest();
  } catch ( e ) {}

  PackageManager.init(metadata).then(() => {
    return Promise.each(list, (iter) => {
      return new Promise((next) => {
        var pkg = PackageManager.getPackage(iter);
        if ( pkg && pkg.preload ) {
          Preloader.preload(pkg.preload).then(next).catch(() => next());
        } else {
          next();
        }
      });
    }).then(resolve).catch(reject);
  }).catch(reject);
});

/**
 * Initialize: Extensions
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initExtensions = (config) => new Promise((resolve, reject) => {
  if ( config.Broadway.enabled ) {
    addHook('onSessionLoaded', function() {
      BroadwayConnection.init();
    });

    addHook('onLogout', function() {
      BroadwayConnection.disconnect();
    });

    addHook('onBlurMenu', function() {
      Broadway.inject(null, 'blur');
    });
  }

  const packages = PackageManager.getPackages();

  const preloadExtensions = () => new Promise((resolve, reject) => {
    let preloads = [];
    Object.keys(packages).forEach((k) => {
      const iter = packages[k];
      if ( iter.type === 'extension' && iter.preload ) {
        preloads = preloads.concat(iter.preload);
      }
    });

    if ( preloads.length ) {
      Preloader.preload(preloads).then(resolve).catch(() => resolve());
    } else {
      resolve();
    }
  });

  const launchExtensions = () => new Promise((resolve, reject) => {
    const exts = Object.keys(OSjs.Extensions);

    Promise.each(exts, (entry) => {
      return new Promise((next) => {
        try {
          // FIXME
          const m = packages[entry];
          OSjs.Extensions[entry].init(m, () => next());
        } catch ( e ) {
          console.warn('Extension init failed', e.stack, e);
          next();
        }
      });
    }).then(resolve).catch((err) => {
      console.warn(err);
      reject(new Error(err));
    });
  });

  preloadExtensions().then(() => {
    return launchExtensions().then(resolve).catch(reject);
  }).catch(() => resolve());
});

/**
 * Initialize: Search Engine
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initSearchEngine = (config) => new Promise((resolve, reject) => {
  SearchEngine.init().then(resolve).catch(reject);
});

/**
 * Initialize: GUI
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initGUI = (config) => new Promise((resolve, reject) => {
  // FIXME
  const GUIDataView = require('gui/dataview.js').default;
  const GUIContainers = require('gui/elements/containers.js').default;
  const GUIVisual = require('gui/elements/visual.js').default;
  const GUITabs = require('gui/elements/tabs.js').default;
  const GUIRichText = require('gui/elements/richtext.js').default;
  const GUIMisc = require('gui/elements/misc.js').default;
  const GUIInputs = require('gui/elements/inputs.js').default;
  const GUITreeView = require('gui/elements/treeview.js').default;
  const GUIListView = require('gui/elements/listview.js').default;
  const GUIIconView = require('gui/elements/iconview.js').default;
  const GUIFileView = require('gui/elements/fileview.js').default;
  const GUIMenus = require('gui/elements/menus.js').default;

  OSjs.GUI.Element.register({
    tagName: 'gui-paned-view',
    type: 'container',
    allowedChildren: ['gui-paned-view-container']
  }, GUIContainers.GUIPanedView);

  OSjs.GUI.Element.register({
    tagName: 'gui-paned-view-container',
    type: 'container',
    allowedParents: ['gui-paned-view']
  }, GUIContainers.GUIPanedViewContainer);

  OSjs.GUI.Element.register({
    tagName: 'gui-button-bar',
    type: 'container'
  }, GUIContainers.GUIButtonBar);

  OSjs.GUI.Element.register({
    tagName: 'gui-toolbar',
    type: 'container'
  }, GUIContainers.GUIToolBar);

  OSjs.GUI.Element.register({
    tagName: 'gui-grid',
    type: 'container',
    allowedChildren: ['gui-grid-row']
  }, GUIContainers.GUIGrid);

  OSjs.GUI.Element.register({
    tagName: 'gui-grid-row',
    type: 'container',
    allowedChildren: ['gui-grid-entry'],
    allowedParents: ['gui-grid-row']
  }, GUIContainers.GUIGridRow);

  OSjs.GUI.Element.register({
    tagName: 'gui-grid-entry',
    type: 'container',
    allowedParents: ['gui-grid-row']
  }, GUIContainers.GUIGridEntry);

  OSjs.GUI.Element.register({
    tagName: 'gui-vbox',
    type: 'container',
    allowedChildren: ['gui-vbox-container']
  }, GUIContainers.GUIVBox);

  OSjs.GUI.Element.register({
    tagName: 'gui-vbox-container',
    type: 'container',
    allowedParents: ['gui-vbox']
  }, GUIContainers.GUIVBoxContainer);

  OSjs.GUI.Element.register({
    tagName: 'gui-hbox',
    type: 'container',
    allowedChildren: ['gui-hbox-container']
  }, GUIContainers.GUIHBox);

  OSjs.GUI.Element.register({
    tagName: 'gui-hbox-container',
    type: 'container',
    allowedParents: ['gui-hbox']
  }, GUIContainers.GUIHBoxContainer);

  OSjs.GUI.Element.register({
    tagName: 'gui-expander',
    type: 'container'
  }, GUIContainers.GUIExpander);

  OSjs.GUI.Element.register({
    tagName: 'gui-audio'
  }, GUIVisual.GUIAudio);

  OSjs.GUI.Element.register({
    tagName: 'gui-video'
  }, GUIVisual.GUIVideo);

  OSjs.GUI.Element.register({
    tagName: 'gui-image'
  }, GUIVisual.GUIImage);

  OSjs.GUI.Element.register({
    tagName: 'gui-canvas'
  }, GUIVisual.GUICanvas);

  OSjs.GUI.Element.register({
    tagName: 'gui-tabs'
  }, GUITabs.GUITabs);

  OSjs.GUI.Element.register({
    tagName: 'gui-richtext'
  }, GUIRichText.GUIRichText);

  OSjs.GUI.Element.register({
    tagName: 'gui-color-box'
  }, GUIMisc.GUIColorBox);

  OSjs.GUI.Element.register({
    tagName: 'gui-color-swatch'
  }, GUIMisc.GUIColorSwatch);

  OSjs.GUI.Element.register({
    tagName: 'gui-iframe'
  }, GUIMisc.GUIIframe);

  OSjs.GUI.Element.register({
    tagName: 'gui-progress-bar'
  }, GUIMisc.GUIProgressBar);

  OSjs.GUI.Element.register({
    tagName: 'gui-statusbar'
  }, GUIMisc.GUIStatusBar);

  OSjs.GUI.Element.register({
    tagName: 'gui-label'
  }, GUIInputs.GUILabel);

  OSjs.GUI.Element.register({
    tagName: 'gui-textarea',
    type: 'input'
  }, GUIInputs.GUITextarea);

  OSjs.GUI.Element.register({
    tagName: 'gui-text',
    type: 'input'
  }, GUIInputs.GUIText);

  OSjs.GUI.Element.register({
    tagName: 'gui-password',
    type: 'input'
  }, GUIInputs.GUIPassword);

  OSjs.GUI.Element.register({
    tagName: 'gui-file-upload',
    type: 'input'
  }, GUIInputs.GUIFileUpload);

  OSjs.GUI.Element.register({
    tagName: 'gui-radio',
    type: 'input'
  }, GUIInputs.GUIRadio);

  OSjs.GUI.Element.register({
    tagName: 'gui-checkbox',
    type: 'input'
  }, GUIInputs.GUICheckbox);

  OSjs.GUI.Element.register({
    tagName: 'gui-switch',
    type: 'input'
  }, GUIInputs.GUISwitch);

  OSjs.GUI.Element.register({
    tagName: 'gui-button',
    type: 'input'
  }, GUIInputs.GUIButton);

  OSjs.GUI.Element.register({
    tagName: 'gui-select',
    type: 'input'
  }, GUIInputs.GUISelect);

  OSjs.GUI.Element.register({
    tagName: 'gui-select-list',
    type: 'input'
  }, GUIInputs.GUISelectList);

  OSjs.GUI.Element.register({
    tagName: 'gui-slider',
    type: 'input'
  }, GUIInputs.GUISlider);

  OSjs.GUI.Element.register({
    tagName: 'gui-input-modal',
    type: 'input'
  }, GUIInputs.GUIInputModal);

  OSjs.GUI.Element.register({
    parent: GUIDataView,
    tagName: 'gui-tree-view'
  }, GUITreeView.GUITreeView);

  OSjs.GUI.Element.register({
    parent: GUIDataView,
    tagName: 'gui-list-view'
  }, GUIListView.GUIListView);

  OSjs.GUI.Element.register({
    parent: GUIDataView,
    tagName: 'gui-icon-view'
  }, GUIIconView.GUIIconView);

  OSjs.GUI.Element.register({
    tagName: 'gui-file-view'
  }, GUIFileView.GUIFileView);

  OSjs.GUI.Element.register({
    tagName: 'gui-menu-bar'
  }, GUIMenus.GUIMenuBar);

  OSjs.GUI.Element.register({
    tagName: 'gui-menu'
  }, GUIMenus.GUIMenu);

  OSjs.GUI.Element.register({
    tagName: 'gui-menu-entry'
  }, GUIMenus.GUIMenuEntry);

  resolve();
});

/**
 * Initialize: Window Manager
 * @param {Object} config Configuration
 * @return {Promise}
 */
const initWindowManager = (config) => new Promise((resolve, reject) => {
  const wmConfig = config.WM;

  if ( !wmConfig || !wmConfig.exec ) {
    reject(new Error(Locales._('ERR_CORE_INIT_NO_WM')));
  } else {
    Main.launch(wmConfig.exec, (wmConfig.args || {})).then((app) => {
      return app.setup().then(resolve).catch(reject);
    }).catch((error) => {
      reject(new Error(Locales._('ERR_CORE_INIT_WM_FAILED_FMT', error)));
    });
  }
});

///////////////////////////////////////////////////////////////////////////////
// MISC
///////////////////////////////////////////////////////////////////////////////

/*
 * Initializes the user session
 */
function initSession(config) {
  // FIXME
  console.debug('initSession()');

  var list = [];

  // In this case we merge the Autostart and the previous session together.
  // This ensures that items with autostart are loaded with correct
  // session data on restore. This is much better than relying on the internal
  // event/message system which does not trigger until after everything is loaded...
  // this does everything beforehand! :)
  //
  try {
    list = config.AutoStart;
  } catch ( e ) {
    console.warn('initSession()->autostart()', 'exception', e, e.stack);
  }

  var checkMap = {};
  var skipMap = [];
  list.forEach(function(iter, idx) {
    if ( typeof iter === 'string' ) {
      iter = list[idx] = {name: iter};
    }
    if ( skipMap.indexOf(iter.name) === -1 ) {
      if ( !checkMap[iter.name] ) {
        checkMap[iter.name] = idx;
        skipMap.push(iter.name);
      }
    }
  });

  return new Promise((resolve) => {
    Storage.instance.getLastSession().then((adds) => {
      adds.forEach(function(iter) {
        if ( typeof checkMap[iter.name] === 'undefined' ) {
          list.push(iter);
        } else {
          if ( iter.args ) {
            var refid = checkMap[iter.name];
            var ref = list[refid];
            if ( !ref.args ) {
              ref.args = {};
            }
            ref.args = Utils.mergeObject(ref.args, iter.args);
          }
        }
      });

      console.info('initSession()->autostart()', list);
      return Main.launchList(list).then(resolve).catch(resolve);
    }).catch((err) => {
      console.warn(err);
      resolve();
    });
  });
}

/*
 * When window gets an external message
 */
function onMessage(ev) {
  if ( ev && ev.data && typeof ev.data.message !== 'undefined' && typeof ev.data.pid === 'number' ) {
    console.debug('window::message()', ev.data);
    var proc = Process.getProcess(ev.data.pid);
    if ( proc ) {
      if ( typeof proc.onPostMessage === 'function' ) {
        proc.onPostMessage(ev.data.message, ev);
      }

      if ( typeof proc._getWindow === 'function' ) {
        var win = proc._getWindow(ev.data.wid, 'wid');
        if ( win ) {
          win.onPostMessage(ev.data.message, ev);
        }
      }
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
// API
///////////////////////////////////////////////////////////////////////////////

/**
 * Starts OS.js
 */
export function start() {
  if ( hasBooted || hasShutDown ) {
    return;
  }
  hasBooted = true;

  console.info('Starting OS.js');

  const config = OSjs.getConfig();
  const total = 9;

  Locales.init(config.Locale, config.LocaleOptions, config.Languages);

  SplashScreen.watermark(config);
  SplashScreen.show();

  setConfig(config);

  triggerHook('onInitialize');

  Promise.each([
    initPreloading,
    initHandlers,
    initVFS,
    initSettingsManager,
    initPackageManager,
    initExtensions,
    initSearchEngine,
    initGUI,
    initWindowManager
  ], (fn, index) => {
    return new Promise((resolve, reject) => {
      console.group('Initializing', index + 1, 'of', total);
      SplashScreen.update(index, total);

      return fn(config).then((res) => {
        console.groupEnd();
        return resolve(res);
      }).catch((err) => {
        console.groupEnd();
        return reject(new Error(err));
      });
    });
  }).then(() => {
    window.addEventListener('message', onMessage, false);

    triggerHook('onInited');
    SplashScreen.hide();

    var wm = WindowManager.instance;
    if ( wm ) {
      wm._fullyLoaded = true;
    }

    initSession(config).then(() => {
      return triggerHook('onSessionLoaded');
    });

    return true;
  }).catch((err) => {
    const title = Locales._('ERR_CORE_INIT_FAILED');
    const message = Locales._('ERR_CORE_INIT_FAILED_DESC');
    alert(title + '\n\n' + message);
    console.error(title, message, err);
  });
}

/**
 * Stops OS.js
 * @param {Boolean} [restart=false] Restart instead of full stop
 */
export function stop(restart = false) {
  if ( hasShutDown || !hasBooted ) {
    return;
  }

  hasShutDown = true;
  hasBooted = false;

  window.removeEventListener('message', onMessage, false);

  const wm = WindowManager.instance;
  if ( wm ) {
    wm.toggleFullscreen();
  }

  Preloader.clear();
  GUI.blurMenu();
  Process.killAll();
  ServiceNotificationIcon.destroy();
  SearchEngine.destroy();
  PackageManager.destroy();
  Authenticator.instance.destroy();
  Storage.instance.destroy();
  Connection.instance.destroy();

  triggerHook('onShutdown');

  console.warn('OS.js was shut down!');

  if ( !restart && getConfig('ReloadOnShutdown') === true ) {
    window.location.reload();
  }
}

/**
 * Restarts OS.js
 * @param {Boolean} [save=false] Save session
 */
export function restart(save = false) {
  const lout = (cb) => Authenticator.instance.logout().then(cb).catch(cb);

  const saveFunction = save && Storage.instance ? function(cb) {
    Storage.instance.saveSession()
      .then(() => lout(cb))
      .catch(() => lout(cb));
  } : lout;

  saveFunction(function() {
    console.clear();
    stop(true);
    start();
  });
}

/**
 * Perfors a log out of OS.js
 */
export function logout() {
  const storage = Storage.instance;
  const wm = WindowManager.instance;

  function signOut(save) {
    playSound('LOGOUT');

    const lout = (cb) => Authenticator.instance.logout().then(cb).catch(cb);

    if ( save ) {
      storage.saveSession()
        .then(() => lout(stop))
        .catch(() => lout(stop));
    } else {
      lout(stop);
    }
  }

  if ( wm ) {
    const user = Authenticator.instance.getUser() || {name: Locales._('LBL_UNKNOWN')};
    DialogWindow.create('Confirm', {
      title: Locales._('DIALOG_LOGOUT_TITLE'),
      message: Locales._('DIALOG_LOGOUT_MSG_FMT', user.name)
    }, function(ev, btn) {
      if ( ['no', 'yes'].indexOf(btn) !== -1 ) {
        signOut(btn === 'yes');
      }
    });
  } else {
    signOut(true);
  }
}

/**
 * Checks if OS.js is running
 * @return {Boolean}
 */
export function running() {
  return !hasShutDown;
}
