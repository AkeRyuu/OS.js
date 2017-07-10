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
import * as FS from 'utils/fs';
import * as DOM from 'utils/dom';
import * as GUI from 'utils/gui';
import * as Utils from 'utils/misc';
import * as Config from 'core/config';
import * as Compability from 'utils/compability';
import * as Assets from 'core/assets';
import * as Main from 'core/main';
import * as VFS from 'vfs/fs';
import {_} from 'core/locales';

import GUIElement from 'gui/element';
import GUIScheme from 'gui/scheme';
import FileMetadata from 'vfs/file';
import Preloader from 'utils/preloader';
import SettingsManager from 'core/settings-manager';
import PackageManager from 'core/package-manager';
import WindowManager from 'core/windowmanager';
import Authenticator from 'core/authenticator';
import Storage from 'core/storage';
import Dialog from 'core/dialog';
import Process from 'core/process';
import Application from 'core/application';

/**
 * @namespace API
 * @memberof OSjs
 */

/**
 * @namespace Core
 * @memberof OSjs
 */

/**
 * @namespace Utils
 * @memberof OSjs
 */

/**
 * @namespace Helpers
 * @memberof OSjs
 */

/*@
 * Please note that there are some more methods defined in `process.js`
 */

let _LAUNCHING = [];

/////////////////////////////////////////////////////////////////////////////
// SERVICERING
/////////////////////////////////////////////////////////////////////////////

/*
 * Service Notification Icon Class
 *
 * This is a private class and can only be retrieved through
 * OSjs.module.exports.getServiceNotificationIcon()
 */
function ServiceNotificationIcon() {
  this.entries = {};
  this.size = 0;
  this.notif = null;

  this.init();
}

ServiceNotificationIcon.prototype.init = function() {
  const wm = WindowManager.instance;

  const show = (ev) => {
    this.displayMenu(ev);
    return false;
  };

  if ( wm ) {
    this.notif = wm.createNotificationIcon('ServiceNotificationIcon', {
      image: Assets.getIcon('status/dialog-password.png'),
      onContextMenu: show,
      onClick: show,
      onInited: (el, img) => {
        this._updateIcon();
      }
    });

    this._updateIcon();
  }
};

/*
 * Destroys the notification icon
 */
ServiceNotificationIcon.prototype.destroy = function() {
  const wm = WindowManager.instance;
  if ( wm ) {
    wm.removeNotificationIcon('ServiceNotificationIcon');
  }

  this.size = 0;
  this.entries = {};
  this.notif = null;
};

ServiceNotificationIcon.prototype._updateIcon = function() {
  if ( this.notif ) {
    if ( this.notif.$container ) {
      this.notif.$container.style.display = this.size ? 'inline-block' : 'none';
    }
    this.notif.setTitle(_('SERVICENOTIFICATION_TOOLTIP', this.size.toString()));
  }
};

/*
 * Show the menu
 */
ServiceNotificationIcon.prototype.displayMenu = function(ev) {
  const menu = [];
  const entries = this.entries;

  Object.keys(entries).forEach((name) => {
    menu.push({
      title: name,
      menu: entries[name]
    });
  });

  GUI.createMenu(menu, ev);
};

/*
 * Adds an entry
 */
ServiceNotificationIcon.prototype.add = function(name, menu) {
  if ( !this.entries[name] ) {
    this.entries[name] = menu;

    this.size++;
    this._updateIcon();
  }
};

/*
 * Removes an entry
 */
ServiceNotificationIcon.prototype.remove = function(name) {
  if ( this.entries[name] ) {
    delete this.entries[name];
    this.size--;
    this._updateIcon();
  }
};

/////////////////////////////////////////////////////////////////////////////
// PROCESS API METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Open a file
 *
 * @function open
 * @memberof OSjs.API
 * @see OSjs.module.exports.launch
 * @throws {Error} On invalid arguments
 *
 * @param   {OSjs.VFS.File}   file          The File reference (can also be a tuple with 'path' and 'mime')
 * @param   {Object}          launchArgs    Arguments to send to process launch function
 */
