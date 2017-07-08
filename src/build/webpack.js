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

// TODO: Keep special comments in output

const Webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const fs = require('fs-extra');
const path = require('path');
const ocfg = require('./configuration.js');
const opkg = require('./packages.js');
const outils = require('./utils.js');

const ROOT = path.dirname(path.dirname(path.join(__dirname)));

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Gets default plugin list
 * @param {Object} cfg Configuration tree
 * @param {Object} options Options
 * @return {Array}
 */
function getPlugins(cfg, options) {
  const plugins = [
    new ExtractTextPlugin('[name].css')
  ];

  if ( options.debug ) {
    plugins.push(new Webpack.optimize.UglifyJsPlugin({
      minimize: options.minimize === true,
      level: 1, // FIXME
      rebase: false,
      sourceMap: options.sourceMaps === true
    }));
  }

  return plugins;
}

/**
 * Builds an attribute (query) string for loaders
 * @param {Object} attrs Attribute map
 * @return {String}
 */
function getAttrs(attrs) {
  return '?' + Object.keys(attrs).map((a) => {
    return a + '=' + encodeURIComponent(String(attrs[a]));
  }).join('&');
}

/**
 * Transforms scheme file into something client understands
 * @param {String} content HTML content
 * @return {String}
 */
function transformScheme(content) {
  const found = content.match(/<gui\-fragment\s+?data\-fragment\-external=\"(.*)\"\s+?\/>/g);
  if ( found ) {
    found.forEach((f) => {
      let imp = f.split(/<gui\-fragment\s+?data\-fragment\-external=\"(.*)\"\s+?\/>/)[1];
      imp = path.resolve(imp);

      if ( imp && fs.existsSync(imp) ) {
        const w = fs.readFileSync(imp, 'utf-8');
        content = content.replace(f, w);
      }
    });
  }
  return content;
}

///////////////////////////////////////////////////////////////////////////////
// API
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates base Webpack configuration for OS.js
 * @param {Object} options Options
 * @param {Boolean} [options.debug] Debug mode
 * @param {Boolean} [options.minimize] Minimize output
 * @param {Boolean} [options.sourceMaps] Generate source maps
 * @return {Promise}
 */
const createConfiguration = (options) => new Promise((resolve, reject) => {
  options = Object.assign({
    debug: process.env.OSJS_DEBUG === 'true',
    minimize: true,
    sourceMaps: true
  }, (options || {}));

  const cssAttrs = getAttrs({sourceMap: options.sourceMaps, minimize: options.minimize});

  ocfg.readConfigurationTree().then((cfg) => {
    const sourceMapType = options.debug ? 'eval-source-map' : 'source-map';

    resolve({
      cfg: cfg,
      webpack: {
        plugins: getPlugins(cfg, options),
        devtool: sourceMapType,

        resolve: {
          modules: [
            path.join(ROOT, 'src/client/javascript')
          ]
        },

        entry: {

        },

        output: {
          sourceMapFilename: '[name].js.map',
          filename: '[name].js'
        },

        module: {
          loaders: [
            {
              test: /\.(png|jpe?g|ico)$/,
              loader: 'file-loader'
            },
            {
              test: /\.html$/,
              loader: 'html-loader'
            },
            {
              test: /\.js$/,
              exclude: /(node_modules|bower_components)/,
              use: {
                loader: 'babel-loader',
                options: {
                  cacheDirectory: true,
                  plugins: [
                  ]
                }
              }
            },
            {
              test: /\.css$/,
              loader: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: 'css-loader' + cssAttrs
              })
            },
            {
              test: /\.less$/,
              loader: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: 'css-loader' + cssAttrs + '!less-loader'
              })
            }
          ]
        }
      }
    });

  }).catch(reject);
});

/**
 * Creates base Webpack configuration for OS.js Packages
 * @param {String} metadataFile The metadata path of package
 * @param {Object} options Options
 * @param {Boolean} [options.debug] Debug mode
 * @param {Boolean} [options.minimize] Minimize output
 * @param {Boolean} [options.sourceMaps] Generate source maps
 * @return {Promise}
 */
const createPackageConfiguration = (metadataFile, options) => new Promise((resolve, reject) => {
  opkg.readMetadataFile(metadataFile).then((metadata) => {
    const dest = path.join(ROOT, 'dist/packages', metadata.path);

    const packageRoot = path.dirname(metadataFile); // FIXME
    const packageEntry = {
      main: metadata.preload.map((preload) => preload.src)
    };

    createConfiguration(options).then((result) => {
      const wcfg = outils.mergeObject(result.webpack, {
        resolve: {
          modules: [
            path.join(ROOT, 'src/client/javascript'),
            packageRoot
          ]
        },

        entry: packageEntry,

        output: {
          publicPath: './',
          path: dest
        },

        externals: {
          'OSjs': 'OSjs'
        }
      });

      wcfg.module.loaders.push({
        test: /((\w+)\.(eot|svg|ttf|woff|woff2))$/,
        loader: 'file-loader?name=[name].[ext]'
      });

      wcfg.plugins.push(new CopyWebpackPlugin([ // FIXME
        {
          from: path.join(packageRoot, 'scheme.html'),
          transform: (content, p) => transformScheme(String(content))
        }
      ], {
        ignore: [
          '*.less'
        ]
      }));

      resolve({
        cfg: result.cfg,
        webpack: wcfg
      });
    }).catch(reject);
  }).catch(reject);
});

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = {
  createConfiguration,
  createPackageConfiguration
};
