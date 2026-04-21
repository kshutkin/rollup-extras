/*global angular */

/**
 * Directive that provides AngularJS two-way data binding for the
 * <nd-rating> web component from nudeui.
 *
 * Usage:
 *   <nd-rating max="5" step="1" ng-model="todo.rating" on-change="saveTodo(todo)"></nd-rating>
 */
// biome-ignore lint/complexity/useArrowFunction: angular requires this
angular.module('todomvc').directive('ndRating', function ($parse) {
    return {
        restrict: 'E',
        link: (scope, element, attrs) => {
            var el = element[0];
            var ngModel = attrs.ngModel ? $parse(attrs.ngModel) : null;

            if (ngModel) {
                // Sync Angular model → web component attribute
                scope.$watch(attrs.ngModel, newVal => {
                    if (newVal != null) {
                        el.setAttribute('value', String(newVal));
                    }
                });

                // Sync web component input → Angular model
                el.addEventListener('input', () => {
                    scope.$apply(() => {
                        ngModel.assign(scope, Number(el.getAttribute('value')));
                        if (attrs.onChange) {
                            scope.$eval(attrs.onChange);
                        }
                    });
                });
            }
        },
    };
});