module.exports.open = function(file, launchArgs) {
  launchArgs = launchArgs || {};

  if ( !file.path ) {
    throw new Error('Cannot API::open() without a path');
  }

  const wm = WindowManager.instance;
  const args = {file: file};

  function getApplicationNameByFile(file, forceList, callback) {
    if ( !(file instanceof FileMetadata) ) {
      throw new Error('This function excepts a OSjs.VFS.File object');
    }

    const val = SettingsManager.get('DefaultApplication', file.mime);

    console.debug('getApplicationNameByFile()', 'default application', val);
    if ( !forceList && val ) {
      if ( PackageManager.getPackage(val) ) {
        callback([val]);
        return;
      }
    }
    callback(PackageManager.getPackagesByMime(file.mime));
  }

  function setDefaultApplication(mime, app, callback) {
    callback = callback || function() {};
    console.debug('setDefaultApplication()', mime, app);
    SettingsManager.set('DefaultApplication', mime, app);
    SettingsManager.save('DefaultApplication', callback);
  }

  function _launch(name) {
    if ( name ) {
      module.exports.launch(name, args, launchArgs.onFinished, launchArgs.onError, launchArgs.onConstructed);
    }
  }

  function _launchApp(name, ar) {
    console.groupEnd();
    module.exports.launch(name, ar);
  }

  function _onDone(app) {
    console.debug('Found', app.length, 'applications supporting this mime');
    console.groupEnd();
    if ( app.length ) {

      if ( app.length === 1 ) {
        _launch(app[0]);
      } else {
        if ( wm ) {
          Dialog.create('ApplicationChooser', {
            file: file,
            list: app
          }, (ev, btn, result) => {
            if ( btn !== 'ok' ) {
              return;
            }

            _launch(result.name);

            setDefaultApplication(file.mime, result.useDefault ? result.name : null);
          });
        } else {
          module.exports.error(_('ERR_FILE_OPEN'),
                               _('ERR_FILE_OPEN_FMT', file.path),
                               _('ERR_NO_WM_RUNNING') );
        }
      }
    } else {
      module.exports.error(_('ERR_FILE_OPEN'),
                           _('ERR_FILE_OPEN_FMT', file.path),
                           _('ERR_APP_MIME_NOT_FOUND_FMT', file.mime) );
    }
  }

  console.group('API::open()', file);

  if ( file.mime === 'osjs/application' ) {
    _launchApp(FS.filename(file.path), launchArgs);
  } else if ( file.type === 'dir' ) {
    const fm = SettingsManager.instance('DefaultApplication').get('dir', 'ApplicationFileManager');
    _launchApp(fm, {path: file.path});
  } else {
    if ( launchArgs.args ) {
      Object.keys(launchArgs.args).forEach((i) => {
        args[i] = launchArgs.args[i];
      });
    }

    getApplicationNameByFile(file, launchArgs.forceList, _onDone);
  }
};

/**
 * Restarts all processes with the given name
 *
 * This also reloads any metadata preload items defined in the application.
 *
 * @function relaunch
 * @memberof OSjs.API
 *
 * @param   {String}      n               Application Name
 */
module.exports.relaunch = function(n) {
  function relaunch(p) {
    let data = null;
    let args = {};
    if ( p instanceof Process ) {
      data = p._getSessionData();
    }

    try {
      n = p.__pname;
      p.destroy(); // kill
    } catch ( e ) {
      console.warn('OSjs.module.exports.relaunch()', e.stack, e);
    }

    if ( data !== null ) {
      args = data.args;
      args.__resume__ = true;
      args.__windows__ = data.windows || [];
    }

    args.__preload__ = {force: true};

    //setTimeout with 500 ms is used to allow applications that might need
    //  some time to destroy resources before it can be relaunched.
    setTimeout(() => {
      module.exports.launch(n, args);
    }, 500);
  }

  let res = Process.getProcess(n);
  if ( !(res instanceof Array) ) {
    res = [res];
  }
  res.forEach(relaunch);
};

