/*global describe, it, beforeEach, inject, expect, angular*/

beforeEach(angular.mock.module('todomvc'));

describe('todoFocus directive', () => {
    var scope, compile, browser;

    beforeEach(inject(($rootScope, $compile, $browser) => {
        scope = $rootScope.$new();
        compile = $compile;
        browser = $browser;
    }));

    it('should focus on truthy expression', () => {
        var el = angular.element('<input todo-focus="focus">');
        scope.focus = false;

        compile(el)(scope);
        expect(browser.deferredFns.length).toBe(0);

        scope.$apply(() => {
            scope.focus = true;
        });

        expect(browser.deferredFns.length).toBe(1);
    });
});
