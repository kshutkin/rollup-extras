/*global angular */

/**
 * Services that persists and retrieves todos from localStorage or a backend API
 * if available.
 *
 * They both follow the same API, returning promises for all changes to the
 * model.
 */
angular
    .module('todomvc')
    .factory('todoStorage', ($http, $injector) => {
        // Detect if an API backend is present. If so, return the API module, else
        // hand off the localStorage adapter
        return $http.get('/api').then(
            () => {
                return $injector.get('api');
            },
            () => {
                return $injector.get('localStorage');
            }
        );
    })

    .factory('api', $resource => {
        var store = {
            todos: [],

            api: $resource('/api/todos/:id', null, {
                update: { method: 'PUT' },
            }),

            clearCompleted: () => {
                var originalTodos = store.todos.slice(0);

                var incompleteTodos = store.todos.filter(todo => !todo.completed);

                angular.copy(incompleteTodos, store.todos);

                return store.api.delete(
                    () => {},
                    function error() {
                        angular.copy(originalTodos, store.todos);
                    }
                );
            },

            delete: todo => {
                var originalTodos = store.todos.slice(0);

                store.todos.splice(store.todos.indexOf(todo), 1);
                return store.api.delete(
                    { id: todo.id },
                    () => {},
                    function error() {
                        angular.copy(originalTodos, store.todos);
                    }
                );
            },

            get: () =>
                store.api.query(resp => {
                    angular.copy(resp, store.todos);
                }),

            insert: todo => {
                var originalTodos = store.todos.slice(0);

                return store.api.save(
                    todo,
                    function success(resp) {
                        todo.id = resp.id;
                        store.todos.push(todo);
                    },
                    function error() {
                        angular.copy(originalTodos, store.todos);
                    }
                ).$promise;
            },

            put: todo => store.api.update({ id: todo.id }, todo).$promise,
        };

        return store;
    })

    .factory('localStorage', $q => {
        var STORAGE_ID = 'todos-angularjs';

        var store = {
            todos: [],

            _getFromLocalStorage: () => JSON.parse(localStorage.getItem(STORAGE_ID) || '[]'),

            _saveToLocalStorage: todos => {
                localStorage.setItem(STORAGE_ID, JSON.stringify(todos));
            },

            clearCompleted: () => {
                var deferred = $q.defer();

                var incompleteTodos = store.todos.filter(todo => !todo.completed);

                angular.copy(incompleteTodos, store.todos);

                store._saveToLocalStorage(store.todos);
                deferred.resolve(store.todos);

                return deferred.promise;
            },

            delete: todo => {
                var deferred = $q.defer();

                store.todos.splice(store.todos.indexOf(todo), 1);

                store._saveToLocalStorage(store.todos);
                deferred.resolve(store.todos);

                return deferred.promise;
            },

            get: () => {
                var deferred = $q.defer();

                angular.copy(store._getFromLocalStorage(), store.todos);
                deferred.resolve(store.todos);

                return deferred.promise;
            },

            insert: todo => {
                var deferred = $q.defer();

                store.todos.push(todo);

                store._saveToLocalStorage(store.todos);
                deferred.resolve(store.todos);

                return deferred.promise;
            },

            put: (todo, index) => {
                var deferred = $q.defer();

                store.todos[index] = todo;

                store._saveToLocalStorage(store.todos);
                deferred.resolve(store.todos);

                return deferred.promise;
            },
        };

        return store;
    });
