'use strict';

angular.module('appModule')
    .service('ApiService', ['$http', '$q', '$timeout', 'ConfigService', 'MockDataService', 
        function($http, $q, $timeout, ConfigService, MockDataService) {
        var service = this;

        service.post = function(endpoint, data) {
            var config = ConfigService.getAll();
            
            // Check if mock API is enabled
            if (config.useMockApi) {
                return MockDataService.getResponse(endpoint, data);
            }

            // Real API call
            var url = config.apiBaseUrl + endpoint;
            var requestConfig = {
                timeout: config.requestTimeoutMs
            };

            return $http.post(url, data, requestConfig)
                .then(function(response) {
                    return response.data;
                });
        };

        service.get = function(endpoint, params) {
            var config = ConfigService.getAll();
            
            // Check if mock API is enabled
            if (config.useMockApi) {
                return MockDataService.getResponse(endpoint, params);
            }

            // Real API call
            var url = config.apiBaseUrl + endpoint;
            var requestConfig = {
                timeout: config.requestTimeoutMs,
                params: params
            };

            return $http.get(url, requestConfig)
                .then(function(response) {
                    return response.data;
                });
        };


        /**
         * Check balance batch for multiple cases
         * @param {Array<string>} caseIds - Array of case identifiers (1-10 items)
         * @returns {Promise} Promise resolving to batch response with results and summary
         */
        service.checkBalanceBatch = function(caseIds) {
            // Validate input
            if (!Array.isArray(caseIds)) {
                return $q.reject({
                    error: 'BATCH_VALIDATION_ERROR',
                    message: 'caseIds must be an array'
                });
            }

            if (caseIds.length === 0) {
                return $q.reject({
                    error: 'EMPTY_BATCH',
                    message: 'Batch must contain at least 1 caseId'
                });
            }

            if (caseIds.length > 10) {
                return $q.reject({
                    error: 'BATCH_SIZE_EXCEEDED',
                    message: 'Batch size exceeds maximum allowed of 10 caseIds',
                    details: {
                        requestedCount: caseIds.length,
                        maxAllowed: 10
                    }
                });
            }

            // Call with retry logic
            return service._checkBalanceBatchWithRetry(caseIds, 0, {});
        };

        /**
         * Internal helper for batch check with retry logic
         * @private
         * @param {Array<string>} caseIds - Case identifiers to check
         * @param {number} retryCount - Current retry count
         * @param {object} lastError - Last error encountered
         * @returns {Promise}
         */
        service._checkBalanceBatchWithRetry = function(caseIds, retryCount, lastError) {
            var config = ConfigService.getAll();
            
            // Check if mock API is enabled
            if (config.useMockApi) {
                return MockDataService.getResponse('/v2/account-closure/check-balance-batch', { caseIds: caseIds });
            }

            // Real API call to batch endpoint
            var url = config.apiBaseUrl + '/v2/account-closure/check-balance-batch';
            var requestConfig = {
                timeout: config.batchRequestTimeoutMs
            };

            return $http.post(url, { caseIds: caseIds }, requestConfig)
                .then(function(response) {
                    return response.data;
                })
                .catch(function(error) {
                    // Determine if error is retryable
                    var isTimeout = error.status === -1; // Network timeout/error
                    var isUpstreamError = error.status >= 500; // 5xx errors
                    
                    var shouldRetry = false;
                    var retryableErrorTypes = ['ERROR_TIMEOUT', 'ERROR_UPSTREAM'];
                    
                    // Check if we should retry based on error type
                    if (error.data && error.data.results) {
                        // Mixed success/error response - check individual result errors
                        var hasRetryableError = error.data.results.some(function(result) {
                            return result.status === 'ERROR_TIMEOUT' && retryCount < 2;
                        });
                        if (hasRetryableError) {
                            shouldRetry = true;
                        }
                    } else if (isTimeout && retryCount < 2) {
                        // Connection timeout - exponential backoff
                        shouldRetry = true;
                    } else if (isUpstreamError && retryCount < 1) {
                        // Upstream 5xx error - single retry
                        shouldRetry = true;
                    }

                    if (shouldRetry) {
                        var backoffMs = Math.pow(2, retryCount) * 100; // Exponential backoff: 100ms, 200ms, 400ms
                        console.log('Retry batch for caseIds: ' + caseIds.join(',') + ' after ' + backoffMs + 'ms (attempt ' + (retryCount + 1) + ')');
                        
                        return $timeout(function() {
                            return service._checkBalanceBatchWithRetry(caseIds, retryCount + 1, error);
                        }, backoffMs);
                    }

                    // Not retryable or max retries exceeded
                    console.error('Batch request failed for caseIds: ' + caseIds.join(','), error);
                    return $q.reject(error);
                });
        };


        return service;
    }]);
