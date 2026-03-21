import angular from 'angular';
import templates from 'templates';

import templateUrl from './views/todomvc-index.html';

/**
 * The main TodoMVC app module
 *
 * @type {angular.Module}
 */
export default angular.module('todomvc', ['ngRoute', 'ngResource', templates]).config($routeProvider => {
    var routeConfig = {
        controller: 'TodoCtrl',
        templateUrl,
        resolve: {
            store: todoStorage => {
                // Get the correct module (API or localStorage).
                return todoStorage.then(module => {
                    module.get(); // Fetch the todo records in the background.
                    return module;
                });
            },
        },
    };

    $routeProvider.when('/', routeConfig).when('/:status', routeConfig).otherwise({
        redirectTo: '/',
    });
});
