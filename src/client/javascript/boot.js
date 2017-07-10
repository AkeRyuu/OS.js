window.OSjs = window.OSjs || {};

import polyfill from 'polyfill';
import compability from 'compability';
import {run} from 'core/init';

const start = () => {
  polyfill();
  compability();
  run();
};

if ( document.readyState !== 'loading' ) {
  start();
} else {
  document.addEventListener('DOMContentLoaded', () => start());
}
