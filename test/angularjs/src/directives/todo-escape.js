/*global angular */

/**
 * Directive that executes an expression when the element it is applied to gets
 * an `escape` keydown event.
 */
angular.module('todomvc').directive('todoEscape', () => {
    var ESCAPE_KEY = 27;

    return (scope, elem, attrs) => {
        elem.bind('keydown', event => {
            if (event.keyCode === ESCAPE_KEY) {
                scope.$apply(attrs.todoEscape);
            }
        });

        scope.$on('$destroy', () => {
            elem.unbind('keydown');
        });
    };
});
