/* eslint new-cap:"off" */
module.exports = function() {
  /**
   * @namespace Bootstrap
   * @memberof OSjs
   */
  window.OSjs = window.OSjs || {};

  // Make sure these namespaces exist
  (['Utils', 'API', 'GUI', 'Core', 'Dialogs', 'Helpers', 'Applications', 'Locales', 'VFS', 'Extensions', 'Auth', 'Storage', 'Connections', 'Broadway']).forEach(function(ns) {
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
  const Assets = require('core/assets.js');

  const BroadwayKeytable = require('broadway/unicode.js');
  const BroadwayConnection = require('broadway/connection.js');
  const BroadwayWindow = require('broadway/window.js');
  const Broadway = require('broadway/broadway.js');

  const ExtendedDate = require('helpers/date.js');
  const DefaultApplicationWindow = require('helpers/default-application-window.js');
  const DefaultApplication = require('helpers/default-application.js');
  const EventHandler = require('helpers/event-handler.js');
  const IFrameApplication = require('helpers/iframe-application.js');
  const IFrameApplicationWindow = require('helpers/iframe-application-window.js');
  const GoogleAPI = require('helpers/google-api.js');
  const WindowsLiveAPI = require('helpers/windows-live-api.js');
  const SettingsFragment = require('helpers/settings-fragment.js');
  const ZipArchiver = require('helpers/zip-archiver.js');
  const ServiceNotificationIcon = require('helpers/service-notification-icon.js');

  const VFS = require('vfs/fs.js');
  const VFSFile = require('vfs/file.js');
  const VFSFileData = require('vfs/filedataurl.js');

  const FS = require('utils/fs.js');
  const DOM = require('utils/dom.js');
  const Preloader = require('utils/preloader.js');
  const Utils = require('utils/misc.js');
  const Events = require('utils/events.js');
  const Compability = require('utils/compability.js');
  const Locales = require('core/locales.js');
  const Config = require('core/config.js');
  const Dialog = require('core/dialog.js');
  const Main = require('core/main.js');
  const Clipboard = require('utils/clipboard.js');
  const Keycodes = require('utils/keycodes.js');

  const Init = require('core/init.js');

  const UIElement = require('gui/element.js');
  const UIDataView = require('gui/dataview.js');
  const UIScheme = require('gui/scheme.js');
  const GUIHelpers = require('utils/gui.js');
  const Hooks = require('helpers/hooks.js');

  const assignInto = (lib, ns) => {
    return Object.keys(lib).forEach((k) => {
      ns[k] = lib[k];
    });
  };

  OSjs.Core.DialogWindow = Dialog.default;
  OSjs.Core.Window = Object.seal(require('core/window.js').default);
  OSjs.Core.WindowManager = Object.seal(WindowManager.default);
  OSjs.Core.Service = Object.seal(require('core/service.js').default);
  OSjs.Core.Process = Object.seal(Process.default);
  OSjs.Core.Application = Object.seal(require('core/application.js').default);

  OSjs.Dialogs.Alert = Object.seal(require('dialogs/alert.js').default);
  OSjs.Dialogs.ApplicationChooser = Object.seal(require('dialogs/applicationchooser.js').default);
  OSjs.Dialogs.Color = Object.seal(require('dialogs/color.js').default);
  OSjs.Dialogs.Confirm = Object.seal(require('dialogs/confirm.js').default);
  OSjs.Dialogs.Error = Object.seal(require('dialogs/error.js').default);
  OSjs.Dialogs.File = Object.seal(require('dialogs/file.js').default);
  OSjs.Dialogs.FileInfo = Object.seal(require('dialogs/fileinfo.js').default);
  OSjs.Dialogs.FileProgress = Object.seal(require('dialogs/fileprogress.js').default);
  OSjs.Dialogs.FileUpload = Object.seal(require('dialogs/fileupload.js').default);
  OSjs.Dialogs.Font = Object.seal(require('dialogs/font.js').default);
  OSjs.Dialogs.Input = Object.seal(require('dialogs/input.js').default);

  OSjs.GUI.Element = Object.seal(UIElement.default);
  OSjs.GUI.DataView = Object.seal(UIDataView.default);
  OSjs.GUI.Scheme = Object.seal(UIScheme.default);
  OSjs.GUI.Helpers = Object.seal(GUIHelpers);

  assignInto(Hooks, OSjs.API);
  assignInto(VFS, OSjs.VFS);
  OSjs.VFS.FileDataURL = VFSFileData.default;
  OSjs.VFS.File = VFSFile.default;
  assignInto(FS, OSjs.VFS.Helpers);

  /*
  OSjs.VFS.Transports.Applications = require('vfs/transports/applications.js').default;
  OSjs.VFS.Transports.Dist = require('vfs/transports/dist.js').default;
  OSjs.VFS.Transports.HTTP = require('vfs/transports/http.js').default;
  OSjs.VFS.Transports.OSjs = require('vfs/transports/osjs.js').default;
  OSjs.VFS.Transports.Web = require('vfs/transports/web.js').default;
  OSjs.VFS.Transports.WebDAV = require('vfs/transports/webdav.js').default;
  */

  assignInto(FS, OSjs.Utils);
  assignInto(DOM, OSjs.Utils);
  assignInto(Utils, OSjs.Utils);
  assignInto(Events, OSjs.Utils);
  assignInto(Compability, OSjs.Utils);

  OSjs.Utils.Keys = Keycodes.default;
  OSjs.Utils.preload = function() {
    console.error('THIS FUNCTION WAS REMOVED');
  };
  OSjs.Utils.preloader = Preloader.default.preload;

  OSjs.Helpers.Date = ExtendedDate.default;
  OSjs.Helpers.DefaultApplicationWindow = DefaultApplicationWindow.default;
  OSjs.Helpers.DefaultApplication = DefaultApplication.default;
  OSjs.Helpers.EventHandler = EventHandler.default;
  OSjs.Helpers.IFrameApplication = IFrameApplication.default;
  OSjs.Helpers.IFrameApplicationWindow = IFrameApplicationWindow.default;
  OSjs.Helpers.SettingsFragment = SettingsFragment.default;
  OSjs.Helpers.GoogleAPI = OSjs.Helpers.GoogleAPI || {};
  OSjs.Helpers.WindowsLiveAPI = OSjs.Helpers.WindowsLiveAPI || {};
  OSjs.Helpers.ZipArchiver = OSjs.Helpers.ZipArchiver || {};

  OSjs.API.killAll = Process.default.killAll;
  OSjs.API.kill = Process.default.kill;
  OSjs.API.message = Process.default.message;
  OSjs.API.getProcess = Process.default.getProcess;
  OSjs.API.getProcesses = Process.default.getProcesses;
  OSjs.API._ = Locales._;
  OSjs.API.__ = Locales.__;
  OSjs.API.setLocale = Locales.setLocale;
  OSjs.API.getLocale = Locales.getLocale;
  OSjs.API.getConfig = Config.getConfig;
  OSjs.API.getDefaultPath = Config.getDefaultPath;
  OSjs.API.isStandalone = Config.isStandalone;
  OSjs.API.getBrowserPath = Config.getBrowserPath;
  OSjs.API.createDialog = Dialog.default.create;
  OSjs.API.createMenu = GUIHelpers.createMenu;
  OSjs.API.blurMenu = GUIHelpers.blurMenu;
  OSjs.API.signOut = Init.logout;
  OSjs.API.createNotification = (opts) => WindowManager.instance.notification(opts);
  assignInto(Assets, OSjs.API);
  assignInto(Main, OSjs.API);
  assignInto(Clipboard, OSjs.API);

  /**
   * @namespace Connection
   * @memberof OSjs.Broadway
   */
  OSjs.Broadway.Keytable = BroadwayKeytable;
  OSjs.Broadway.Connection = BroadwayConnection;
  OSjs.Broadway.Window = BroadwayWindow;
  OSjs.Broadway.GTK = Broadway;

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
  module.exports.getServiceNotificationIcon = function() {
    return ServiceNotificationIcon;
  };

  OSjs.API.launch = function(name, args, ondone, onerror, onconstruct) {
    ondone = ondone || function() {};
    onerror = onerror || function() {};

    Main.launch(name, args, onconstruct)
      .then(ondone)
      .catch(onerror);
  };

  OSjs.API.launchList = function(list, onSuccess, onError, onFinished) {
    list        = list        || []; /* idx => {name: 'string', args: 'object', data: 'mixed, optional'} */
    onSuccess   = onSuccess   || function() {};
    onError     = onError     || function() {};
    onFinished  = onFinished  || function() {};

    Main.launchList(list, onSuccess).then(onFinished).catch(onError);
  };

  OSjs.API.open = function(file, launchArgs) {
    return Main.openFile(file, launchArgs);
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
  OSjs.API.relaunch = function(n) {
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
  OSjs.API.call = function(m, a, cb, options) {
    Connection.request(m, a, cb, options);
  };

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
  OSjs.API.getApplicationResource = function(app, name, vfspath) {
    return Assets.getPackageResource(app, name, vfspath);
  };

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
  OSjs.API.curl = function(args, callback) {
    args = args || {};
    callback = callback || {};

    let opts = args.body;
    if ( typeof opts === 'object' ) {
      console.warn('DEPRECATION WARNING', 'The \'body\' wrapper is no longer needed');
    } else {
      opts = args;
    }

    return Connection.request('curl', opts, callback, args.options);
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
    return Authenticator.default.instance().checkPermission(group);
  };

  /**
   * Get the current SettingsManager  instance
   *
   * @function getSettingsManager
   * @memberof OSjs.Core
   * @return {OSjs.Core.SettingsManager}
   */
  OSjs.Core.getSettingsManager = function Core_getSettingsManager() {
    return SettingsManager.default;
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
    return SearchEngine.default;
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
    return PackageManager.default;
  };

  /**
   * Get the current MountManager  instance
   *
   * @function getMountManager
   * @memberof OSjs.Core
   * @return {OSjs.Core.MountManager}
   */
  OSjs.Core.getMountManager = function Core_getMountManager() {
    return MountManager.default;
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
    return Connection.default.instance;
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
    return Storage.default.instance;
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
    return Authenticator.default.instance;
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
    return WindowManager.default.instance;
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
    console.error('FUNCTION REMOVED');
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
    return new VFSFile.default(arg, mime);
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
        var file = VFSFile.default.fromUpload(destination, ufile);
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
   * Alias of unlink
   *
   * @function delete
   * @memberof OSjs.VFS
   * @alias OSjs.VFS.unlink
   */
  (function() {
    /*eslint dot-notation: "off"*/
    OSjs.VFS['delete'] = function VFS_delete(item, callback) {
      OSjs.VFS.unlink.apply(this, arguments);
    };
  })();

};
