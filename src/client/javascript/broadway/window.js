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

const Events = require('utils/events.js');
const Window = require('core/window.js');
const Broadway = require('broadway/broadway.js');

/**
 * @namespace Broadway
 * @memberof OSjs
 */

/////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////

/**
 * Broadway Window
 *
 * @abstract
 * @constructor
 * @memberof OSjs.Broadway
 * @extends OSjs.Core.Window
 */
class BroadwayWindow extends Window {

  /**
   * @param {Number}  id      Window ID
   * @param {Number}  x       X Position
   * @param {Number}  y       Y Position
   * @param {Number}  w       Width
   * @param {Number}  h       Height
   * @param {Node}    canvas  Canvas DOM Node
   */
  constructor(id, x, y, w, h, canvas) {
    super('BroadwayWindow' + String(id), {
      width: w,
      height: h,
      title: 'Broadway Window ' + String(id),
      min_width: 100,
      min_height: 100,
      allow_resize: false,
      allow_minimize: false,
      allow_maximize: false,
      allow_session: false,
      //allow_close: false,
      key_capture: true // IMPORTANT
    });

    this._broadwayId = id;
    this._canvas = canvas;
  }

  init() {
    const root = super.init(...arguments);

    this._canvas.width = this._dimension.w;
    this._canvas.height = this._dimension.h;

    const getMousePos = (ev) => {
      const wm = require('core/windowmanager.js').instance;
      const theme = wm ? wm.getStyleTheme(true) : null;
      const topMargin = theme ? (theme.style.window.margin) : 26;

      return {
        x: ev.pageX - this._position.x,
        y: ev.pageY - this._position.y - topMargin
      };
    };

    const inject = (type, ev) => {
      const pos = getMousePos(ev);
      return Broadway.inject(this._broadwayId, type, ev, {
        wx: this._position.x,
        wy: this._position.y,
        mx: parseInt(pos.x, 0),
        my: parseInt(pos.y, 0)
      });
    };

    Events.$bind(root, 'mouseover', function(ev) {
      return inject('mouseover', ev);
    });
    Events.$bind(root, 'mouseout', function(ev) {
      return inject('mouseout', ev);
    });
    Events.$bind(root, 'mousemove', function(ev) {
      return inject('mousemove', ev);
    });
    Events.$bind(root, 'mousedown', function(ev) {
      return inject('mousedown', ev);
    });
    Events.$bind(root, 'mouseup', function(ev) {
      return inject('mouseup', ev);
    });
    Events.$bind(root, 'DOMMouseScroll', function(ev) {
      return inject('mousewheel', ev);
    });
    Events.$bind(root, 'mousewheel', function(ev) {
      return inject('mousewheel', ev);
    });

    root.appendChild(this._canvas);
    return root;
  }

  destroy() {
    super.destroy(...arguments);
    this._canvas = null;
  }

  _inited() {
    super._inited(...arguments);

    this._onChange('move', true);
  }

  _close() {
    if ( !super._close(...arguments) ) {
      return false;
    }

    Broadway.close(this._broadwayId);

    return true;
  }

  _resize(w, h) {
    if ( !super._resize(w, h, true) ) {
      return false;
    }

    function resizeCanvas(canvas, w, h) {
      const tmpCanvas = canvas.ownerDocument.createElement('canvas');
      tmpCanvas.width = canvas.width;
      tmpCanvas.height = canvas.height;
      const tmpContext = tmpCanvas.getContext('2d');
      tmpContext.globalCompositeOperation = 'copy';
      tmpContext.drawImage(canvas, 0, 0, tmpCanvas.width, tmpCanvas.height);

      canvas.width = w;
      canvas.height = h;

      const context = canvas.getContext('2d');

      context.globalCompositeOperation = 'copy';
      context.drawImage(tmpCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height);
    }

    if ( this._canvas ) {
      resizeCanvas(this._canvas, w, h);
    }

    return true;
  }

  _onKeyEvent(ev, type) {
    Broadway.inject(this._broadwayId, type, ev);
  }

  _onChange(ev, byUser) {
    if ( !byUser ) {
      return;
    }

    if ( ev === 'move' ) {
      Broadway.move(this._broadwayId, this._position.x, this._position.y);
    } else if ( ev === 'resize' ) {
      Broadway.resize(this._broadwayId, this._dimension.w, this._dimension.h);
    }
  }

}

/////////////////////////////////////////////////////////////////////////////
// EXPORTS
/////////////////////////////////////////////////////////////////////////////

module.exports = BroadwayWindow;
