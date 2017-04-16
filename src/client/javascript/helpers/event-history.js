/*!
 * THIS IS JUST A TEST!
 */
(function() {
  'use strict';

  var check = ['click', 'dblclick', 'pointerdown', 'pointerup', 'pointermove', 'mousewheel'];
  var lastEvent;
  var eventLog = [];

  /////////////////////////////////////////////////////////////////////////////
  // API
  /////////////////////////////////////////////////////////////////////////////

  var EventHistory = {};

  /*
   * Prints the log
   */
  EventHistory.printLog = function() {
    var wm = OSjs.Core.getWindowManager();

    eventLog.forEach(function(l, idx) {
      if ( l.method ) {
        console.log(idx, 'API Event', l.method, l.args.join(','));
        //console.log(idx, l.method, l.args.join(', '));
      } else if ( l.action ) {
        var win = wm._windows[l.ref] || {};
        var app = win._app || {};
        console.log(idx, 'User Event', l.action, l.args.join(','), 'in', win._name, '>', app.__path);
      } else {
        var proc = OSjs.API.getProcess(l.pid) || {};
        var win = wm._windows[l.wid] || {};

        if ( l.object ) {
          console.log(idx, 'GUI Input', l.name, '@', l.object, 'in', win._name, '>', proc.__path);
        } else {
          console.log(idx, 'Raw Input', l.name, '@', [l.clientX, l.clientY], 'in', win._name, '>', proc.__path);
        }
        //console.log(idx, l.name, l.button, [l.clientX, l.clientY], l.path, '@', l.pid, '>', l.object);
      }
    });
  };

  /*
   * Push a generic event
   */
  EventHistory.pushAPIEvent = function(ev) {
    eventLog.push(ev);
  };

  /*
   * Push a DOM Event
   */
  EventHistory.pushEvent = function(ev, el, t) {
    if ( check.indexOf(t) !== -1 ) {
      var foundProcess = null;
      var foundObject = null;

      var foundGUIElement = OSjs.Utils.$parent(el, function(node) {
        return node.tagName.match(/^GUI\-/);
      });

      if ( foundGUIElement ) {
        foundObject = foundGUIElement.tagName;
      }

      var foundWindow = OSjs.Utils.$parent(el, function(node) {
        return node.tagName === 'APPLICATION-WINDOW' || node.tagName === 'APPLICATION-DIALOG';
      });

      if ( foundWindow ) {
        var id = foundWindow.getAttribute('data-window-id');
        var win = OSjs.Core.getWindowManager()._windows[id];
        foundProcess = win._app ? win._app.__pid : null;
        foundWindow = parseInt(id, 10);
      }

      var currentEvent = {
        name: t,
        clientX: ev.clientX,
        clientY: ev.clientY,
        button: ev.button,
        path: OSjs.Utils.$path(el),
        object: foundObject,
        wid: foundWindow,
        pid: foundProcess || 0
      };

      var hadLastEvent = !!lastEvent;
      if ( t === 'pointermove') {
        lastEvent = currentEvent;
        if ( !hadLastEvent ) {
          eventLog.push(currentEvent);
        }
        return;
      } else {
        if ( lastEvent ) {
          eventLog.push(lastEvent);
        }
        lastEvent = null;
      }

      eventLog.push(currentEvent);
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Helpers.EventHistory = EventHistory;
})();
