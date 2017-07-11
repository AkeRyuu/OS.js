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
import DialogWindow from 'core/dialog';
import BroadwayWindow from 'broadway/window';
import Broadway from 'broadway/broadway';
import WindowManager from 'core/windowmanager';
import * as Assets from 'core/assets';
import * as Main from 'core/main';
import * as GUI from 'utils/gui';
import {getConfig} from 'core/config';

let _connected = false;
let _ws = null;

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

/*
 * Creates a new connection URL
 */
function createURL(cfg) {
  const protocol = cfg.protocol || window.location.protocol.replace(/^http/, 'ws');

  let host = cfg.host || window.location.hostname;
  if ( host === 'localhost' && host !== window.location.hostname ) {
    host = window.location.hostname;
  }
  return protocol + '//' + host + ':' + cfg.port + '/' + cfg.uri;
}

/*
 * Get window
 */
function actionOnWindow(id, cb) {
  const wm = WindowManager.instance;
  if ( wm ) {
    const win = wm.getWindow('BroadwayWindow' + String(id));
    if ( win ) {
      return cb(win);
    }
  }
  return null;
}

/*
 * Removes the notification icon
 */
function removeNotification() {
  const wm = WindowManager.instance;
  if ( wm ) {
    wm.removeNotificationIcon('BroadwayService');
  }
}

/*
 * Updates notification icon based on state(s)
 */
function updateNotification() {
  const wm = WindowManager.instance;
  if ( wm ) {
    const n = wm.getNotificationIcon('BroadwayService');
    if ( n ) {
      n.$image.style.opacity = _connected ? 1 : .4;
    }
  }
}

/*
 * Creates the notification icon
 */
function createNotification() {
  const wm = WindowManager.instance;
  const conf = getConfig('Broadway');

  function displayMenu(ev) {
    const menuItems = [];
    if ( _connected ) {
      menuItems.push({
        title: 'Disconnect from Broadway server',
        onClick: function() {
          disconnect();
        }
      });
      menuItems.push({
        title: 'Create new process',
        onClick: function() {
          DialogWindow.create('Input', {message: 'Launch process', value: '/usr/bin/gtk3-demo'}, function(ev, btn, value) {
            if ( btn === 'ok' && value ) {
              spawn(value);
            }
          });
        }
      });
    } else {
      menuItems.push({
        title: 'Connect to Broadway server',
        onClick: function() {
          connect();
        }
      });
    }

    GUI.createMenu(menuItems, ev);
  }

  removeNotification();

  if ( wm && conf.enabled ) {
    removeNotification();

    wm.createNotificationIcon('BroadwayService', {
      image: Assets.getIcon('gtk.png'),
      onContextMenu: function(ev) {
        displayMenu(ev);
        return false;
      },
      onClick: function(ev) {
        displayMenu(ev);
        return false;
      }
    });

    updateNotification();
  }
}

/*
 * Creates a new Spawner connection
 */
function createSpawner(host, cb) {
  _ws = new WebSocket(host, 'broadway-spawner');

  _ws.onerror = function() {
    cb('Failed to connect to spawner');
  };

  _ws.onopen = function() {
    cb(null, _ws);
  };

  _ws.onclose = function() {
    disconnect();
  };
}

const onResize = (function() {
  let wm;
  return function() {
    if ( !wm ) {
      wm = WindowManager.instance;
    }

    if ( wm ) {
      const space = wm.getWindowSpace();
      const theme = wm ? wm.getStyleTheme(true) : null;
      const topMargin = theme ? (theme.style.window.margin) : 26;

      Broadway.inject(null, 'resize', null, {
        width: space.width,
        height: space.height - topMargin
      });
    }

  };
})();

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

/**
 * Initializes Broadway
 */
function init() {
  createNotification();
}

/**
 * Disconnects the Broadway connections
 */
function disconnect() {
  _connected = false;

  if ( _ws ) {
    _ws.close();
  }
  _ws = null;

  try {
    Broadway.disconnect();
  } catch ( e ) {
    console.warn(e);
  }

  const wm = WindowManager.instance;
  if ( wm ) {
    wm.getWindows().forEach(function(w) {
      if ( w && w instanceof BroadwayWindow ) {
        w.destroy();
      }
    });
  }

  setTimeout(function() {
    updateNotification();
  }, 100);
}

/**
 * Creates new Broadway connections
 */
function connect() {
  if ( _connected || _ws ) {
    return;
  }

  const conf = getConfig('Broadway');

  createSpawner(createURL(conf.defaults.spawner), function(err) {
    _connected = true;

    if ( err ) {
      Main.error('Broadway', 'Failed to connect', err);
    } else {
      try {
        const host = createURL(conf.defaults.connection);
        Broadway.connect(host);
      } catch ( e ) {
        console.warn(e);
      }
    }
  });
}

/**
 * Spawns a new process on the Broadway server
 *
 * @param {String}  cmd     Command
 */
function spawn(cmd) {
  if ( !_connected || !_ws ) {
    return;
  }

  _ws.send(JSON.stringify({
    method: 'launch',
    argument: cmd
  }));
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

export default {
  init: init,
  connect: connect,
  disconnect: disconnect,
  spawn: spawn,
  events: {
    onSocketOpen: function() {
      window.addEventListener('resize', onResize);

      updateNotification();
      onResize();
    },

    onSocketClose: function() {
      window.removeEventListener('resize', onResize);

      disconnect();
    },

    onDeleteSurface: function(id) {
      return actionOnWindow(id, function(win) {
        return win._close();
      });
    },

    onShowSurface: function(id) {
      return actionOnWindow(id, function(win) {
        return win._restore();
      });
    },

    onHideSurface: function(id) {
      return actionOnWindow(id, function(win) {
        return win._minimize();
      });
    },

    onMoveSurface: function(id, has_pos, has_size, surface) {
      return actionOnWindow(id, function(win) {
        const wm = WindowManager.instance;
        const space = wm.getWindowSpace();

        if ( has_pos ) {
          win._move(space.left + surface.x, space.top + surface.y);
        }

        if ( has_size ) {
          win._resize(surface.width, surface.height);
        }
      });
    },

    onCreateSurface: function(id, surface) {
      const wm = WindowManager.instance;
      if ( !surface.isTemp ) {
        const win = new BroadwayWindow(id, surface.x, surface.y, surface.width, surface.height, surface.canvas, Broadway);
        wm.addWindow(win, true);
      }
    }
  }
};
