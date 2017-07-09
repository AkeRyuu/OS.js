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

// TODO: Overlays

const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const path = require('path');
const osjs = require('./src/build/index.js');

///////////////////////////////////////////////////////////////////////////////
// GLOBALS
///////////////////////////////////////////////////////////////////////////////

const debug = process.env.OSJS_DEBUG ===  'true';

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

const getAbsolute = (iter) => path.join(__dirname, iter.replace(/^(dev|prod):/, ''));
const getTemplateFile = (filename) => path.join(__dirname, 'src/templates/dist', 'default', filename);
const getThemePath = (type) => path.join(__dirname, 'src/client/themes', type);
const getThemeFile = (type, name) => path.join(__dirname, 'src/client/themes', type, name);
const getStyleFile = (name) => path.join(__dirname, 'src/client/themes/styles', name, 'style.less');
const getFontFile = (font) => path.join(__dirname, 'src/client/themes/fonts', font, 'style.css');

function getBuildFiles(opts) {
  const merges = Object.assign({
    javascripts: [],
    stylesheets: [],
    locales: []
  }, opts);

  if ( opts.overlays ) {
    Object.keys(opts.overlays).forEach((k) => {
      const a = opts.overlays[k];
      if ( a ) {
        Object.keys(merges).forEach((m) => {
          if ( a[m] instanceof Array ) {
            merges[m] = merges[m].concat(a[m]);
          }
        });
      }
    });
  }

  return merges;
}

function getFiltered(i) {
  if ( i.match(/^dev:/) && !debug ) {
    return false;
  }
  if ( i.match(/^prod:/) && debug ) {
    return false;
  }
  return true;
}

function getCoreFiles(cfg) {
  const bf = getBuildFiles(cfg.build);

  let files = [];
  files = files.concat([getAbsolute(bf.javascript)]);
  files = files.concat(bf.stylesheets.filter(getFiltered).map((n) => getAbsolute(n)));

  return files;
}

function getLocaleFiles(cfg) {
  const bf = getBuildFiles(cfg.build);
  const files = bf.locales.filter(getFiltered).map(getAbsolute);

  return files;
}

function getThemeFiles(cfg) {
  let files = [];
  files = files.concat(cfg.themes.fonts.map(getFontFile));
  files = files.concat(cfg.themes.styles.map(getStyleFile));

  return files;
}

function getStaticFiles(cfg) {
  let files = [
    {from: getAbsolute('src/client/dialogs.html')},
    {from: getTemplateFile('api.php')},
    {from: getTemplateFile('blank.css')},
    {
      context: getThemePath('wallpapers'),
      from: '*',
      to: 'themes/wallpapers'
    }
  ];

  files = files.concat(cfg.themes.styles.map((i) => {
    return {
      from: path.join(getThemeFile('styles', i), 'theme.js'),
      to: 'themes/styles/' + i
    };
  }));

  files = files.concat(cfg.themes.icons.map((i) => {
    return {
      from: getThemeFile('icons', i),
      to: 'themes/icons/' + i
    };
  }));

  files = files.concat(cfg.themes.sounds.map((i) => {
    return {
      from: getThemeFile('sounds', i),
      to: 'themes/sounds/' + i
    };
  }));

  return files;
}

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = new Promise((resolve, reject) => {
  osjs.webpack.createConfiguration().then((result) => {
    let {cfg, webpack, options} = result;

    if ( options.verbose ) {
      console.log('Build options', JSON.stringify(options));
    }

    if ( options.assets !== false ) {
      webpack.plugins = webpack.plugins.concat([
        new HtmlWebpackPlugin({
          template: getTemplateFile('index.ejs'),
          osjs: {
            scripts: [
              'settings.js',
              'osjs.js',
              'locales.js'
            ],
            styles: [
              'osjs.css',
              'themes.css'
            ]
          }
        }),

        new FaviconsWebpackPlugin(getTemplateFile('favicon.png')),

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

    resolve(osjs.utils.mergeObject(webpack, {
      entry: {
        locales: getLocaleFiles(cfg),
        osjs: getCoreFiles(cfg),
        themes: getThemeFiles(cfg)
      },
      output: {
        publicPath: '/',
        path: getAbsolute('dist')
      }
    }));
  }).catch(reject);
});