/**
 * Launch a Process
 *
 * @function launch
 * @memberof OSjs.API
 *
 * @param   {String}      name          Application Name
 * @param   {Object}      [args]          Launch arguments
 * @param   {Function}    [ondone]        Callback on success
 * @param   {Function}    [onerror]       Callback on error
 * @param   {Function}    [onconstruct]   Callback on application init
 */
module.exports.launch = function(name, args, ondone, onerror, onconstruct) {
  args = args || {};

  if ( _LAUNCHING.indexOf(name) !== -1 ) {
    console.warn('Application', name, 'is already launching...');
    return;
  }

  let err;

  let splash = null;
  let instance = null;
  let pargs = {};

  const compability = Compability.getCompability();
  const metadata = PackageManager.getPackage(name);
  const running = Process.getProcess(name, true);

  let launchIndex = -1;
  let preloads = (() => {
    let list = (metadata.preload || []).slice(0);
    let additions = [];

    function _add(chk) {
      if ( chk && chk.preload ) {
        chk.preload.forEach((p) => {
          additions.push(p);
        });
      }
    }

    // If this package depends on another package, make sure
    // to load the resources for the related one as well
    if ( metadata.depends instanceof Array ) {
      metadata.depends.forEach((k) => {
        if ( !OSjs.Applications[k] ) {
          console.info('Using dependency', k);
          _add(PackageManager.getPackage(k));
        }
      });
    }

    // ... same goes for packages that uses this package
    // as a dependency.
    const pkgs = PackageManager.getPackages(false);
    Object.keys(pkgs).forEach((pn) => {
      const p = pkgs[pn];
      if ( p.type === 'extension' && p.uses === name ) {
        console.info('Using extension', pn);
        _add(p);
      }
    });

    list = additions.concat(list);
    additions = [];

    // For user packages, make sure to load the correct URL
    if ( metadata.scope === 'user' ) {
      list = list.map((p) => {
        if ( p.src.substr(0, 1) !== '/' && !p.src.match(/^(https?|ftp)/) ) {
          VFS.url(p.src, (error, url) => {
            if ( !error ) {
              p.src = url;
            }
          });
        }

        return p;
      });
    }

    return list;
  })();

  function _createSplash() {
    Main.createLoading(name, {className: 'StartupNotification', tooltip: _('LBL_STARTING') + ' ' + name});
    if ( !OSjs.Applications[name] ) {
      if ( metadata.splash !== false ) {
        splash = module.exports.createSplash(metadata.name, metadata.icon);
      }
    }
  }

  function _destroySplash() {
    if ( launchIndex >= 0 ) {
      _LAUNCHING.splice(launchIndex, 1);
    }

    Main.destroyLoading(name);
    if ( splash ) {
      splash.destroy();
      splash = null;
    }
  }

  function _onError(err, exception) {
    _destroySplash();

    module.exports.error(_('ERR_APP_LAUNCH_FAILED'),
                         _('ERR_APP_LAUNCH_FAILED_FMT', name),
                         err, exception, true);

    console.groupEnd();

    (onerror || function() {})(err, name, args, exception);
  }

  function _onFinished(skip) {
    _destroySplash();

    console.groupEnd();

    (ondone || function() {})(instance, metadata);
  }

  function _preLaunch(cb) {
    const isCompatible = (() => {
      const list = (metadata.compability || []).filter((c) => {
        if ( typeof compability[c] !== 'undefined' ) {
          return !compability[c];
        }
        return false;
      });

      if ( list.length ) {
        return _('ERR_APP_LAUNCH_COMPABILITY_FAILED_FMT', name, list.join(', '));
      }
      return true;
    })();

    if ( isCompatible !== true ) {
      throw new Error(isCompatible);
    }

    if ( metadata.singular === true ) {
      launchIndex = _LAUNCHING.push(name) - 1;

      if ( running ) {
        if ( running instanceof Process ) {
          // In this case we do not trigger an error. Applications simply get a signal for attention
          console.warn('API::launch()', 'detected that this application is a singular and already running...');
          running._onMessage('attention', args);
          _onFinished(true);
          return; // muy importante!
        } else {
          throw new Error(_('ERR_APP_LAUNCH_ALREADY_RUNNING_FMT', name));
        }
      }
    }

    Utils.asyncs(Main.getHooks('onApplicationPreload'), function asyncIter(qi, i, n) {
      qi(name, args, preloads, (p) => {
        if ( p && (p instanceof Array) ) {
          preloads = p;
        }
        n();
      });
    }, function asyncDone() {
      _createSplash();
      cb();
    });

    Main.triggerHook('onApplicationLaunch', [name, args]);
  }

  function _preload(cb) {
    // TODO: pargs
    Preloader.preload(preloads, {
      progress: (index, total) => {
        if ( splash ) {
          splash.update(index, total);
        }
      }
    }).then((result) => {
      if ( result.failed.length ) {
        cb(_('ERR_APP_PRELOAD_FAILED_FMT', name, result.failed.join(',')));
      } else {
        cb(false, result.data);
      }
    }).catch((err) => {
      cb(err);
    });
  }

  function _createProcess(preloadData, cb) {
    function __onprocessinitfailed() {
      if ( instance ) {
        try {
          instance.destroy();
          instance = null;
        } catch ( ee ) {
          console.warn('Something awful happened when trying to clean up failed launch Oo', ee);
          console.warn(ee.stack);
        }
      }
    }

    if ( typeof OSjs.Applications[name] === 'undefined' ) {
      throw new Error(_('ERR_APP_RESOURCES_MISSING_FMT', name));
    }

    if ( typeof OSjs.Applications[name] === 'function' ) {
      OSjs.Applications[name]();
      cb(false, true);
      return;
    }

    function __onschemesloaded(scheme) {
      try {
        // TODO: simple applications are deprecated
        if ( metadata.classType === 'simple' ) {
          instance = new Application(name, args, metadata);
          OSjs.Applications[name].run(instance);
        } else {
          instance = new OSjs.Applications[name].Class(args, metadata);
        }

        (onconstruct || function() {})(instance, metadata);
      } catch ( e ) {
        console.warn('Error on constructing application', e, e.stack);
        __onprocessinitfailed();
        cb(_('ERR_APP_CONSTRUCT_FAILED_FMT', name, e), e);
        return false;
      }

      try {
        const settings = SettingsManager.get(instance.__pname) || {};
        instance.init(settings, metadata, scheme);

        Main.triggerHook('onApplicationLaunched', [{
          application: instance,
          name: name,
          args: args,
          settings: settings,
          metadata: metadata
        }]);
      } catch ( ex ) {
        console.warn('Error on init() application', ex, ex.stack);
        __onprocessinitfailed();
        cb(_('ERR_APP_INIT_FAILED_FMT', name, ex.toString()), ex);
        return false;
      }

      return true;
    }

    let scheme = null;
    if ( preloadData ) {
      preloadData.forEach((f) => {
        if ( !scheme && f.item.type === 'scheme' ) {
          scheme = new GUIScheme(f.item.src);
          scheme.loadString(f.data);
        }
      });
    }

    if ( __onschemesloaded(scheme) ) {
      cb(false, true);
    }
  }

  if ( !name ) {
    err = 'Cannot API::launch() witout a application name';
    _onError(err);
    throw new Error(err);
  }

  if ( !metadata ) {
    err = _('ERR_APP_LAUNCH_MANIFEST_FAILED_FMT', name);
    _onError(err);
    throw new Error(err);
  }

  console.group('API::launch()', {name: name, args: args, metadata: metadata, preloads: preloads});

  if ( args.__preload__ ) { // This is for relaunch()
    pargs = args.__preload__;
    delete args.__preload__;
  }

  pargs.max = ((p) => {
    if ( p === true ) {
      p = Config.getConfig('Connection.PreloadParallel');
    }
    return p;
  })(metadata.preloadParallel);

  // Main blob
  try {
    _preLaunch(function onPreLaunch() {
      _preload(function onPreload(err, res) {
        if ( err ) {
          _onError(err, res);
        } else {
          try {
            _createProcess(res, function onCreateProcess(err, res) {
              if ( err ) {
                _onError(err, res);
              } else {
                try {
                  _onFinished(res);
                } catch ( e ) {
                  _onError(e.toString(), e);
                }
              }
            });
          } catch ( e ) {
            _onError(e.toString(), e);
          }
        }
      });
    });
  } catch ( e ) {
    _onError(e.toString());
  }
};

