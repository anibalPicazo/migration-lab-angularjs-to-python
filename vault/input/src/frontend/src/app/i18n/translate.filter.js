'use strict';

angular.module('appModule')
    .filter('translate', ['i18nService', function(i18nService) {
        var filter = function(key) {
            return i18nService.getTranslation(key);
        };
        filter.$stateful = true;
        return filter;
    }])
    .directive('i18n', ['i18nService', function(i18nService) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                var updateText = function() {
                    var key = attrs.i18n;
                    var translation = i18nService.getTranslation(key);
                    element.text(translation);
                };

                updateText();

                scope.$on('i18n:languageChanged', updateText);
            }
        };
    }]);
