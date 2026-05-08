'use strict';

angular.module('appModule')
    .factory('HttpErrorInterceptor', ['$q', 'ErrorService', function($q, ErrorService) {
        return {
            response: function(response) {
                return response;
            },
            responseError: function(response) {
                var status = response.status;
                var statusText = response.statusText;
                var message = 'Error: ' + status + ' ' + statusText;

                if (response.data && response.data.message) {
                    message = response.data.message;
                }

                ErrorService.addError(message, status, response.data);
                return $q.reject(response);
            }
        };
    }])
    .config(['$httpProvider', function($httpProvider) {
        $httpProvider.interceptors.push('HttpErrorInterceptor');
    }]);