/**
 * Launch Processes from a List
 *
 * @function launchList
 * @memberof OSjs.API
 * @see OSjs.module.exports.launch
 *
 * @param   {Array}         list        List of launch application arguments
 * @param   {Function}      onSuccess   Callback on success => fn(app, metadata, appName, appArgs)
 * @param   {Function}      onError     Callback on error => fn(error, appName, appArgs)
 * @param   {Function}      onFinished  Callback on finished running => fn()
 */
module.exports.launchList = function(list, onSuccess, onError, onFinished) {
  list        = list        || []; /* idx => {name: 'string', args: 'object', data: 'mixed, optional'} */
  onSuccess   = onSuccess   || function() {};
  onError     = onError     || function() {};
  onFinished  = onFinished  || function() {};

  Utils.asyncs(list, function asyncIter(s, current, next) {
    if ( typeof s === 'string' ) {
      const spl = s.split('@');
      const name = spl[0];

      let args = {};
      if ( typeof spl[1] !== 'undefined' ) {
        try {
          args = JSON.parse(spl[1]);
        } catch ( e ) {}
      }

      s = {
        name: name,
        args: args
      };
    }

    const aname = s.name;
    const aargs = (typeof s.args === 'undefined') ? {} : (s.args || {});

    if ( !aname ) {
      console.warn('API::launchList() next()', 'No application name defined');
      next();
      return;
    }

    module.exports.launch(aname, aargs, function launchSuccess(app, metadata) {
      onSuccess(app, metadata, aname, aargs);
      next();
    }, function launchError(err, name, args) {
      console.warn('API::launchList() _onError()', err);
      onError(err, name, args);
      next();
    });
  }, onFinished);
};

