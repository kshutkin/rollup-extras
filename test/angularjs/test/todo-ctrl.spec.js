describe('Todo Controller', () => {
    var _ctrl, scope, store;

    // Load the module containing the app, only 'ng' is loaded by default.
    beforeEach(angular.mock.module('todomvc'));

    beforeEach(inject(($controller, $rootScope, localStorage) => {
        scope = $rootScope.$new();

        store = localStorage;

        localStorage.todos = [];
        localStorage._getFromLocalStorage = () => {
            return [];
        };
        localStorage._saveToLocalStorage = todos => {
            localStorage.todos = todos;
        };

        _ctrl = $controller('TodoCtrl', {
            $scope: scope,
            store: store,
        });
    }));

    it('should not have an edited Todo on start', () => {
        expect(scope.editedTodo).toBeNull();
    });

    it('should not have any Todos on start', () => {
        expect(scope.todos.length).toBe(0);
    });

    it('should have all Todos completed', () => {
        scope.$digest();
        expect(scope.allChecked).toBeTruthy();
    });

    describe('the filter', () => {
        it('should default to ""', () => {
            scope.$emit('$routeChangeSuccess');

            expect(scope.status).toBe('');
            expect(scope.statusFilter).toEqual({});
        });

        describe('being at /active', () => {
            it('should filter non-completed', inject($controller => {
                _ctrl = $controller('TodoCtrl', {
                    $scope: scope,
                    store: store,
                    $routeParams: {
                        status: 'active',
                    },
                });

                scope.$emit('$routeChangeSuccess');
                expect(scope.statusFilter.completed).toBeFalsy();
            }));
        });

        describe('being at /completed', () => {
            it('should filter completed', inject($controller => {
                _ctrl = $controller('TodoCtrl', {
                    $scope: scope,
                    $routeParams: {
                        status: 'completed',
                    },
                    store: store,
                });

                scope.$emit('$routeChangeSuccess');
                expect(scope.statusFilter.completed).toBeTruthy();
            }));
        });
    });

    describe('having no Todos', () => {
        var _ctrl2;

        beforeEach(inject($controller => {
            _ctrl2 = $controller('TodoCtrl', {
                $scope: scope,
                store: store,
            });
            scope.$digest();
        }));

        it('should not add empty Todos', () => {
            scope.newTodo = '';
            scope.addTodo();
            scope.$digest();
            expect(scope.todos.length).toBe(0);
        });

        it('should not add items consisting only of whitespaces', () => {
            scope.newTodo = '   ';
            scope.addTodo();
            scope.$digest();
            expect(scope.todos.length).toBe(0);
        });

        it('should trim whitespace from new Todos', () => {
            scope.newTodo = '  buy some unicorns  ';
            scope.addTodo();
            scope.$digest();
            expect(scope.todos.length).toBe(1);
            expect(scope.todos[0].title).toBe('buy some unicorns');
        });
    });

    describe('having some saved Todos', () => {
        var _ctrl2;

        beforeEach(inject($controller => {
            _ctrl2 = $controller('TodoCtrl', {
                $scope: scope,
                store: store,
            });

            store.insert({ title: 'Uncompleted Item 0', completed: false });
            store.insert({ title: 'Uncompleted Item 1', completed: false });
            store.insert({ title: 'Uncompleted Item 2', completed: false });
            store.insert({ title: 'Completed Item 0', completed: true });
            store.insert({ title: 'Completed Item 1', completed: true });
            scope.$digest();
        }));

        it('should count Todos correctly', () => {
            expect(scope.todos.length).toBe(5);
            expect(scope.remainingCount).toBe(3);
            expect(scope.completedCount).toBe(2);
            expect(scope.allChecked).toBeFalsy();
        });

        it('should save Todos to local storage', () => {
            expect(scope.todos.length).toBe(5);
        });

        it('should remove Todos w/o title on saving', () => {
            var todo = store.todos[2];
            scope.editTodo(todo);
            todo.title = '';
            scope.saveEdits(todo);
            expect(scope.todos.length).toBe(4);
        });

        it('should trim Todos on saving', () => {
            var todo = store.todos[0];
            scope.editTodo(todo);
            todo.title = ' buy moar unicorns  ';
            scope.saveEdits(todo);
            expect(scope.todos[0].title).toBe('buy moar unicorns');
        });

        it('clearCompletedTodos() should clear completed Todos', () => {
            scope.clearCompletedTodos();
            expect(scope.todos.length).toBe(3);
        });

        it('markAll() should mark all Todos completed', () => {
            scope.markAll(true);
            scope.$digest();
            expect(scope.completedCount).toBe(5);
        });

        it('revertTodo() should get a Todo to its previous state', () => {
            var todo = store.todos[0];
            scope.editTodo(todo);
            todo.title = 'Unicorn sparkly skypuffles.';
            scope.revertEdits(todo);
            scope.$digest();
            expect(scope.todos[0].title).toBe('Uncompleted Item 0');
        });
    });
});
