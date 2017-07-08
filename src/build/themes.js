'use strict';

const glob = require('glob-promise');
const fs = require('fs-extra');
const path = require('path');

const ROOT = path.dirname(path.dirname(path.join(__dirname)));

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Reads metadata from a globbing
 * @param {String} dir Base directory
 * @param {Array} whitelist Whitelisted entries
 * @param {Boolean} isFont Toggle font reading
 * @return {Promise}
 */
const readMetadataFrom = (dir, whitelist, isFont) => new Promise((resolve, reject) => {
  const basePath = path.join(ROOT, 'src', 'client', 'themes');
  whitelist = whitelist || [];

  if ( isFont ) {
    glob(path.join(basePath, dir, '*', 'style.css')).then((files) => {
      resolve(files.map((check) => path.basename(path.dirname(check))));
    });
    return;
  }

  glob(path.join(basePath, dir, '*', 'metadata.json')).then((files) => {
    const list = files.filter((check) => {
      const d = path.basename(path.dirname(check));
      return whitelist.indexOf(d) >= 0;
    }).map((check) => fs.readJsonSync(check));

    resolve(list);
  }).catch(reject);
});

///////////////////////////////////////////////////////////////////////////////
// API
///////////////////////////////////////////////////////////////////////////////

/**
 * Gets metadata for all the themes
 *
 * @param {Object} cfg Configuration tree
 * @param {Object} cli CLI wrapper
 * @return {Promise}
 */
const getMetadata = (cfg, cli) => new Promise((resolve, reject) => {
  const result = {
    sounds: [],
    icons: [],
    fonts: [],
    styles: []
  };

  const keys = Object.keys(result);
  const promises = keys.map((n) => new Promise((yes, no) => {
    readMetadataFrom(n, cfg.themes[n], n === 'fonts')
      .then((list) => yes(result[n] = list))
      .catch(no);
  }));

  Promise.all(promises)
    .then(() => resolve(result))
    .catch(reject);
});

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = {
  getMetadata
};
