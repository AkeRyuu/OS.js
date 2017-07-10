import Promise from 'bluebird';
import promiseLimit from 'promise-limit';
import {getBrowserPath} from 'core/config';
import axios from 'axios';

/**
 * Gets file type
 */
const getFileType = (src) => {
  if ( src.match(/\.js$/i) ) {
    return 'javascript';
  } else if ( src.match(/\.css$/i) ) {
    return 'stylesheet';
  }/* else if ( src.match(/\.html?$/i) ) {
    return 'html';
  }*/
  return 'unknown';
};

/**
 * Ensures correct base uris
 */
const getSource = (src) => {
  if ( !src.match(/^(\/|file|https?)/) ) {
    return getBrowserPath(src);
  }
  return src;
};

/**
 * Check if CSS has been loaded
 */
const checkCss = (path) => {
  let result = false;
  (document.styleSheet || []).forEach((iter, i) => {
    if ( iter.href.indexOf(path) !== -1 ) {
      result = true;
      return false;
    }
    return true;
  });
  return result;
};

/*
 * Preload File Type Handlers
 */
const handlers = {
  javascript: (src) => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.onreadystatechange = function() {
      if ( (this.readyState === 'complete' || this.readyState === 'loaded') ) {
        resolve();
      }
    };
    el.onerror = (err) => reject(err || 'general error');
    el.onload = () => resolve();
    el.src = src;

    document.getElementsByTagName('head')[0].appendChild(el);
  }),

  stylesheet: (src) => new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    link.onload = () => resolve();
    link.onerror = (err) => reject(err || 'general error');
    link.setAttribute('href', src);

    document.getElementsByTagName('head')[0].appendChild(link);

    let timeout = setTimeout(() => {
      clearTimeout(timeout);
      reject('timeout');
    }, 30000);

    setTimeout(() => {
      if ( checkCss(src) ) {
        clearTimeout(timeout);
        resolve();
      }
    }, 10);
  }),

  scheme: (src) => new Promise((resolve, reject) => {
    axios.get(src).then((result) => {
      resolve(result.data);
    }).catch((err) => reject(err.message));
  })

};

class Preloader {
  preload(preloads, args) {
    args = args || {};

    preloads = preloads.map((p) => {
      if ( typeof p === 'string' ) {
        return {
          src: getSource(p),
          force: false,
          type: getFileType(p)
        };
      } else {
        if ( p.src ) {
          p.src = getSource(p.src);
        }

        if ( !p.type ) {
          p.type = getFileType(p.src);
        }
      }

      return p;
    }).filter((p) => !!p.src);

    console.group('Preloader.load()', preloads);

    const limit = promiseLimit(args.max || 1);
    const total = preloads.length;
    const failed = [];
    const loaded = [];
    const data = [];

    const job = (item, index) => {
      if ( typeof args.progress === 'function' ) {
        args.progress(index, total);
      }

      if ( handlers[item.type] ) {
        return new Promise((yes, no) => {
          handlers[item.type](item.src).then((preloadData) => {
            if ( typeof preloadData !== 'undefined' ) {
              data.push({item, data: preloadData});
            }

            loaded.push(item.src);
            return yes();
          }).catch((e) => {
            console.warn('Failed loading', item.src, e);
            failed.push(item.src);
            return yes();
          });
        });
      }

      return Promise.resolve();
    };

    return new Promise((resolve, reject) => {
      Promise.all(preloads.map((iter, index) => {
        return limit(() => job(iter, index));
      })).then(() => {
        console.groupEnd();

        return resolve({
          success: false,
          data: data,
          failed: failed,
          loaded: loaded
        });
      }).catch(reject);
    });
  }
}

export default (new Preloader());