/////////////////////////////////////////////////////////////////////////////
// GUI API METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Create a new Desktop Notification
 *
 * @param {Object}  opts    Notification options
 *
 * @function createNotification
 * @memberof OSjs.API
 * @see OSjs.Core.WindowManager#notification
 *
 * @return {Object}   The created notification instance
 */
module.exports.createNotification = function(opts) {
  return WindowManager.instance.notification(opts);
};

/**
 * Creates a new splash screen
 *
 * @function createSplash
 * @memberof OSjs.API
 *
 * @param   {String}      name              The name to display
 * @param   {String}      icon              The icon to display
 * @param   {String}      [label=Starting]  The label
 * @param   {Node}        [parentEl]        The parent element
 *
 * @return  {Object}
 */
module.exports.createSplash = function(name, icon, label, parentEl) {
  label = label || _('LBL_STARTING');
  parentEl = parentEl || document.body;

  let splash = document.createElement('application-splash');
  splash.setAttribute('role', 'dialog');

  let img;
  if ( icon ) {
    img = document.createElement('img');
    img.alt = name;
    img.src = Assets.getIcon(icon);
  }

  let titleText = document.createElement('b');
  titleText.appendChild(document.createTextNode(name));

  let title = document.createElement('span');
  title.appendChild(document.createTextNode(label + ' '));
  title.appendChild(titleText);
  title.appendChild(document.createTextNode('...'));

  let progressBar;

  if ( img ) {
    splash.appendChild(img);
  }
  splash.appendChild(title);

  try {
    progressBar = GUIElement.create('gui-progress-bar');
    splash.appendChild(progressBar.$element);
  } catch ( e ) {
    console.warn(e, e.stack);
  }

  parentEl.appendChild(splash);

  return {
    destroy: () => {
      splash = DOM.$remove(splash);

      img = null;
      title = null;
      titleText = null;
      progressBar = null;
    },

    update: (p, c) => {
      if ( !splash || !progressBar ) {
        return;
      }

      let per = c ? 0 : 100;
      if ( c ) {
        per = (p / c) * 100;
      }
      progressBar.set('value', per);
    }
  };
};

