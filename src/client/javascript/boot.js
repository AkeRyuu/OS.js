window.OSjs = window.OSjs || {};

import polyfill from 'polyfill';
import {start} from 'core/init';

const run = () => {
  polyfill();
  start();
};

if ( document.readyState !== 'loading' ) {
  run();
} else {
  document.addEventListener('DOMContentLoaded', () => run());
}
