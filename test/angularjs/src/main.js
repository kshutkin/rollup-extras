// Legacy vendor libraries - concatenated into vendor.js asset
// Using actual library files instead of package entry points (which are CJS wrappers)
import 'script!d3/dist/d3.min.js';
import 'script!angular/angular.min.js';
import 'script!angular-resource/angular-resource.min.js';
import 'script!angular-route/angular-route.min.js';

// Styles
import 'todomvc-app-css/index.css';

// Application modules
import './app';
import './controllers/todo-ctrl';
import './services/todo-storage';
import './directives/todo-escape';
import './directives/todo-focus';
