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

const colors = require('colors');
const ygor = require('ygor');
const promise = require('bluebird');
const path = require('path');
const opkg = require('./packages.js');
const ocfg = require('./configuration.js');

const ROOT = path.dirname(path.dirname(path.join(__dirname)));

const debug = true;

/**
 * Wrapper for CLI object
 * @param {Object} cli CLI
 * @return {Object}
 */
const cliWrapper = (cli) => {
  return {
    debug: debug,
    cli: cli,
    option: (k, defaultValue) => {
      if ( typeof cli[k] === 'undefined' ) {
        return defaultValue;
      }
      return cli[k];
    }
  };
};

/**
 * Wrapper for creating new tasks
 * @param {Object} cli CLI
 * @param {Function} fn Callback function => (cfg, resolve, reject)
 * @return {Promise}
 */
const newTask = (cli, fn) => new Promise((resolve, reject) => {
  ocfg.readConfigurationTree().then((cfg) => {
    const promise = fn(cliWrapper(cli), cfg, resolve, reject);
    if ( promise instanceof Promise ) {
      promise.then(resolve).catch(reject);
    }
  }).catch(reject);
});

/*
 * All tasks
 */
const tasks = {

  'watch': () => Promise.reject('Not implemented'),

  'config:set': (cli) => newTask(cli, (cli, cfg, resolve, reject) => {
    const name = cli.option('name');
    ocfg.setConfiguration(name,
                          cli.option('value'),
                          cli.option('import'),
                          cli.option('out')
    ).then((value) => {
      console.log(name, '=', value);
      resolve();
    }).catch(reject);
  }),

  'config:get': (cli) => newTask(cli, (cli, cfg, resolve, reject) => {
    const name = cli.option('name');
    if ( name ) {
      console.log(name, '=', ocfg.getConfiguration(cfg, name));
      resolve();
    } else {
      reject('You need to give --name');
    }
  }),

  'build:config': (cli) => newTask(cli, (cli, cfg, resolve, reject) => {
    console.info('Building', colors.blue('configuration'));
    return Promise.all([
      ocfg.buildClientConfiguration(cfg, cli),
      ocfg.buildServerConfiguration(cfg, cli)
    ]);
  }),

  'build:manifest': (cli) => newTask(cli, (cli, cfg, resolve, reject) => {
    console.info('Building', colors.blue('manifest'));
    return Promise.all([
      opkg.buildClientManifest(cfg, cli),
      opkg.buildServerManifest(cfg, cli)
    ]);
  }),

  'build:packages': (cli) => newTask(cli, (cli, cfg, resolve, reject) => {
    console.info('Building', colors.blue('packages'));
    opkg.buildPackages(cfg, cli, ygor).then(resolve).catch(reject);
  }),

  'build:package': (cli, ygor) => newTask(cli, (cli, cfg, resolve, reject) => {
    opkg.buildPackage(cfg, cli, ygor).then(resolve).catch(reject);
  }),

  'build:core': (cli, ygor) => {
    console.info('Building', colors.blue('core'));

    return ygor.shell('webpack', {
      env: {
        OSJS_DEBUG: String(debug)
      }
    });
  },

  'build': (cli, ygor) => {
    const tasks = [
      'build:config',
      'build:manifest',
      'build:core',
      'build:packages'
    ];

    return promise.each(tasks, ygor.run);
  },

  'run': () => {
    const exe = path.join(ROOT, 'src', 'server', 'node', 'server.js');
    const args = process.argv.slice(2).join(' ');
    return ygor.shell(['node', exe, args].join(' '));
  }

};

Object.keys(tasks).forEach((name) => ygor.task(name, tasks[name]));
