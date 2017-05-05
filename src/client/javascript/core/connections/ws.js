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
const Connection = require('core/connection.js');

class WSConnection extends Connection {
  constructor() {
    super(...arguments);

    const port = API.getConfig('Connection.WSPort');
    const path = API.getConfig('Connection.WSPath') || '';

    let url = window.location.protocol.replace('http', 'ws') + '//' + window.location.host;
    if ( port !== 'upgrade' ) {
      if ( url.match(/:\d+$/) ) {
        url = url.replace(/:\d+$/, '');
      }
      url += ':' + port;
    }
    url += path;

    this.ws = null;
    this.wsurl = url;
    this.wsqueue = {};
    this.destroying = false;
  }

  destroy() {
    this.destroying = true;

    if ( this.ws ) {
      this.ws.close();
    }

    this.ws = null;
    this.wsqueue = {};

    return super.destroy.apply(this, arguments);
  }

  init(callback) {
    this.destroying = false;
    this._connect(false, callback);
  }

  _connect(reconnect, callback) {
    if ( this.destroying || this.ws && !reconnect ) {
      return;
    }

    console.info('Trying WebSocket Connection', this.wsurl);

    let connected = false;

    this.ws = new WebSocket(this.wsurl);

    this.ws.onopen = function() {
      connected = true;
      // NOTE: For some reason it needs to be fired on next tick
      setTimeout(() => callback, 0);
    };

    this.ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      const idx = data._index;
      this._onmessage(idx, data);
    };

    this.ws.onclose = (ev) => {
      if ( !connected && ev.code !== 3001 ) {
        callback(API._('CONNECTION_ERROR'));
        return;
      }
      this._onclose();
    };
  }

  _onmessage(idx, data) {
    if ( typeof idx === 'undefined'  ) {
      this.message(data);
    } else {
      if ( this.wsqueue[idx] ) {
        delete data._index;

        this.wsqueue[idx](data);

        delete this.wsqueue[idx];
      }
    }
  }

  _onclose(reconnecting) {
    if ( this.destroying ) {
      return;
    }

    this.onOffline(reconnecting);

    this.ws = null;

    setTimeout(() => {
      this._connect(true, (err) => {
        if ( err ) {
          this._onclose((reconnecting || 0) + 1);
        } else {
          this.onOnline();
        }
      });
    }, reconnecting ? 10000 : 1000);
  }

  message(data) {
    // Emit a VFS event when a change occures
    if ( data.action === 'vfs:watch' ) {
      OSjs.VFS.Helpers.triggerWatch(data.args.event, new VFS.File(data.args.file));
    }

    // Emit a subscription event
    if ( this._evHandler ) {
      this._evHandler.emit(data.action, data.args);
    }
  }

  createRequest(method, args, onsuccess, onerror, options) {
    onerror = onerror || function() {
      console.warn('Connection::callWS()', 'error', arguments);
    };

    const res = super.createRequest(...arguments);
    if ( res !== false ) {
      return res;
    }
    if ( !this.ws ) {
      return false;
    }

    const idx = this.index++;
    const base = method.match(/^FS:/) ? '/FS/' : '/API/';

    try {
      this.ws.send(JSON.stringify({
        _index: idx,
        path: base + method.replace(/^FS:/, ''),
        args: args
      }));

      this.wsqueue[idx] = onsuccess || function() {};

      return true;
    } catch ( e ) {
      console.warn('callWS() Warning', e.stack, e);
      onerror(e);
    }

    return false;
  }
}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = WSConnection;

