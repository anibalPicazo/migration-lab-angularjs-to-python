'use strict';

angular.module('appModule')
    .component('appErrorBanner', {
        template: `<div ng-if="$ctrl.error" class="error-banner">
    <div class="error-message">{{$ctrl.error.message}}</div>
    <button class="error-close" ng-click="$ctrl.closeError()">✕</button>
</div>`,
        controller: ['ErrorService', '$scope', function(ErrorService, $scope) {
            var $ctrl = this;
            
            $ctrl.error = null;

            var updateError = function() {
                $ctrl.error = ErrorService.getCurrentError();
            };

            $ctrl.closeError = function() {
                ErrorService.clearError();
                updateError();
            };

            // Listen to error events
            $scope.$on('error:new', updateError);
            $scope.$on('error:cleared', updateError);

            // Initial state
            updateError();
        }],
        bindings: {}
    });
