require('polyfill.js')();
require('compability.js')();

const boot = require('core/boot.js');

window.addEventListener('DOMContentLoaded', () => boot.run());
