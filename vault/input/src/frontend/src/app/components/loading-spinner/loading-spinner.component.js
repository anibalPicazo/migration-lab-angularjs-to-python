'use strict';

angular.module('appModule')
    .component('appLoadingSpinner', {
        template: `<div class="loading-spinner" ng-class="'spinner-size-' + $ctrl.size"></div>`,
        controller: [function() {
            var $ctrl = this;
            $ctrl.size = $ctrl.size || 'md';
        }],
        bindings: {
            size: '@?'
        }
    });
