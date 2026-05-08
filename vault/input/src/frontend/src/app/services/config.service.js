'use strict';

angular.module('appModule')
    .service('ConfigService', ['$http', '$q', function($http, $q) {
        var service = this;
        var config = null;

        service.load = function() {
            if (config) {
                return $q.when(config);
            }

            return $http.get('src/assets/config.json')
                .then(function(response) {
                    config = response.data;
                    // Apply override from URL parameters if any
                    if (window.location.search) {
                        var params = new URLSearchParams(window.location.search);
                        
                        // Allow feature flag override via URL
                        if (params.has('useEndpointV2')) {
                            config.useEndpointV2 = params.get('useEndpointV2').toLowerCase() === 'true';
                        }
                    }
                    return config;
                })
                .catch(function(error) {
                    console.error('Error loading config.json:', error);
                    // Provide default config if loading fails
                    config = {
                        apiBaseUrl: 'http://localhost:3000',
                        defaultLang: 'es-ES',
                        supportedLangs: ['es-ES', 'en-EN'],
                        requestTimeoutMs: 30000,
                        batchRequestTimeoutMs: 5000,
                        useMockApi: true,
                        useEndpointV2: false
                    };
                    return config;
                });
        };

        service.get = function(key) {
            if (!config) {
                throw new Error('Config not loaded. Use ConfigService.load() first.');
            }
            return config[key];
        };

        service.getAll = function() {
            return config;
        };

        return service;
    }]);
