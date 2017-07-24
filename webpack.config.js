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

const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const path = require('path');
const osjs = require('osjs-build');

///////////////////////////////////////////////////////////////////////////////
// GLOBALS
///////////////////////////////////////////////////////////////////////////////

const debug = process.env.OSJS_DEBUG ===  'true';
const standalone = process.env.OSJS_STANDALONE === 'true';

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

const fixPath = (iter) => iter.replace(/^(dev|prod|standalone):/, '');
const getAbsolute = (filename) => path.resolve(__dirname, filename);
const getTemplateFile = (tpl, filename) => path.join(__dirname, 'src/templates/dist', tpl || 'default', filename);
const getThemePath = (type) => path.join(__dirname, 'src/client/themes', type);
const getThemeFile = (type, name) => path.join(__dirname, 'src/client/themes', type, name);
const getStyleFile = (name) => path.join(__dirname, 'src/client/themes/styles', name, 'style.less');
const getFontFile = (font) => path.join(__dirname, 'src/client/themes/fonts', font, 'style.css');

function getFiltered(i) {
  if ( i.match(/^dev:/) && !debug ) {
    return false;
  }
  if ( i.match(/^prod:/) && debug ) {
    return false;
  }
  if ( i.match(/^standalone:/) && !standalone ) {
    return false;
  }
  return true;
}

function getThemeFiles(cfg) {
  let files = [];
  files = files.concat(cfg.themes.fonts.map(getFontFile));
  files = files.concat(cfg.themes.styles.map(getStyleFile));

  return files;
}

function getStaticFiles(cfg) {
  let files = [
    {
      context: getAbsolute(getThemePath('wallpapers')),
      from: '*',
      to: 'themes/wallpapers'
    }
  ];

  files = files.concat(cfg.build.static.filter(getFiltered).map((i) => {
    return {
      from: getAbsolute(fixPath(i))
    };
  }));

  files = files.concat(cfg.themes.styles.map((i) => {
    return {
      from: getAbsolute(path.join(getThemeFile('styles', i), 'theme.js')),
      to: 'themes/styles/' + i
    };
  }));

  files = files.concat(cfg.themes.icons.map((i) => {
    return {
      from: getAbsolute(getThemeFile('icons', i)),
      to: 'themes/icons/' + i
    };
  }));

  files = files.concat(cfg.themes.sounds.map((i) => {
    return {
      from: getAbsolute(getThemeFile('sounds', i)),
      to: 'themes/sounds/' + i
    };
  }));

  return files;
}

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = new Promise((resolve, reject) => {
  osjs.webpack.createConfiguration({
    exclude: /node_modules\/(?![axios|bluebird|simplejsonconf])/
  }).then((result) => {
    let {cfg, webpack, options} = result;

    if ( options.verbose ) {
      console.log('Build options', JSON.stringify(options));
    }

    if ( options.assets !== false ) {
      webpack.plugins = webpack.plugins.concat([
        new HtmlWebpackPlugin({
          template: getTemplateFile(cfg.build.template, 'index.ejs'),
          osjs: {
            scripts: cfg.build.includes.scripts.filter(getFiltered).map(fixPath),
            styles: cfg.build.includes.styles.filter(getFiltered).map(fixPath)
          }
        }),

        new FaviconsWebpackPlugin(getTemplateFile(cfg.build.template, 'favicon.png')),

        new CopyWebpackPlugin(getStaticFiles(cfg), {
          ignore: [
            '*.less'
          ]
        })
      ]);
    }

    webpack.module.loaders.push({
      test: /((\w+)\.(eot|svg|ttf|woff|woff2))$/,
      loader: 'file-loader?name=themes/fonts/[name].[ext]'
    });

    const webpackConfig = Object.assign({}, cfg.build.webpack);
    webpackConfig.entry.themes = getThemeFiles(cfg);

    Object.keys(webpackConfig.entry).forEach((k) => {
      webpackConfig.entry[k] = webpackConfig.entry[k]
        .filter(getFiltered)
        .map(fixPath)
        .map(getAbsolute)
        .map(osjs.utils.fixWinPath);
    });

    const finalConfig = osjs.utils.mergeObject(webpack, webpackConfig);
    // Fixes "not an absolute path" problem in Webpack
    finalConfig.output.path = path.resolve(finalConfig.output.path);
    finalConfig.resolve.modules = finalConfig.resolve.modules.map(osjs.utils.fixWinPath);
    resolve(finalConfig);
  }).catch(reject);
});
