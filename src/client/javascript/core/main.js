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
import Promise from 'bluebird';

import * as FS from 'utils/fs';
import * as GUI from 'utils/gui';
import {getConfig} from 'core/config';
import {triggerHook} from 'helpers/hooks';
import WM from 'core/windowmanager';
import DialogWindow from 'core/dialog';

import * as DOM from 'utils/dom';
import * as Config from 'core/config';
import * as Compability from 'utils/compability';
import * as Assets from 'core/assets';
import * as VFS from 'vfs/fs';
import {_} from 'core/locales';

import FileMetadata from 'vfs/file';
import Dialog from 'core/dialog';
import GUIElement from 'gui/element';
import Preloader from 'utils/preloader';
import SettingsManager from 'core/settings-manager';
import PackageManager from 'core/package-manager';
import Process from 'core/process';

function createSplash(name, icon, label, parentEl) {
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

    }
  };
}

function getLaunchObject(s) {
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

  return s;
}

/**
 * Global function for showing an error dialog
 *
 * @param   {String}    title               Dialog title
 * @param   {String}    message             Dialog message
 * @param   {String}    error               Error message
 * @param   {Object}    [exception]         Exception reference
 * @param   {Boolean}   [bugreport=false]   Enable bugreporting for this error
 */
export function error(title, message, error, exception, bugreport) {
  bugreport = (() => {
    if ( getConfig('BugReporting.enabled') ) {
      return typeof bugreport === 'undefined' ? false : (bugreport ? true : false);
    }
    return false;
  })();

  function _dialog() {
    const wm = WM.instance;
    if ( wm && wm._fullyLoaded ) {
      try {
        DialogWindow.create('Error', {
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

  GUI.blurMenu();

  console.error(exception || error);

  if ( exception && (exception.message.match(/^Script Error/i) && String(exception.lineNumber).match(/^0/)) ) {
    console.error('VENDOR ERROR', {
      title: title,
      message: message,
      error: error,
      exception: exception
    });
    return;
  }

  if ( getConfig('MOCHAMODE') ) {
    console.error(title, message, error, exception);
  } else {
    if ( _dialog() ) {
      return;
    }

    window.alert(title + '\n\n' + message + '\n\n' + error);
    console.warn(title, message, error, exception);
  }
}

/**
 * Create (or show) loading indicator
 *
 * @param   {String}    name          Name of notification (unique)
 * @param   {Object}    opts          Options
 *
 * @return  {String}                Or false on error
 */
export function createLoading(name, opts) {
  return false; // TODO: From Webpack changes
}

/**
 * Destroy (or hide) loading indicator
 *
 * @param   {String}    name          Name of notification (unique)
 *
 * @return  {Boolean}
 */
export function destroyLoading(name) {
  return false; // TODO: From Webpack changes
}

/**
 * Launch a Process
 *
 * @param   {String}      name          Application Name
 * @param   {Object}      [args]          Launch arguments
 * @param   {Function}    [onconstruct]   Callback on application init
 * @return  {Promise}
 */
export function launch(name, args, onconstruct) {
  args = args || {};
  onconstruct = onconstruct || function() {};

  console.info('launch()', name, args);

  let removeSplash = () => {};

  const init = () => {
    if ( !name ) {
      throw new Error('Cannot API::launch() witout a application name');
    }

    const compability = Compability.getCompability();
    const metadata = PackageManager.getPackage(name);
    const alreadyRunning = Process.getProcess(name, true);

    const preloads = (() => {
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
            VFS.url(p.src).then((url) => {
              p.src = url;
              return true;
            });
          }

          return p;
        });
      }

      return list;
    })();

    //
    // Pre-checks
    //

    if ( !metadata ) {
      throw new Error(_('ERR_APP_LAUNCH_MANIFEST_FAILED_FMT', name));
    }

    const compabilityFailures = (metadata.compability || []).filter((c) => {
      if ( typeof compability[c] !== 'undefined' ) {
        return !compability[c];
      }
      return false;
    });

    if ( compabilityFailures.length ) {
      throw new Error(_('ERR_APP_LAUNCH_COMPABILITY_FAILED_FMT', name, compabilityFailures.join(', ')));
    }

    if ( metadata.singular === true && alreadyRunning ) {
      console.warn('API::launch()', 'detected that this application is a singular and already running...');
      alreadyRunning._onMessage('attention', args);

      throw new Error(_('ERR_APP_LAUNCH_ALREADY_RUNNING_FMT', name));
    }

    triggerHook('onApplicationLaunch', [name, args]);

    //
    // Create splash
    //
    let splash = null;

    removeSplash = () => {
      destroyLoading(name);
      if ( splash ) {
        splash.destroy();
        splash = null;
      }
    };

    createLoading(name, {className: 'StartupNotification', tooltip: _('LBL_STARTING') + ' ' + name});

    if ( !OSjs.Applications[name] ) {
      if ( metadata.splash !== false ) {
        splash = createSplash(metadata.name, metadata.icon);
      }
    }

    // Preload
    let pargs = {
      max: metadata.preloadParallel === true
        ? Config.getConfig('Connection.PreloadParallel')
        : metadata.preloadParallel,

      progress: (index, total) => {
        if ( splash ) {
          splash.update(index, total);
        }
      }
    };

    if ( args.__preload__ ) { // This is for relaunch()
      pargs = Object.assign(pargs, args.__preload__);
      delete args.__preload__;
    }

    return new Promise((resolve, reject) => {
      const onerror = (e) => {
        console.warn(e);
        return reject(e);
      };

      Preloader.preload(preloads, pargs).then((result) => {
        if ( result.failed.length ) {
          return onerror(_('ERR_APP_PRELOAD_FAILED_FMT', name, result.failed.join(',')));
        }

        if ( typeof OSjs.Applications[name] === 'undefined' ) {
          return onerror(new Error(_('ERR_APP_RESOURCES_MISSING_FMT', name)));
        /* // FIXME: Backward compability
        } else if ( typeof OSjs.Applications[name] === 'function' ) {
          OSjs.Applications[name]();
          return resolve(true);
          */
        }

        // Run
        let instance;

        try {
          const ResolvedPackage = OSjs.Applications[name];
          if ( ResolvedPackage.Class ) {
            // FIXME: Backward compability
            instance = new ResolvedPackage.Class(args, metadata);
          } else {
            instance = new ResolvedPackage(args, metadata);
          }

          onconstruct(instance, metadata);
        } catch ( e ) {
          return onerror(e);
        }

        try {
          const settings = SettingsManager.get(instance.__pname) || {};
          instance.init(settings, metadata);

          triggerHook('onApplicationLaunched', [{
            application: instance,
            name: name,
            args: args,
            settings: settings,
            metadata: metadata
          }]);
        } catch ( e ) {
          return onerror(e);
        }

        return resolve(instance);
      }).catch(onerror);
    });
  };

  const onerror = (err) => {
    error(_('ERR_APP_LAUNCH_FAILED'),
          _('ERR_APP_LAUNCH_FAILED_FMT', name),
          err, err, true);

  };

  return new Promise((resolve, reject) => {
    const fail = (e) => {
      onerror(e);
      removeSplash();
      return reject(e);
    };

    try {
      init().then((r) => {
        removeSplash();
        return resolve(r);
      }).catch(fail);
    } catch ( e ) {
      fail(e);
    }
  });
}

/**
 * Launch Processes from a List
 *
 * @param   {Array}         list        List of launch application arguments
 * @param   {Function}      onconstruct Callback on success => fn(app, metadata, appName, appArgs)
 * @return  {Promise}
 */
export function launchList(list, onconstruct) {
  list = list || [];
  onconstruct = onconstruct || function() {};

  console.info('launchList()', list);

  return Promise.each(list, (s) => {
    return new Promise((resolve, reject) => {
      s = getLaunchObject(s);
      if ( s.name ) {
        try {
          launch(s.name, s.args, (instance, metadata) => {
            onconstruct(instance, metadata, s.name, s.args);
          }).then(resolve).catch(reject);
        } catch ( e ) {
          reject(e);
        }
      } else {
        resolve();
      }
    });
  });
}

/**
 * Open a file
 *
 * @param   {OSjs.VFS.File}   file    The File reference (can also be a tuple with 'path' and 'mime')
 * @param   {Object}          args    Arguments to send to process launch function
 * @return  {Promise}
 */
export function openFile(file, args) {
  file = new FileMetadata(file);

  args = Object.assign({
    file: file
  }, args || {});

  if ( args.args ) {
    Object.keys(args.args).forEach((i) => {
      args[i] = args.args[i];
    });
  }

  if ( !file.path ) {
    throw new Error('Cannot open file without a path');
  }

  console.info('openFile()', file, args);

  if ( file.mime === 'osjs/application' ) {
    return launch(FS.filename(file.path), args);
  } else if ( file.type === 'dir' ) {
    const fm = SettingsManager.instance('DefaultApplication').get('dir', 'ApplicationFileManager');
    return launch(fm, {path: file.path});
  }

  return new Promise((resolve, reject) => {
    const val = SettingsManager.get('DefaultApplication', file.mime);
    let pack = PackageManager.getPackagesByMime(file.mime);
    if ( !args.forceList && val ) {
      if ( PackageManager.getPackage(val) ) {
        console.debug('getApplicationNameByFile()', 'default application', val);
        pack = [val];
      }
    }

    if ( pack.length === 0 ) {
      error(_('ERR_FILE_OPEN'),
            _('ERR_FILE_OPEN_FMT', file.path),
            _('ERR_APP_MIME_NOT_FOUND_FMT', file.mime) );

      reject(new Error(_('ERR_APP_MIME_NOT_FOUND_FMT', file.mime)));
    } else if ( pack.length === 1 ) {
      launch(pack[1], args).then(resolve).catch(reject);
    } else {
      Dialog.create('ApplicationChooser', {
        file: file,
        list: pack
      }, (ev, btn, result) => {
        if ( btn === 'ok' ) {
          launch(result.name, args);

          SettingsManager.set('DefaultApplication', file.mime, result.useDefault ? result.name : null);

          SettingsManager.save('DefaultApplication', (err, res) => {
            if ( err ) {
              reject(typeof err === 'string' ? new Error(err) : err);
            } else {
              resolve(res);
            }
          });
        }
      });
    }
  });

}
