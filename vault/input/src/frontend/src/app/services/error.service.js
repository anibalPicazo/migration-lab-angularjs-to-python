'use strict';

angular.module('appModule')
    .service('ErrorService', ['$rootScope', function($rootScope) {
        var service = this;
        var errors = [];
        var currentError = null;

        service.addError = function(message, code, details) {
            var error = {
                message: message,
                code: code,
                details: details,
                timestamp: new Date()
            };
            errors.push(error);
            currentError = error;
            $rootScope.$broadcast('error:new', error);
            return error;
        };

        service.clearError = function() {
            currentError = null;
            $rootScope.$broadcast('error:cleared');
        };

        service.getCurrentError = function() {
            return currentError;
        };

        service.getErrors = function() {
            return errors;
        };

        service.clearAll = function() {
            errors = [];
            currentError = null;
            $rootScope.$broadcast('error:cleared');
        };

        service.hasError = function() {
            return currentError !== null;
        };

        return service;
    }]);
