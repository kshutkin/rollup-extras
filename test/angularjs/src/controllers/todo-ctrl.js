/*global angular */

/**
 * The main controller for the app. The controller:
 * - retrieves and persists the model via the todoStorage service
 * - exposes the model to the template and provides event handlers
 */

// biome-ignore lint/complexity/useArrowFunction: angular requires this
angular.module('todomvc').controller('TodoCtrl', function ($scope, $routeParams, $filter, store) {
    var todos = store.todos;
    $scope.todos = todos;

    $scope.newTodo = '';
    $scope.editedTodo = null;

    $scope.$watch(
        'todos',
        () => {
            $scope.remainingCount = $filter('filter')(todos, { completed: false }).length;
            $scope.completedCount = todos.length - $scope.remainingCount;
            $scope.allChecked = !$scope.remainingCount;
        },
        true
    );

    // Monitor the current route for changes and adjust the filter accordingly.
    $scope.$on('$routeChangeSuccess', () => {
        var status = $routeParams.status || '';
        $scope.status = status;
        $scope.statusFilter = status === 'active' ? { completed: false } : status === 'completed' ? { completed: true } : {};
    });

    $scope.addTodo = () => {
        var newTodo = {
            title: $scope.newTodo.trim(),
            completed: false,
        };

        if (!newTodo.title) {
            return;
        }

        $scope.saving = true;
        store
            .insert(newTodo)
            .then(() => {
                $scope.newTodo = '';
            })
            .finally(() => {
                $scope.saving = false;
            });
    };

    $scope.editTodo = todo => {
        $scope.editedTodo = todo;
        // Clone the original todo to restore it on demand.
        $scope.originalTodo = angular.extend({}, todo);
    };

    $scope.saveEdits = (todo, event) => {
        // Blur events are automatically triggered after the form submit event.
        // This does some unfortunate logic handling to prevent saving twice.
        if (event === 'blur' && $scope.saveEvent === 'submit') {
            $scope.saveEvent = null;
            return;
        }

        $scope.saveEvent = event;

        if ($scope.reverted) {
            // Todo edits were reverted-- don't save.
            $scope.reverted = null;
            return;
        }

        todo.title = todo.title.trim();

        if (todo.title === $scope.originalTodo.title) {
            $scope.editedTodo = null;
            return;
        }

        store[todo.title ? 'put' : 'delete'](todo)
            .then(
                () => {},
                () => {
                    todo.title = $scope.originalTodo.title;
                }
            )
            .finally(() => {
                $scope.editedTodo = null;
            });
    };

    $scope.revertEdits = todo => {
        todos[todos.indexOf(todo)] = $scope.originalTodo;
        $scope.editedTodo = null;
        $scope.originalTodo = null;
        $scope.reverted = true;
    };

    $scope.removeTodo = todo => {
        store.delete(todo);
    };

    $scope.saveTodo = todo => {
        store.put(todo);
    };

    $scope.toggleCompleted = (todo, completed) => {
        if (angular.isDefined(completed)) {
            todo.completed = completed;
        }
        store.put(todo, todos.indexOf(todo)).then(
            () => {},
            () => {
                todo.completed = !todo.completed;
            }
        );
    };

    $scope.clearCompletedTodos = () => {
        store.clearCompleted();
    };

    $scope.markAll = completed => {
        todos.forEach(todo => {
            if (todo.completed !== completed) {
                $scope.toggleCompleted(todo, completed);
            }
        });
    };
});
