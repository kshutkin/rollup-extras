// D3 loaded via script-loader as a showcase for @rollup-extras/plugin-script-loader
import 'script!d3/dist/d3.min.js';

// Angular framework (ES module imports, handled by @rollup/plugin-commonjs)
import 'angular';
import 'angular-route';
import 'angular-resource';

// External web component (prebundled by @rollup-extras/plugin-prebundle)
import 'nudeui/nd-rating/nd-rating.js';

// Styles
import 'todomvc-app-css/index.css';
import './app.css';

// Application modules
import './app';
import './controllers/todo-ctrl';
import './services/todo-storage';
import './directives/todo-escape';
import './directives/todo-focus';
import './directives/todo-chart';
import './directives/todo-rating';
