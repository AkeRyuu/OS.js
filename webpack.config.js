'use strict';

// TODO: Overlays
// TODO: Keep special comments in output

const Webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const _path = require('path');
const _config = require('./src/build/config.js');
const _build = require('./src/build/core.js');

///////////////////////////////////////////////////////////////////////////////
// GLOBALS
///////////////////////////////////////////////////////////////////////////////

const debug = true;
const sourceMaps = true;
const minimize = true;
const sourceMapType = debug ? 'eval-source-map' : 'source-map';

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

const getAbsolute = (iter) => _path.join(__dirname, iter.replace(/^(dev|prod):/, ''));
const getTemplateFile = (filename) => _path.join(__dirname, 'src/templates/dist', 'default', filename);
const getThemePath = (type) => _path.join(__dirname, 'src/client/themes', type);
const getThemeFile = (type, name) => _path.join(__dirname, 'src/client/themes', type, name);
const getStyleFile = (name) => _path.join(__dirname, 'src/client/themes/styles', name, 'style.less');
const getFontFile = (font) => _path.join(__dirname, 'src/client/themes/fonts', font, 'style.css');

function getFiltered(i) {
  if ( i.match(/^dev:/) && !debug ) {
    return false;
  }
  if ( i.match(/^prod:/) && debug ) {
    return false;
  }
  return true;
}

function getBuildFiles(cfg) {
  const bf = _build.getBuildFiles(cfg.build);

  let files = [];
  files = files.concat([getAbsolute(bf.javascript)]);
  files = files.concat(bf.stylesheets.filter(getFiltered).map((n) => getAbsolute(n)));

  return files;
}

function getLocaleFiles(cfg) {
  const bf = _build.getBuildFiles(cfg.build);
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

function getPlugins(cfg) {
  const plugins = [
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
    }),
    new ExtractTextPlugin('[name].css')
  ];

  if ( debug ) {
    plugins.push(new Webpack.optimize.UglifyJsPlugin({
      minimize: minimize,
      level: 1, // FIXME
      rebase: false,
      sourceMap: sourceMaps
    }));
  }

  return plugins;
}

function getAttrs(attrs) {
  return '?' + Object.keys(attrs).map((a) => {
    return a + '=' + encodeURIComponent(String(attrs[a]));
  }).join('&');
}

const cssAttrs = getAttrs({sourceMap: sourceMaps, minimize: minimize});

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = new Promise((resolve) => {

  _config.getConfiguration().then((cfg) => {

    resolve({
      plugins: getPlugins(cfg),
      devtool: sourceMapType,

      resolve: {
        modules: [
          _path.resolve(getAbsolute('src/client/javascript'))
        ]
      },

      entry: {
        locales: getLocaleFiles(cfg),
        osjs: getBuildFiles(cfg),
        themes: getThemeFiles(cfg)
      },

      output: {
        publicPath: '/',
        path: getAbsolute('dist'),
        sourceMapFilename: '[name].js.map',
        filename: '[name].js'
      },

      module: {
        loaders: [
          {
            test: /((\w+)\.(eot|svg|ttf|woff|woff2))$/,
            loader: 'file-loader?name=themes/fonts/[name].[ext]'
          },
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
    });
  });
});
