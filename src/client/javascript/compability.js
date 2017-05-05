module.exports = function() {
  /**
   * @namespace Bootstrap
   * @memberof OSjs
   */

  // Make sure these namespaces exist
  (['Bootstrap', 'Utils', 'API', 'GUI', 'Core', 'Dialogs', 'Helpers', 'Applications', 'Locales', 'VFS', 'Extensions', 'Auth', 'Storage', 'Connections', 'Broadway']).forEach(function(ns) {
    OSjs[ns] = OSjs[ns] || {};
  });

  (['Helpers']).forEach(function(ns) {
    OSjs.GUI[ns] = OSjs.GUI[ns] || {};
  });

  (['Helpers', 'Transports']).forEach(function(ns) {
    OSjs.VFS[ns] = OSjs.VFS[ns] || {};
  });

  /**
   * Callback for all Handler methods
   * @param {String} [error] Error from response (if any)
   * @param {Mixed} result Result from response (if any)
   * @callback CallbackHandler
   */

  const Process = require('core/process.js');
  const WindowManager = require('core/windowmanager.js');
  const SettingsManager = require('core/settings-manager.js');
  const SearchEngine = require('core/search-engine.js');
  const PackageManager = require('core/package-manager.js');
  const MountManager = require('core/mount-manager.js');
  const Authenticator = require('core/authenticator.js');
  const Connection = require('core/connection.js');
  const Storage = require('core/storage.js');
  const API = require('core/api.js');

  const BroadwayKeytable = require('broadway/unicode.js');
  const BroadwayConnection = require('broadway/connection.js');
  const BroadwayWindow = require('broadway/window.js');
  const Broadway = require('broadway/broadway.js');

  const ExtendedDate = require('helpers/date.js');
  const DefaultApplicationWindow = require('helpers/default-application-window.js');
  const DefaultApplication = require('helpers/default-application.js');
  const EventHandler = require('helpers/event-handler.js');
  const IFrameApplication = require('helpers/iframe-application.js');
  const GoogleAPI = require('helpers/google-api.js');
  const WindowsLiveAPI = require('helpers/windows-live-api.js');
  const SettingsFragment = require('helpers/settings-fragment.js');
  const ZipArchiver = require('helpers/zip-archiver.js');

  const UIScheme = require('gui/scheme.js');
  const UIElement = require('gui/element.js');
  const UIDataView = require('gui/dataview.js');
  const GUIHelpers = require('utils/gui.js');

  const VFS = require('vfs/fs.js');
  const MountDropbox = require('vfs/mounts/dropbox.js');
  const MountGoogleDrive = require('vfs/mounts/googledrive.js');
  const MountLocalStorage = require('vfs/mounts/localstorage.js');
  const MountOneDrive = require('vfs/mounts/onedrive.js');

  const FS = require('utils/fs.js');
  const DOM = require('utils/dom.js');
  const XHR = require('utils/xhr.js');
  const Utils = require('utils/misc.js');
  const Events = require('utils/events.js');
  const Compability = require('utils/compability.js');

  OSjs.Bootstrap = require('core/boot.js');

  const assignInto = (lib, ns) => {
    return Object.keys(lib).forEach((k) => {
      ns[k] = lib[k];
    });
  };

  assignInto(VFS, OSjs.VFS);
  OSjs.VFS.FileDataURL = VFS.FileData;
  assignInto(FS, OSjs.VFS.Helpers);

  OSjs.VFS.Transports.Applications = require('vfs/transports/applications.js');
  OSjs.VFS.Transports.Dist = require('vfs/transports/dist.js');
  OSjs.VFS.Transports.HTTP = require('vfs/transports/http.js');
  OSjs.VFS.Transports.OSjs = require('vfs/transports/osjs.js');
  OSjs.VFS.Transports.Web = require('vfs/transports/web.js');
  OSjs.VFS.Transports.WebDAV = require('vfs/transports/webdav.js');

  assignInto(FS, OSjs.Utils);
  assignInto(DOM, OSjs.Utils);
  assignInto(XHR, OSjs.Utils);
  assignInto(Utils, OSjs.Utils);
  assignInto(Events, OSjs.Utils);
  assignInto(Compability, OSjs.Utils);

  OSjs.Helpers.Date = ExtendedDate;
  OSjs.Helpers.DefaultApplicationWindow = DefaultApplicationWindow;
  OSjs.Helpers.DefaultApplication = DefaultApplication;
  OSjs.Helpers.EventHandler = EventHandler;
  OSjs.Helpers.IFrameApplication = IFrameApplication.IFrameApplication;
  OSjs.Helpers.IFrameApplicationWindow = IFrameApplication.IFrameApplicationWindow;
  OSjs.Helpers.SettingsFragment = SettingsFragment;
  OSjs.Helpers.GoogleAPI = OSjs.Helpers.GoogleAPI || {};
  OSjs.Helpers.WindowsLiveAPI = OSjs.Helpers.WindowsLiveAPI || {};
  OSjs.Helpers.ZipArchiver = OSjs.Helpers.ZipArchiver || {};

  OSjs.API = API;
  OSjs.API.killAll = Process.killAll;
  OSjs.API.kill = Process.kill;
  OSjs.API.message = Process.message;
  OSjs.API.getProcess = Process.getProcess;
  OSjs.API.getProcesses = Process.getProcesses;

  OSjs.Core.DialogWindow = Object.seal(require('core/dialog.js'));
  OSjs.Core.Window = Object.seal(require('core/window.js'));
  OSjs.Core.WindowManager = Object.seal(WindowManager);
  OSjs.Core.Service = Object.seal(require('core/service.js'));
  OSjs.Core.Process = Object.seal(Process);
  OSjs.Core.Application = Object.seal(require('core/application.js'));

  OSjs.Dialogs.Alert = Object.seal(require('dialogs/alert.js'));
  OSjs.Dialogs.ApplicationChooser = Object.seal(require('dialogs/applicationchooser.js'));
  OSjs.Dialogs.Color = Object.seal(require('dialogs/color.js'));
  OSjs.Dialogs.Confirm = Object.seal(require('dialogs/confirm.js'));
  OSjs.Dialogs.Error = Object.seal(require('dialogs/error.js'));
  OSjs.Dialogs.File = Object.seal(require('dialogs/file.js'));
  OSjs.Dialogs.FileInfo = Object.seal(require('dialogs/fileinfo.js'));
  OSjs.Dialogs.FileProgress = Object.seal(require('dialogs/fileprogress.js'));
  OSjs.Dialogs.FileUpload = Object.seal(require('dialogs/fileupload.js'));
  OSjs.Dialogs.Font = Object.seal(require('dialogs/font.js'));
  OSjs.Dialogs.Input = Object.seal(require('dialogs/input.js'));

  OSjs.GUI.Element = Object.seal(UIElement);
  OSjs.GUI.DataView = Object.seal(UIDataView);
  OSjs.GUI.Scheme = Object.seal(UIScheme);
  OSjs.GUI.Helpers = Object.seal(GUIHelpers);

  const languages = OSjs.Core.getConfig().Languages;
  Object.keys(languages).forEach((k) => {
    OSjs.Locales[k] = require('locales/' + k + '.js');
  });

  /**
   * @namespace Connection
   * @memberof OSjs.Broadway
   */
  OSjs.Broadway.Keytable = BroadwayKeytable;
  OSjs.Broadway.Connection = BroadwayConnection;
  OSjs.Broadway.Window = BroadwayWindow;
  OSjs.Broadway.GTK = Broadway;

  /**
   * Get the current SettingsManager  instance
   *
   * @function getSettingsManager
   * @memberof OSjs.Core
   * @return {OSjs.Core.SettingsManager}
   */
  OSjs.Core.getSettingsManager = function Core_getSettingsManager() {
    return SettingsManager;
  };

  /**
   * Get the current SearchEngine  instance
   *
   * @function getSearchEngine
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.SearchEngine}
   */
  OSjs.Core.getSearchEngine = function Core_getSearchEngine() {
    return SearchEngine;
  };

  /**
   * Get the current PackageManager instance
   *
   * @function getPackageManager
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.PackageManager}
   */
  OSjs.Core.getPackageManager = function Core_getPackageManager() {
    return PackageManager;
  };

  /**
   * Get the current MountManager  instance
   *
   * @function getMountManager
   * @memberof OSjs.Core
   * @return {OSjs.Core.MountManager}
   */
  OSjs.Core.getMountManager = function Core_getMountManager() {
    return MountManager;
  };

  /**
   * This is kept for backward compability with the old Handler system
   *
   * @function getHandler
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.Handler}
   */
  OSjs.Core.getHandler = function() {
    console.warn('HANDLER IS DEPRECATED. YOU SHOULD UPDATE YOUR CODE!');
    return (function() {
      var auth = OSjs.Core.getAuthenticator();
      var conn = OSjs.Core.getConnection();
      var stor = OSjs.Core.getStorage();

      return {
        loggedIn: auth.isLoggedIn(),
        offline: conn.isOffline(),
        userData: auth.getUser(),
        callAPI: conn.request,
        saveSettings: stor.saveSettings
      };
    })();
  };

  /**
   * Get default configured settings
   *
   * THIS IS JUST A PLACEHOLDER. 'settings.js' SHOULD HAVE THIS!
   *
   * You should use 'OSjs.API.getConfig()' to get a setting
   *
   * @function getConfig
   * @memberof OSjs.Core
   * @see OSjs.API.getConfig
   *
   * @return  {Object}
   */
  OSjs.Core.getConfig = OSjs.Core.getConfig || function() {
    return {};
  };

  /**
   * Get default configured packages
   *
   * THIS IS JUST A PLACEHOLDER. 'packages.js' SHOULD HAVE THIS!
   *
   * @function getMetadata
   * @memberof OSjs.Core
   *
   * @return  {Metadata[]}
   */
  OSjs.Core.getMetadata = OSjs.Core.getMetadata || function() {
    return {};
  };

  /**
   * Get running 'Connection' instance
   *
   * @function getConnection
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.Connection}
   */
  OSjs.Core.getConnection = function Core_getConnection() {
    return Connection.instance;
  };

  /**
   * Get running 'Storage' instance
   *
   * @function getStorage
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.Storage}
   */
  OSjs.Core.getStorage = function Core_getStorage() {
    return Storage.instance;
  };

  /**
   * Get running 'Authenticator' instance
   *
   * @function getAuthenticator
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.Authenticator}
   */
  OSjs.Core.getAuthenticator = function Core_getAuthenticator() {
    return Authenticator.instance;
  };

  /**
   * Get the current WindowManager instance
   *
   * @function getWindowManager
   * @memberof OSjs.Core
   *
   * @return {OSjs.Core.WindowManager}
   */
  OSjs.Core.getWindowManager  = function Core_getWindowManager() {
    return WindowManager.instance;
  };

  /**
   * Shortcut for creating a new UIScheme class
   *
   * @function createScheme
   * @memberof OSjs.GUI
   *
   * @param {String}    url     URL to scheme file
   *
   * @return {OSjs.GUI.Scheme}
   */
  OSjs.GUI.createScheme = function(url) {
    return new UIScheme(url);
  };

  /**
   * Gets the browser window rect (x, y, width, height)
   *
   * @function getRect
   * @memberof OSjs.Utils
   *
   * @return {Object}
   */
  OSjs.Utils.getRect = function Utils_getRect() {
    const body = document.body || {};
    return {
      top: 0,
      left: 0,
      width: body.offsetWidth || 0,
      height: body.offsetHeight || 0
    };
  };

  /**
   * Creates a new VFS.File instance
   *
   * @function file
   * @memberof OSjs.VFS
   * @see OSjs.VFS.File
   *
   * @example
   * OSjs.VFS.file('home:///foo').read(<fn>);
   */
  OSjs.VFS.file = function createFileInstance(arg, mime) {
    return new VFS.File(arg, mime);
  };

  /**
   * Triggers a VFS watch event
   *
   * @function triggerWatch
   * @memberof OSjs.VFS.Helpers
   *
   * @param   {String}              method      VFS method
   * @param   {Object}              arg         VFS file
   * @param   {OSjs.Core.Process}   [appRef]    Optional application reference
   */
  OSjs.VFS.Helpers.triggerWatch = function VFS_Helpers_triggerWatch(method, arg, appRef) {
    VFS.broadcastMessage('vfs:' + method, arg, appRef);
  };

  /**
   * Creates a new VFS.File from an upload
   *
   * @function createFileFromUpload
   * @memberof OSjs.VFS.Helpers
   *
   * @param     {String}      destination         Destination path
   * @param     {File}        f                   File
   *
   * @return {OSjs.VFS.File}
   */
  OSjs.VFS.Helpers.createFileFromUpload = function(destination, f) {
    return new VFS.File({
      filename: f.name,
      path: (destination + '/' + f.name).replace(/\/\/\/\/+/, '///'),
      mime: f.mime || 'application/octet-stream',
      size: f.size
    });
  };

  /**
   * Create a new Upload dialog
   *
   * @function createUploadDialog
   * @memberof OSjs.VFS.Helpers
   *
   * @param   {Object}                                     opts                 Options
   * @param   {String}                                     opts.destination     Destination for upload
   * @param   {File}                                       [opts.file]          Uploads this file immediately
   * @param   {Function}                                   cb                   Callback function => fn(error, file, event)
   * @param   {OSjs.Core.Window|OSjs.Core.Application}     [ref]                Set reference in new window
   */
  OSjs.VFS.Helpers.createUploadDialog = function(opts, cb, ref) {
    var destination = opts.destination;
    var upload = opts.file;

    OSjs.API.createDialog('FileUpload', {
      dest: destination,
      file: upload
    }, function(ev, btn, ufile) {
      if ( btn !== 'ok' && btn !== 'complete' ) {
        cb(false, false);
      } else {
        var file = VFS.Helpers.createFileFromUpload(destination, ufile);
        cb(false, file);
      }
    }, ref);
  };

  /**
   * Gets the currently running instance
   *
   * @function getInstance
   * @memberof OSjs.Helpers.GoogleAPI
   *
   * @return  {OSjs.Helpers.GoogleAPI.Class}       Can also be null
   */
  OSjs.Helpers.GoogleAPI.getInstance = function() {
    return GoogleAPI.instance();
  };

  /**
   * Create an instance of GoogleAPI
   *
   * @example
   * The 'load' Array can be filled with either strings, or arrays. ex:
   * - ['drive-realtime', 'drive-share']
   * - [['calendar', 'v1'], 'drive-share']
   *
   * @function createInstance
   * @memberof OSjs.Helpers.GoogleAPI
   *
   * @param   {Object}    args                   Arguments
   * @param   {Array}     args.load              What functions/apis to load
   * @param   {Array}     args.scope             What scopes to load
   * @param   {boolean}   [args.client=false]    Load using gapi.client WILL BE REPLACED!
   * @param   {Function}  callback               Callback function => fn(error, instance)
   */
  OSjs.Helpers.GoogleAPI.createInstance = function(args, callback) {
    return GoogleAPI.craete(args, callback);
  };

  /**
   * Gets the currently running instance
   *
   * @function getInstance
   * @memberof OSjs.Helpers.WindowsLiveAPI
   *
   * @return  {OSjs.Helpers.WindowsLiveAPI.Class}       Can also be null
   */
  OSjs.Helpers.WindowsLiveAPI.getInstance = function() {
    return WindowsLiveAPI.instance();
  };

  /**
   * Create an instance of WindowsLiveAPI
   *
   * @function createInstance
   * @memberof OSjs.Helpers.WindowsLiveAPI
   *
   * @param   {Object}    args           Arguments
   * @param   {Array}     args.load      What functions/apis to load
   * @param   {Function}  callback       Callback function => fn(error, instance)
   */
  OSjs.Helpers.WindowsLiveAPI.createInstance = function(args, callback) {
    return WindowsLiveAPI.create(args, callback);
  };

  /**
   * Gets the currently running instance
   *
   * @function getInstance
   * @memberof OSjs.Helpers.ZipArchiver
   *
   * @return  {OSjs.Helpers.ZipArchiver.Class}       Can also be null
   */
  OSjs.Helpers.ZipArchiver.getInstance = function() {
    return ZipArchiver.instance();
  };

  /**
   * Create an instance of ZipArchiver
   *
   * @function createInstance
   * @memberof OSjs.Helpers.ZipArchiver
   *
   * @param   {Object}    args      Arguments
   * @param   {Function}  callback  Callback function => fn(error, instance)
   */
  OSjs.Helpers.ZipArchiver.createInstance = function(args, callback) {
    ZipArchiver.create(args, callback);
  };

  /**
   * Shortcut for creating a new UIScheme class
   *
   * @summary Helper for loading Dialog scheme files.
   *
   * @constructor DialogScheme
   * @memberof OSjs.GUI
   */
  OSjs.GUI.DialogScheme = (function() {
    var dialogScheme;

    return {

      /**
       * Get the Dialog scheme
       *
       * @function get
       * @memberof OSjs.GUI.DialogScheme#
       *
       * @return {OSjs.GUI.Scheme}
       */
      get: function() {
        return dialogScheme;
      },

      /**
       * Destroy the Dialog scheme
       *
       * @function destroy
       * @memberof OSjs.GUI.DialogScheme#
       */
      destroy: function() {
        if ( dialogScheme ) {
          dialogScheme.destroy();
        }
        dialogScheme = null;
      },

      /**
       * Initialize the Dialog scheme
       *
       * @function init
       * @memberof OSjs.GUI.DialogScheme#
       *
       * @param   {Function}    cb      Callback function
       */
      init: function(cb) {
        if ( dialogScheme ) {
          cb();
          return;
        }

        if ( OSjs.API.isStandalone() ) {
          var html = OSjs.STANDALONE.SCHEMES['/dialogs.html'];
          dialogScheme = new OSjs.GUI.Scheme();
          dialogScheme.loadString(html);
          cb();
          return;
        }

        var root = API.getConfig('Connection.RootURI');
        var url = root + 'dialogs.html';

        dialogScheme = OSjs.GUI.createScheme(url);
        dialogScheme.load(function(error) {
          if ( error ) {
            console.warn('OSjs.GUI.initDialogScheme()', 'error loading dialog schemes', error);
          }
          cb();
        });
      }

    };

  })();

  /*
   * A hidden mountpoint for making HTTP requests via VFS
   */
  OSjs.Core.getMountManager()._add({
    readOnly: true,
    name: 'HTTP',
    transport: 'HTTP',
    description: 'HTTP',
    visible: false,
    searchable: false,
    unmount: function(cb) {
      cb(false, false);
    },
    mounted: function() {
      return true;
    },
    enabled: function() {
      return true;
    },
    root: 'http:///',
    icon: 'places/google-drive.png',
    match: /^https?\:\/\//
  });

  /*
   * This is the Dropbox VFS Abstraction for OS.js
   */
  OSjs.Core.getMountManager()._add({
    readOnly: false,
    name: 'Dropbox',
    transport: 'Dropbox',
    description: 'Dropbox',
    visible: true,
    searchable: false,
    root: 'dropbox:///',
    icon: 'places/dropbox.png',
    match: /^dropbox\:\/\//,
    mount: MountDropbox.mount,
    enabled: MountDropbox.enabled,
    unmount: MountDropbox.unmount,
    request: MountDropbox.request
  });

  /*
   * This is the Google Drive VFS Abstraction for OS.js
   */
  OSjs.Core.getMountManager()._add({
    readOnly: false,
    name: 'GoogleDrive',
    transport: 'GoogleDrive',
    description: 'Google Drive',
    visible: true,
    searchable: false,
    root: 'google-drive:///',
    icon: 'places/google-drive.png',
    match: /^google-drive\:\/\//,
    mount: MountGoogleDrive.mount,
    enabled: MountGoogleDrive.enabled,
    unmount: MountGoogleDrive.unmount,
    request: MountGoogleDrive.request
  });

  /*
   * Browser LocalStorage VFS Module
   *
   * This is *experimental* at best. It involves making a real-ish filesystemwhich
   * I don't have much experience in :P This is why it is disabled by default!
   */
  OSjs.Core.getMountManager()._add({
    readOnly: false,
    name: 'LocalStorage',
    transport: 'LocalStorage',
    description: OSjs.API.getConfig('VFS.LocalStorage.Options.description', 'LocalStorage'),
    visible: true,
    searchable: false,
    root: 'localstorage:///',
    icon: OSjs.API.getConfig('VFS.LocalStorage.Options.icon', 'apps/web-browser.png'),
    match: /^localstorage\:\/\//,
    mount: MountLocalStorage.mount,
    enabled: MountLocalStorage.enabled,
    unmount: MountLocalStorage.unmount,
    request: MountLocalStorage.request
  });

  /*
   * This is the Microsoft OneDrive VFS Abstraction for OS.js
   */
  OSjs.Core.getMountManager()._add({
    readOnly: false,
    name: 'OneDrive',
    transport: 'OneDrive',
    description: 'OneDrive',
    visible: true,
    searchable: false,
    root: 'onedrive:///',
    icon: 'places/onedrive.png',
    match: /^onedrive\:\/\//,
    mount: MountOneDrive.mount,
    enabled: MountOneDrive.enabled,
    unmount: MountOneDrive.unmount,
    request: MountOneDrive.request
  });

  const GUIDataView = require('gui/dataview.js');
  const GUIContainers = require('gui/elements/containers.js');
  const GUIVisual = require('gui/elements/visual.js');
  const GUITabs = require('gui/elements/tabs.js');
  const GUIRichText = require('gui/elements/richtext.js');
  const GUIMisc = require('gui/elements/misc.js');
  const GUIInputs = require('gui/elements/inputs.js');
  const GUITreeView = require('gui/elements/treeview.js');
  const GUIListView = require('gui/elements/listview.js');
  const GUIIconView = require('gui/elements/iconview.js');
  const GUIFileView = require('gui/elements/fileview.js');
  const GUIMenus = require('gui/elements/menus.js');

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

};
