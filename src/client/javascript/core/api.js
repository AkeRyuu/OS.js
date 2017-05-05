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

const FS = require('utils/fs.js');
const XHR = require('utils/xhr.js');
const DOM = require('utils/dom.js');
const GUI = require('utils/gui.js');
const VFS = require('vfs/fs.js');
const Utils = require('utils/misc.js');
const Compability = require('utils/compability.js');
const GUIElement = require('gui/element.js');

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

let DefaultLocale = 'en_EN';
let CurrentLocale = 'en_EN';

let _CLIPBOARD;         // Current 'clipboard' data
let _LAUNCHING = [];

const _hooks = {
  'onInitialize': [],
  'onInited': [],
  'onWMInited': [],
  'onSessionLoaded': [],
  'onShutdown': [],
  'onApplicationPreload': [],
  'onApplicationLaunch': [],
  'onApplicationLaunched': [],
  'onBlurMenu': []
};

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
  const wm = require('core/windowmanager.js').instance;

  const show = (ev) => {
    this.displayMenu(ev);
    return false;
  };

  if ( wm ) {
    this.notif = wm.createNotificationIcon('ServiceNotificationIcon', {
      image: module.exports.getIcon('status/dialog-password.png'),
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
  const wm = require('core/windowmanager.js').instance;
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
    this.notif.setTitle(module.exports._('SERVICENOTIFICATION_TOOLTIP', this.size.toString()));
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

  module.exports.createMenu(menu, ev);
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
// LOCALE API METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Translate given string
 *
 * @function _
 * @memberof OSjs.API
 *
 * @param  {String}       s       Translation key/string
 * @param  {...String}    sargs   Format values
 *
 * @return {String}
 */
module.exports._ = function() {
  const userLocale = require('locales/' + CurrentLocale + '.js');
  const systemLocale = require('locales/' + DefaultLocale + '.js');
  const s = arguments[0];

  let a = arguments;
  try {
    if ( userLocale && userLocale[s] ) {
      a[0] = userLocale[s];
    } else {
      a[0] = systemLocale[s] || s;
    }

    return a.length > 1 ? Utils.format.apply(null, a) : a[0];
  } catch ( e ) {
    console.warn(e.stack, e);
  }

  return s;
};

/**
 * Same as _ only you can supply the list as first argument
 *
 * @function __
 * @memberof OSjs.API
 * @see OSjs.module.exports._
 *
 * @return {String}
 */
module.exports.__ = function() {
  const l = arguments[0];
  const s = arguments[1];

  let a = Array.prototype.slice.call(arguments, 1);
  if ( l[CurrentLocale] && l[CurrentLocale][s] ) {
    a[0] = l[CurrentLocale][s];
  } else {
    a[0] = l[DefaultLocale] ? (l[DefaultLocale][s] || s) : s;
    if ( a[0] && a[0] === s ) {
      a[0] = module.exports._.apply(null, a);
    }
  }

  return a.length > 1 ? Utils.format.apply(null, a) : a[0];
};

/**
 * Get current locale
 *
 * @function getLocale
 * @memberof OSjs.API
 *
 * @return {String}
 */
module.exports.getLocale = function() {
  return CurrentLocale;
};

/**
 * Set locale
 *
 * @function setLocale
 * @memberof OSjs.API
 *
 * @param  {String}   l     Locale name
 */
module.exports.setLocale = function(l) {
  const RTL = module.exports.getConfig('LocaleOptions.RTL', []);

  const locale = require('locales/' + l + '.js');
  if ( locale ) {
    CurrentLocale = l;
  } else {
    console.warn('API::setLocale()', 'Invalid locale', l, '(Using default)');
    CurrentLocale = DefaultLocale;
  }

  const major = CurrentLocale.split('_')[0];
  const html = document.querySelector('html');
  if ( html ) {
    html.setAttribute('lang', l);
    html.setAttribute('dir', RTL.indexOf(major) !== -1 ? 'rtl' : 'ltr');
  }

  console.info('API::setLocale()', CurrentLocale);
};

/////////////////////////////////////////////////////////////////////////////
// REQUEST API METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Perform cURL call
 *
 * The response is in form of: {httpCode, body}
 *
 * @function curl
 * @memberof OSjs.API
 *
 * @param   {Object}    args      cURL Arguments (see docs)
 * @param   {Function}  callback  Callback function => fn(error, response)
 *
 * @link https://os-js.org/manual/api/usage/curl/
 */
module.exports.curl = function(args, callback) {
  args = args || {};
  callback = callback || {};

  let opts = args.body;
  if ( typeof opts === 'object' ) {
    console.warn('DEPRECATION WARNING', 'The \'body\' wrapper is no longer needed');
  } else {
    opts = args;
  }

  module.exports.call('curl', opts, callback, args.options);
};

/**
 * Global function for calling API (backend)
 *
 * You can call VFS functions by prefixing your method name with "FS:"
 *
 * @function call
 * @memberof OSjs.API
 * @see OSjs.Core.Connection#request
 * @see OSjs.Utils.ajax
 * @throws {Error} On invalid arguments
 *
 * @param   {String}    m                           Method name
 * @param   {Object}    a                           Method arguments
 * @param   {Function}  cb                          Callback on success => fn(err, res)
 * @param   {Object}    [options]                   Options (all options except the ones listed below are sent to Connection)
 * @param   {Boolean}   [options.indicator=true]    Show loading indicator
 */
module.exports.call = function(m, a, cb, options) {
  const Connection = require('core/connection.js');
  Connection.request(m, a, cb, options);
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

  const settingsManager = require('core/settings-manager.js');
  const wm = require('core/windowmanager.js').instance;
  const args = {file: file};

  function getApplicationNameByFile(file, forceList, callback) {
    if ( !(file instanceof VFS.File) ) {
      throw new Error('This function excepts a OSjs.VFS.File object');
    }

    const pacman = require('core/package-manager.js');
    const val = settingsManager.get('DefaultApplication', file.mime);

    console.debug('getApplicationNameByFile()', 'default application', val);
    if ( !forceList && val ) {
      if ( pacman.getPackage(val) ) {
        callback([val]);
        return;
      }
    }
    callback(pacman.getPackagesByMime(file.mime));
  }

  function setDefaultApplication(mime, app, callback) {
    callback = callback || function() {};
    console.debug('setDefaultApplication()', mime, app);
    settingsManager.set('DefaultApplication', mime, app);
    settingsManager.save('DefaultApplication', callback);
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
          module.exports.createDialog('ApplicationChooser', {
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
          module.exports.error(module.exports._('ERR_FILE_OPEN'),
                               module.exports._('ERR_FILE_OPEN_FMT', file.path),
                               module.exports._('ERR_NO_WM_RUNNING') );
        }
      }
    } else {
      module.exports.error(module.exports._('ERR_FILE_OPEN'),
                           module.exports._('ERR_FILE_OPEN_FMT', file.path),
                           module.exports._('ERR_APP_MIME_NOT_FOUND_FMT', file.mime) );
    }
  }

  console.group('API::open()', file);

  if ( file.mime === 'osjs/application' ) {
    _launchApp(FS.filename(file.path), launchArgs);
  } else if ( file.type === 'dir' ) {
    const fm = settingsManager.instance('DefaultApplication').get('dir', 'ApplicationFileManager');
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
  const Process = require('core/process.js');
  const Application = require('core/application.js');

  function relaunch(p) {
    let data = null;
    let args = {};
    if ( p instanceof Application ) {
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
  const VFS = require('vfs/fs.js');
  const Process = require('core/process.js');
  const Application = require('core/application.js');

  args = args || {};

  if ( _LAUNCHING.indexOf(name) !== -1 ) {
    console.warn('Application', name, 'is already launching...');
    return;
  }

  let err;

  let splash = null;
  let instance = null;
  let pargs = {};

  const packman = require('core/package-manager.js');
  const compability = Compability.getCompability();
  const metadata = packman.getPackage(name);
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
          _add(packman.getPackage(k));
        }
      });
    }

    // ... same goes for packages that uses this package
    // as a dependency.
    const pkgs = packman.getPackages(false);
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
    module.exports.createLoading(name, {className: 'StartupNotification', tooltip: module.exports._('LBL_STARTING') + ' ' + name});
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

    module.exports.destroyLoading(name);
    if ( splash ) {
      splash.destroy();
      splash = null;
    }
  }

  function _onError(err, exception) {
    _destroySplash();

    module.exports.error(module.exports._('ERR_APP_LAUNCH_FAILED'),
                         module.exports._('ERR_APP_LAUNCH_FAILED_FMT', name),
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
        return module.exports._('ERR_APP_LAUNCH_COMPABILITY_FAILED_FMT', name, list.join(', '));
      }
      return true;
    })();

    if ( isCompatible !== true ) {
      throw new Error(isCompatible);
    }

    if ( metadata.singular === true ) {
      launchIndex = _LAUNCHING.push(name) - 1;

      if ( running ) {
        if ( running instanceof Application ) {
          // In this case we do not trigger an error. Applications simply get a signal for attention
          console.warn('API::launch()', 'detected that this application is a singular and already running...');
          running._onMessage('attention', args);
          _onFinished(true);
          return; // muy importante!
        } else {
          throw new Error(module.exports._('ERR_APP_LAUNCH_ALREADY_RUNNING_FMT', name));
        }
      }
    }

    Utils.asyncs(_hooks.onApplicationPreload, function asyncIter(qi, i, n) {
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

    module.exports.triggerHook('onApplicationLaunch', [name, args]);
  }

  function _preload(cb) {
    XHR.preload(preloads, function preloadIter(total, failed, succeeded, data) {
      if ( failed.length ) {
        cb(module.exports._('ERR_APP_PRELOAD_FAILED_FMT', name, failed.join(',')));
      } else {
        cb(false, data);
      }
    }, function preloadDone(index, count, src, succeeded, failed, progress) {
      if ( splash ) {
        splash.update(progress, count);
      }
    }, pargs);
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
      throw new Error(module.exports._('ERR_APP_RESOURCES_MISSING_FMT', name));
    }

    if ( typeof OSjs.Applications[name] === 'function' ) {
      OSjs.Applications[name]();
      cb(false, true);
      return;
    }

    function __onschemesloaded(scheme) {
      try {
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
        cb(module.exports._('ERR_APP_CONSTRUCT_FAILED_FMT', name, e), e);
        return false;
      }

      try {
        const settings = require('core/settings-manager.js').get(instance.__pname) || {};
        instance.init(settings, metadata, scheme);

        module.exports.triggerHook('onApplicationLaunched', [{
          application: instance,
          name: name,
          args: args,
          settings: settings,
          metadata: metadata
        }]);
      } catch ( ex ) {
        console.warn('Error on init() application', ex, ex.stack);
        __onprocessinitfailed();
        cb(module.exports._('ERR_APP_INIT_FAILED_FMT', name, ex.toString()), ex);
        return false;
      }

      return true;
    }

    let scheme = null;
    if ( preloadData ) {
      preloadData.forEach((f) => {
        if ( !scheme && f.item.type === 'scheme' ) {
          scheme = f.data;
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
    err = module.exports._('ERR_APP_LAUNCH_MANIFEST_FAILED_FMT', name);
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
      p = module.exports.getConfig('Connection.PreloadParallel');
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
// RESOURCE API METHODS
/////////////////////////////////////////////////////////////////////////////

/**
 * Get a resource from application
 *
 * @function getApplicationResource
 * @memberof OSjs.API
 *
 * @param   {OSjs.Core.Process}   app     Application instance reference. You can also specify a name by String
 * @param   {String}              name    Resource Name
 * @param   {Boolean}             vfspath Return a valid VFS path
 *
 * @return  {String}            The absolute URL of resource
 */
module.exports.getApplicationResource = function(app, name, vfspath) {
  const Process = require('core/process.js');
  return Process.getResource(app, name, vfspath);
};

/**
 * Get path to css theme
 *
 * @function getThemeCSS
 * @memberof OSjs.API
 *
 * @param   {String}    name    CSS Stylesheet name (without extension)
 *
 * @return  {String}            The absolute URL of css file
 */
module.exports.getThemeCSS = function(name) {
  let root = module.exports.getConfig('Connection.RootURI', '/');
  if ( name === null ) {
    return root + 'blank.css';
  }

  root = module.exports.getConfig('Connection.ThemeURI');
  return root + '/' + name + '.min.css';
};

/**
 * Get a icon based in file and mime
 *
 * @function getFileIcon
 * @memberof OSjs.API
 *
 * @param   {File}      file            File Data (see supported types)
 * @param   {String}    [size=16x16]    Icon size
 * @param   {String}    [icon]          Default icon
 *
 * @return  {String}            The absolute URL to the icon
 */
module.exports.getFileIcon = function(file, size, icon) {
  icon = icon || 'mimetypes/text-x-preview.png';

  if ( typeof file === 'object' && !(file instanceof VFS.File) ) {
    file = new VFS.File(file);
  }

  if ( !file.filename ) {
    throw new Error('Filename is required for getFileIcon()');
  }

  const map = [
    {match: 'application/pdf', icon: 'mimetypes/x-office-document.png'},
    {match: 'application/zip', icon: 'mimetypes/package-x-generic.png'},
    {match: 'application/x-python', icon: 'mimetypes/text-x-script.png'},
    {match: 'application/x-lua', icon: 'mimetypes/text-x-script.png'},
    {match: 'application/javascript', icon: 'mimetypes/text-x-script.png'},
    {match: 'text/html', icon: 'mimetypes/text-html.png'},
    {match: 'text/xml', icon: 'mimetypes/text-html.png'},
    {match: 'text/css', icon: 'mimetypes/text-x-script.png'},

    {match: 'osjs/document', icon: 'mimetypes/x-office-document.png'},
    {match: 'osjs/draw', icon: 'mimetypes/image-x-generic.png'},

    {match: /^text\//, icon: 'mimetypes/text-x-generic.png'},
    {match: /^audio\//, icon: 'mimetypes/audio-x-generic.png'},
    {match: /^video\//, icon: 'mimetypes/video-x-generic.png'},
    {match: /^image\//, icon: 'mimetypes/image-x-generic.png'},
    {match: /^application\//, icon: 'mimetypes/application-x-executable.png'}
  ];

  if ( file.type === 'dir' ) {
    icon = 'places/folder.png';
  } else if ( file.type === 'trash' ) {
    icon = 'places/user-trash.png';
  } else if ( file.type === 'application' ) {
    const pm = require('core/package-manager.js');
    const appname = FS.filename(file.path);
    const meta = pm.getPackage(appname);

    if ( meta ) {
      return module.exports.getIcon(meta.icon, size, appname);
    }
  } else {
    const mime = file.mime || 'application/octet-stream';

    map.every((iter) => {
      let match = false;
      if ( typeof iter.match === 'string' ) {
        match = (mime === iter.match);
      } else {
        match = mime.match(iter.match);
      }

      if ( match ) {
        icon = iter.icon;
        return false;
      }

      return true;
    });
  }

  return module.exports.getIcon(icon, size);
};

/**
 * Default method for getting a resource from current theme
 *
 * @function getThemeResource
 * @memberof OSjs.API
 *
 * @param   {String}    name    Resource filename
 * @param   {String}    type    Type ('base' or a sub-folder)
 *
 * @return  {String}            The absolute URL to the resource
 */
module.exports.getThemeResource = function(name, type) {
  name = name || null;
  type = type || null;

  const root = module.exports.getConfig('Connection.ThemeURI');

  function getName(str, theme) {
    if ( !str.match(/^\//) ) {
      if ( type === 'base' || type === null ) {
        str = root + '/' + theme + '/' + str;
      } else {
        str = root + '/' + theme + '/' + type + '/' + str;
      }
    }
    return str;
  }

  if ( name ) {
    const wm = require('core/windowmanager.js').instance;
    const theme = (wm ? wm.getSetting('theme') : 'default') || 'default';
    name = getName(name, theme);
  }

  return name;
};

/**
 * Default method for getting a sound from theme
 *
 * @function getSound
 * @memberof OSjs.API
 *
 * @param   {String}    name    Resource filename
 *
 * @return  {String}            The absolute URL to the resource
 */
module.exports.getSound = function(name) {
  name = name || null;
  if ( name ) {
    const wm = require('core/windowmanager.js').instance;
    const theme = wm ? wm.getSoundTheme() : 'default';
    const root = module.exports.getConfig('Connection.SoundURI');
    const compability = Compability.getCompability();
    if ( !name.match(/^\//) ) {
      let ext = 'oga';
      if ( !compability.audioTypes.ogg ) {
        ext = 'mp3';
      }
      name = root + '/' + theme + '/' + name + '.' + ext;
    }
  }
  return name;
};

/**
 * Default method for getting a icon from theme
 *
 * @function getIcon
 * @memberof OSjs.API
 *
 * @param   {String}              name          Resource filename
 * @param   {String}              [size=16x16]  Icon size
 * @param   {OSjs.Core.Process}   [app]         Application instance reference. Can also be String. For `name` starting with './'
 *
 * @return  {String}            The absolute URL to the resource
 */
module.exports.getIcon = function(name, size, app) {
  const Application = require('core/application.js');

  name = name || null;
  size = size || '16x16';
  app  = app  || null;

  const root = module.exports.getConfig('Connection.IconURI');
  const wm = require('core/windowmanager.js').instance;
  const theme = wm ? wm.getIconTheme() : 'default';

  function checkIcon() {
    if ( name.match(/^\.\//) ) {
      name = name.replace(/^\.\//, '');
      if ( (app instanceof Application) || (typeof app === 'string') ) {
        return module.exports.getApplicationResource(app, name);
      } else {
        if ( app !== null && typeof app === 'object' ) {
          return module.exports.getApplicationResource(app.className, name);
        } else if ( typeof app === 'string' ) {
          return module.exports.getApplicationResource(app, name);
        }
      }
    } else {
      if ( !name.match(/^\//) ) {
        name = root + '/' + theme + '/' + size + '/' + name;
      }
    }
    return null;
  }

  if ( name && !name.match(/^(http|\/\/)/) ) {
    const chk = checkIcon();
    if ( chk !== null ) {
      return chk;
    }
  }

  return name;
};

/**
 * Method for getting a config parameter by path (Ex: "VFS.Mountpoints.shared.enabled")
 *
 * @function getConfig
 * @memberof OSjs.API
 * @see OSjs.Core.getConfig
 *
 * @param   {String}    [path]                        Path
 * @param   {Mixed}     [defaultValue=undefined]      Use default value
 *
 * @return  {Mixed}             Parameter value or entire tree on no path
 */
module.exports.getConfig = function(path, defaultValue) {
  const config = OSjs.Core.getConfig();
  if ( typeof path === 'string' ) {
    let result = config[path];
    if ( path.indexOf('.') !== -1 ) {
      const queue = path.split(/\./);

      let ns = config;
      queue.forEach((k, i) => {
        if ( i >= queue.length - 1 ) {
          if ( ns ) {
            result = ns[k];
          }
        } else {
          ns = ns[k];
        }
      });
    }

    if ( typeof result === 'undefined' && typeof defaultValue !== 'undefined' ) {
      return defaultValue;
    }

    return typeof result === 'object' ? Utils.cloneObject(result) : result;
  }
  return config;
};

/**
 * Get default configured path
 *
 * @function getDefaultPath
 * @memberof OSjs.API
 *
 * @param   {String}    fallback      Fallback path on error (default= "osjs:///")
 * @return  {String}
 */
module.exports.getDefaultPath = function(fallback) {
  if ( fallback && fallback.match(/^\//) ) {
    fallback = null;
  }
  return module.exports.getConfig('VFS.Home') || fallback || 'osjs:///';
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
  const wm = require('core/windowmanager.js').instance;
  return wm.notification(opts);
};

/**
 * Create a new dialog
 *
 * You can also pass a function as `className` to return an instance of your own class
 *
 * @function createDialog
 * @memberof OSjs.API
 *
 * @param   {String}                                 className             Dialog Namespace Class Name
 * @param   {Object}                                 args                  Arguments you want to send to dialog
 * @param   {CallbackDialog}                         callback              Callback on dialog action (close/ok etc) => fn(ev, button, result)
 * @param   {Mixed}                                  [options]             A window or app (to make it a child window) or a set of options:
 * @param   {OSjs.Core.Window|OSjs.Core.Application} [options.parent]      Same as above argument (without options context)
 * @param   {Boolean}                                [options.modal=false] If you provide a parent you can toggle "modal" mode.
 *
 * @return  {OSjs.Core.Window}
 */
module.exports.createDialog = function(className, args, callback, options) {
  callback = callback || function() {};
  options = options || {};

  const Application = require('core/application.js');
  const Process = require('core/process.js');
  const Window = require('core/window.js');

  let parentObj = options;
  let parentIsWindow = (parentObj instanceof Window);
  let parentIsProcess = (parentObj instanceof Process);
  if ( parentObj && !(parentIsWindow && parentIsProcess) ) {
    parentObj = options.parent;
    parentIsWindow = (parentObj instanceof Window);
    parentIsProcess = (parentObj instanceof Process);
  }

  function cb() {
    if ( parentObj ) {
      if ( parentIsWindow && parentObj._destroyed ) {
        console.warn('API::createDialog()', 'INGORED EVENT: Window was destroyed');
        return;
      }
      if ( parentIsProcess && parentObj.__destroyed ) {
        console.warn('API::createDialog()', 'INGORED EVENT: Process was destroyed');
        return;
      }
    }

    if ( options.modal && parentIsWindow ) {
      parentObj._toggleDisabled(false);
    }

    callback.apply(null, arguments);
  }

  const win = typeof className === 'string' ? new OSjs.Dialogs[className](args, cb) : className(args, cb);

  if ( !parentObj ) {
    const wm = require('core/windowmanager.js').instance;
    wm.addWindow(win, true);
  } else if ( parentObj instanceof Window ) {
    win._on('destroy', () => {
      if ( parentObj ) {
        parentObj._focus();
      }
    });
    parentObj._addChild(win, true);
  } else if ( parentObj instanceof Application ) {
    parentObj._addWindow(win);
  }

  if ( options.modal && parentIsWindow ) {
    parentObj._toggleDisabled(true);
  }

  setTimeout(() => {
    win._focus();
  }, 10);

  return win;
};

/**
 * Create (or show) loading indicator
 *
 * @function createLoading
 * @memberof OSjs.API
 *
 * @param   {String}    name          Name of notification (unique)
 * @param   {Object}    opts          Options
 * @param   {Number}    [panelId]     Panel ID
 *
 * @return  {String}                Or false on error
 */
module.exports.createLoading = function(name, opts, panelId) {
  try {
    const wm = require('core/windowmanager.js').instance;
    if ( wm && wm.createNotificationIcon(name, opts, panelId) ) {
      return name;
    }
  } catch ( e ) {
    console.warn(e, e.stack);
  }

  return false;
};

/**
 * Destroy (or hide) loading indicator
 *
 * @function destroyLoading
 * @memberof OSjs.API
 *
 * @param   {String}    name          Name of notification (unique)
 * @param   {Number}    [panelId]     Panel ID
 *
 * @return  {Boolean}
 */
module.exports.destroyLoading = function(name, panelId) {
  try {
    const wm = require('core/windowmanager.js').instance;
    if ( wm && wm.removeNotificationIcon(name, panelId) ) {
      return true;
    }
  } catch ( e ) {
    console.warn(e, e.stack);
  }

  return false;
};

/**
 * Checks the given permission (groups) against logged in user
 *
 * @function checkPermission
 * @memberof OSjs.API
 *
 * @param   {Mixed}     group         Either a string or array of groups
 *
 * @return {Boolean}
 */
module.exports.checkPermission = function(group) {
  const user = require('core/authenticator.js').instance.getUser();
  const userGroups = user.groups || [];

  if ( !(group instanceof Array) ) {
    group = [group];
  }

  let result = true;
  if ( userGroups.indexOf('admin') < 0 ) {
    group.every((g) => {
      if ( userGroups.indexOf(g) < 0 ) {
        result = false;
      }
      return result;
    });
  }
  return result;
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
  label = label || module.exports._('LBL_STARTING');
  parentEl = parentEl || document.body;

  let splash = document.createElement('application-splash');
  splash.setAttribute('role', 'dialog');

  let img;
  if ( icon ) {
    img = document.createElement('img');
    img.alt = name;
    img.src = module.exports.getIcon(icon);
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
 * Global function for showing an error dialog
 *
 * @function error
 * @memberof OSjs.API
 *
 * @param   {String}    title               Dialog title
 * @param   {String}    message             Dialog message
 * @param   {String}    error               Error message
 * @param   {Object}    [exception]         Exception reference
 * @param   {Boolean}   [bugreport=false]   Enable bugreporting for this error
 */
module.exports.error = function(title, message, error, exception, bugreport) {
  bugreport = (() => {
    if ( module.exports.getConfig('BugReporting.enabled') ) {
      return typeof bugreport === 'undefined' ? false : (bugreport ? true : false);
    }
    return false;
  })();

  function _dialog() {
    const wm = require('core/windowmanager.js').instance;
    if ( wm && wm._fullyLoaded ) {
      try {
        module.exports.createDialog('Error', {
          title: title,
          message: message,
          error: error,
          exception: exception,
          bugreport: bugreport
        });

        return true;
      } catch ( e ) {
        console.warn('An error occured while creating Dialogs.Error', e);
        console.warn('stack', e.stack);
      }
    }

    return false;
  }

  module.exports.blurMenu();

  if ( exception && (exception.message.match(/^Script Error/i) && String(exception.lineNumber).match(/^0/)) ) {
    console.error('VENDOR ERROR', {
      title: title,
      message: message,
      error: error,
      exception: exception
    });
    return;
  }

  if ( module.exports.getConfig('MOCHAMODE') ) {
    console.error(title, message, error, exception);
  } else {
    if ( _dialog() ) {
      return;
    }

    window.alert(title + '\n\n' + message + '\n\n' + error);
    console.warn(title, message, error, exception);
  }
};

/**
 * Global function for playing a sound
 *
 * @function playSound
 * @memberof OSjs.API
 *
 * @param   {String}      name      Sound name
 * @param   {Number}      volume    Sound volume (0.0 - 1.0)
 *
 * @return {Audio}
 */
module.exports.playSound = function(name, volume) {
  const compability = Compability.getCompability();
  const wm = require('core/windowmanager.js').instance;
  const filename = wm ? wm.getSoundFilename(name) : null;

  if ( !wm || !compability.audio || !wm.getSetting('enableSounds') || !filename ) {
    console.debug('API::playSound()', 'Cannot play sound!');
    return false;
  }

  if ( typeof volume === 'undefined' ) {
    volume = 1.0;
  }

  const f = module.exports.getSound(filename);
  console.debug('API::playSound()', name, filename, f, volume);

  const a = new Audio(f);
  a.volume = volume;
  a.play();
  return a;
};

/**
 * Set the "clipboard" data
 *
 * NOTE: This does not set the operating system clipboard (yet...)
 *
 * @function setClipboard
 * @memberof OSjs.API
 *
 * @param   {Mixed}       data      What data to set
 */
module.exports.setClipboard = function(data) {
  console.debug('OSjs.module.exports.setClipboard()', data);
  _CLIPBOARD = data;
};

/**
 * Get the "clipboard" data
 *
 * NOTE: This does not the operating system clipboard (yet...)
 *
 * @function getClipboard
 * @memberof OSjs.API
 *
 * @return  {Mixed}
 */
module.exports.getClipboard = function() {
  return _CLIPBOARD;
};

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
 * Checks if running OS.js instance is in standalone mode
 *
 * @function isStandalone
 * @memberof OSjs.API
 * @return {Boolean}
 */
module.exports.isStandalone = function() {
  return module.exports.getConfig('Connection.Type') === 'standalone' || window.location.protocol === 'file:';
};

/**
 * Gets the browser window path
 *
 * @param {String}    [app]     Append this path
 *
 * @function getBrowserPath
 * @memberof OSjs.API
 * @return {String}
 */
module.exports.getBrowserPath = function(app) {
  let str = module.exports.getConfig('Connection.RootURI');
  if ( typeof app === 'string' ) {
    str = str.replace(/\/?$/, app.replace(/^\/?/, '/'));
  }
  return str;
};

/**
 * Signs the user out and shuts down OS.js
 *
 * @function signOut
 * @memberof OSjs.API
 */
module.exports.signOut = function() {
  const auth = require('core/authenticator.js').instance;
  const storage = require('core/storage.js').instance;
  const wm = require('core/windowmanager.js').instance;

  function signOut(save) {
    module.exports.playSound('LOGOUT');

    if ( save ) {
      storage.saveSession(function() {
        auth.logout(function() {
          module.exports.shutdown();
        });
      });
    } else {
      auth.logout(function() {
        module.exports.shutdown();
      });
    }
  }

  if ( wm ) {
    const user = auth.getUser() || {name: module.exports._('LBL_UNKNOWN')};
    module.exports.createDialog('Confirm', {
      title: module.exports._('DIALOG_LOGOUT_TITLE'),
      message: module.exports._('DIALOG_LOGOUT_MSG_FMT', user.name)
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

/**
 * Method for triggering a hook
 *
 * @function triggerHook
 * @memberof OSjs.API
 *
 * @param   {String}    name      Hook name
 * @param   {Array}     args      List of arguments
 * @param   {Object}    thisarg   'this' ref
 */
module.exports.triggerHook = function(name, args, thisarg) {
  thisarg = thisarg || OSjs;
  args = args || [];

  if ( _hooks[name] ) {
    _hooks[name].forEach(function(hook) {
      if ( typeof hook === 'function' ) {
        try {
          hook.apply(thisarg, args);
        } catch ( e ) {
          console.warn('Error on Hook', e, e.stack);
        }
      } else {
        console.warn('No such Hook', name);
      }
    });
  }
};

/**
 * Method for adding a hook
 *
 * @function addHook
 * @memberof OSjs.API
 *
 * @param   {String}    name    Hook name
 * @param   {Function}  fn      Callback => fn()
 *
 * @return  {Number}       The index of hook
 */
module.exports.addHook = function(name, fn) {
  if ( typeof _hooks[name] !== 'undefined' ) {
    return _hooks[name].push(fn) - 1;
  }
  return -1;
};

/**
 * Method for removing a hook
 *
 * @function removeHook
 * @memberof OSjs.API
 *
 * @param   {String}    name    Hook name
 * @param   {Number}    index     Hook index
 *
 * @return  {Boolean}
 */
module.exports.removeHook = function(name, index) {
  if ( typeof _hooks[name] !== 'undefined' ) {
    if ( _hooks[name][index] ) {
      _hooks[name][index] = null;
      return true;
    }
  }
  return false;
};

/////////////////////////////////////////////////////////////////////////////
// EXTERNALS
/////////////////////////////////////////////////////////////////////////////

/**
 * Shuts down OS.js
 *
 * @function shutdown
 * @memberof OSjs.API
 * @return {Boolean}
 */
module.exports.shutdown = function() {
  return OSjs.Bootstrap.stop();
};

/**
 * Check if OS.js is shutting down
 *
 * @function isShuttingDown
 * @memberof OSjs.API
 * @return {Boolean}
 */
module.exports.isShuttingDown = function() {
  return OSjs.Bootstrap.isShuttingDown.apply(null, arguments);
};

/**
 * @function createMenu
 * @memberof OSjs.API
 * @see OSjs.GUI.Helpers.createMenu
 *
 * @return {Boolean}
 */
module.exports.createMenu = function() {
  return GUI.createMenu.apply(null, arguments);
};

/**
 * @function blurMenu
 * @memberof OSjs.API
 * @see OSjs.GUI.Helpers.blurMenu
 *
 * @return {Boolean}
 */
module.exports.blurMenu = function() {
  return GUI.blurMenu.apply(null, arguments);
};

