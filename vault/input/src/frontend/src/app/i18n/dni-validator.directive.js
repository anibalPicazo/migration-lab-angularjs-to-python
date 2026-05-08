'use strict';

angular.module('appModule')
    .directive('dniValidator', [function() {
        // DNI letter verification: number % 23 maps to this table
        var DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
        var DNI_PATTERN = /^[0-9]{8}[A-Za-z]$/;

        function isValidDni(value) {
            var cleaned = value.toString().replace(/[\s-]/g, '').toUpperCase();
            if (!DNI_PATTERN.test(cleaned)) {
                return false;
            }
            var number = parseInt(cleaned.substring(0, 8), 10);
            var expectedLetter = DNI_LETTERS[number % 23];
            return cleaned[8] === expectedLetter;
        }

        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModelCtrl) {
                ngModelCtrl.$validators.dniFormat = function(modelValue) {
                    if (!modelValue) {
                        return true; // Allow empty
                    }
                    return isValidDni(modelValue);
                };

                // Auto-clean on input
                ngModelCtrl.$parsers.unshift(function(value) {
                    if (!value) {
                        return value;
                    }
                    var cleaned = value.toString().replace(/[\s-]/g, '').toUpperCase();
                    if (cleaned !== value) {
                        ngModelCtrl.$setViewValue(cleaned);
                        ngModelCtrl.$render();
                    }
                    return cleaned;
                });
            }
        };
    }])
    .filter('dniValidator', [function() {
        var DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
        var DNI_PATTERN = /^[0-9]{8}[A-Za-z]$/;
        return function(input) {
            if (!input) return null;
            var cleaned = input.toString().replace(/[\s-]/g, '').toUpperCase();
            if (!DNI_PATTERN.test(cleaned)) return false;
            var number = parseInt(cleaned.substring(0, 8), 10);
            return cleaned[8] === DNI_LETTERS[number % 23];
        };
    }]);
