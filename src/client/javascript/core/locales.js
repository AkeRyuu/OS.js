import {format} from 'utils/misc';

let DefaultLocale = 'en_EN';
let CurrentLocale = 'en_EN';
let CurrentRTL = [];

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
export function _() {
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

    return a.length > 1 ? format.apply(null, a) : a[0];
  } catch ( e ) {
    console.warn(e.stack, e);
  }

  return s;
}

/**
 * Same as _ only you can supply the list as first argument
 *
 * @function __
 * @memberof OSjs.API
 * @see _
 *
 * @return {String}
 */
export function __() {
  const l = arguments[0];
  const s = arguments[1];

  let a = Array.prototype.slice.call(arguments, 1);
  if ( l[CurrentLocale] && l[CurrentLocale][s] ) {
    a[0] = l[CurrentLocale][s];
  } else {
    a[0] = l[DefaultLocale] ? (l[DefaultLocale][s] || s) : s;
    if ( a[0] && a[0] === s ) {
      a[0] = _.apply(null, a);
    }
  }

  return a.length > 1 ? format.apply(null, a) : a[0];
}

/**
 * Get current locale
 *
 * @function getLocale
 * @memberof OSjs.API
 *
 * @return {String}
 */
export function getLocale() {
  return CurrentLocale;
}

/**
 * Set locale
 *
 * @function setLocale
 * @memberof OSjs.API
 *
 * @param  {String}   l     Locale name
 */
export function setLocale(l) {
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
    html.setAttribute('dir', CurrentRTL.indexOf(major) !== -1 ? 'rtl' : 'ltr');
  }

  console.info('API::setLocale()', CurrentLocale);
}

export function init(options) {
  options = options || {};

  CurrentRTL = options.RTL || [];
}
