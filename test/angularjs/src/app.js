import angular from "angular";
import templates from 'templates';
import templateUrl from './views/todomvc-index.html';

/**
 * The main TodoMVC app module
 *
 * @type {angular.Module}
 */
export default angular.module('todomvc', ['ngRoute', 'ngResource', templates])
	.config(function ($routeProvider) {
		'use strict';

		var routeConfig = {
			controller: 'TodoCtrl',
			templateUrl,
			resolve: {
				store: function (todoStorage) {
					// Get the correct module (API or localStorage).
					return todoStorage.then(function (module) {
						module.get(); // Fetch the todo records in the background.
						return module;
					});
				}
			}
		};

		$routeProvider
			.when('/', routeConfig)
			.when('/:status', routeConfig)
			.otherwise({
				redirectTo: '/'
			});
	});