/////////////////////////////////////////////////////////////////////////////
// MISC API METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Returns an instance of ServiceNotificationIcon
 *
 * This is the icon in the panel where external connections
 * etc gets a menu entry.
 *
 * @function getServiceNotificationIcon
 * @memberof OSjs.API
 *
 * @return  {ServiceNotificationIcon}
 */
module.exports.getServiceNotificationIcon = (function() {
  let _instance;

  return function _apiGetServiceNotificationIcon() {
    if ( !_instance ) {
      _instance = new ServiceNotificationIcon();
    }
    return _instance;
  };
})();

/**
 * Toggles fullscreen of an element
 *
 * @function toggleFullscreen
 * @memberof OSjs.API
 *
 * @param {Node}      el    The DOM Node
 * @param {Boolean}   [t]   Toggle value (auto-detected)
 */
module.exports.toggleFullscreen = (function() {

  let _prev;

  function trigger(el, state) {
    function _request() {
      if ( el.requestFullscreen ) {
        el.requestFullscreen();
      } else if ( el.mozRequestFullScreen ) {
        el.mozRequestFullScreen();
      } else if ( el.webkitRequestFullScreen ) {
        el.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
      }
    }

    function _restore() {
      if ( el.webkitCancelFullScreen ) {
        el.webkitCancelFullScreen();
      } else if ( el.mozCancelFullScreen ) {
        el.mozCancelFullScreen();
      } else if ( el.exitFullscreen ) {
        el.exitFullscreen();
      }
    }

    if ( el ) {
      if ( state ) {
        _request();
      } else {
        _restore();
      }
    }
  }

  return function _apiToggleFullscreen(el, t) {
    if ( typeof t === 'boolean' ) {
      trigger(el, t);
    } else {
      if ( _prev && _prev !== el ) {
        trigger(_prev, false);
      }

      trigger(el, _prev !== el);
    }

    _prev = el;
  };

})();

/////////////////////////////////////////////////////////////////////////////
// MISC
/////////////////////////////////////////////////////////////////////////////

/**
 * Signs the user out and shuts down OS.js
 *
 * @function signOut
 * @memberof OSjs.API
 */
module.exports.signOut = function() {
  const auth = Authenticator.instance;
  const storage = Storage.instance;
  const wm = WindowManager.instance;

  function signOut(save) {
    Assets.playSound('LOGOUT');

    if ( save ) {
      storage.saveSession(function() {
        auth.logout(function() {
          Main.shutdown();
        });
      });
    } else {
      auth.logout(function() {
        Main.shutdown();
      });
    }
  }

  if ( wm ) {
    const user = auth.getUser() || {name: _('LBL_UNKNOWN')};
    Dialog.create('Confirm', {
      title: _('DIALOG_LOGOUT_TITLE'),
      message: _('DIALOG_LOGOUT_MSG_FMT', user.name)
    }, function(ev, btn) {
      if ( btn === 'yes' ) {
        signOut(true);
      } else if ( btn === 'no' ) {
        signOut(false);
      }
    });
  } else {
    signOut(true);
  }
};

