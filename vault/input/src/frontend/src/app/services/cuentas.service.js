'use strict';

angular.module('appModule')
    .service('CuentasService', ['$q', 'ApiService', 'ConfigService', function($q, ApiService, ConfigService) {
        var service = this;

        /**
         * Search cuentas by DNI using external API contract
         * Endpoint: GET /v2/account-closure/get-accounts?dni={dni}
         * Reference: /docs/requirements/03_act_endpoint_DNI/API_specification_DNI.md
         * 
         * This endpoint was updated from the previous internal API contract.
         * It now uses a GET method with DNI as a query parameter instead of POST
         * in the request body. The response structure contains IBAN identifiers
         * instead of internal account IDs.
         * 
         * @param {Array<string>} caseIds - Array of case IDs to check
         * @param {boolean} useV2 - Optional: override config flag (for testing)
         * @returns {Promise} Promise containing transformed batch results
         */
        service.consultarEstadosCuentas = function(caseIds, useV2) {
            var config = ConfigService.getAll() || {};
            var shouldUseV2 = (useV2 !== undefined) ? useV2 : (config.useEndpointV2 === true);

            if (shouldUseV2) {
                return service.consultarEstadosCuentasBatch(caseIds);
            } else {
                // Fall back to v1 implementation (for now, still use batch internally for consistency)
                return service.consultarEstadosCuentasBatch(caseIds);
            }
        };

        /**
         * Search cuentas by DNI using external API contract
         * Endpoint: GET /v2/account-closure/get-accounts?dni={dni}
         * Reference: /docs/requirements/03_act_endpoint_DNI/API_specification_DNI.md
         * @param {string} dni - The DNI to search (8 digits + 1 letter, e.g., 12345678A)
         * @returns {Promise} Promise containing array of cuentas with IBAN identifiers
         */
        service.searchByDni = function(dni) {
            // Validate DNI format before making request (8 digits + 1 letter)
            var dniPattern = /^[0-9]{8}[A-Za-z]$/;
            var cleanedDni = dni.toString().replace(/[\s-]/g, '').toUpperCase();
            
            if (!dniPattern.test(cleanedDni)) {
                return $q.reject({
                    status: 400,
                    data: {
                        error: 'INVALID_DNI_FORMAT',
                        message: 'DNI format is invalid'
                    }
                });
            }

            // Call external API: GET /v2/account-closure/get-accounts?dni={dni}
            return ApiService.get('/v2/account-closure/get-accounts', { dni: cleanedDni })
            .then(function(response) {
                // Extract accounts from response and transform IBAN to be displayed as ID
                // Note: ApiService.get already unwraps response.data, so response is the actual data
                var accounts = response && response.accounts ? response.accounts : [];
                return accounts.map(function(account) {
                    return {
                        id: account.iban,      // Use IBAN as ID
                        iban: account.iban,    // Preserve IBAN field
                        estado: null           // Estado is initially null, set via consultarTodos/consultarSeleccionados
                    };
                });
            })
            .catch(function(error) {
                // Handle timeout
                if (error.status === -1 || error.code === 'ECONNABORTED') {
                    return $q.reject({
                        status: 0,
                        statusText: 'TIMEOUT',
                        data: {
                            error: 'REQUEST_TIMEOUT',
                            message: 'La solicitud tardó demasiado. Intente nuevamente'
                        }
                    });
                }
                
                // Handle 400 or 404 errors from backend
                if (error.status === 400 || error.status === 404) {
                    return $q.reject(error);
                }
                
                // Re-throw other errors
                return $q.reject(error);
            });
        };

        /**
         * Consult all cuentas associated with DNI
         * @param {string} dni - The DNI
         * @param {Array} idCuentas - Array of cuenta IDs
         * @returns {Promise} Promise containing array of cuentas with updated states
         */
        service.consultarTodos = function(dni, idCuentas) {
            return ApiService.post('/api/cuentas/consultar', {
                dni: dni,
                idCuentas: idCuentas
            })
            .then(function(response) {
                return response.data || [];
            });
        };

        /**
         * Consult selected cuentas
         * @param {string} dni - The DNI
         * @param {Array} idCuentas - Array of cuenta IDs to consult
         * @returns {Promise} Promise containing array of cuentas with updated states
         */
        service.consultarSeleccionados = function(dni, idCuentas) {
            // Uses the same endpoint as consultarTodos
            return service.consultarTodos(dni, idCuentas);
        };

        /**
         * Consult cuentas estado using batch endpoint (v2)
         * @param {Array<string>} caseIds - Array of case IDs to check (will auto-split if > 10)
         * @returns {Promise} Promise containing transformed batch results
         */
        service.consultarEstadosCuentasBatch = function(caseIds) {
            if (!Array.isArray(caseIds) || caseIds.length === 0) {
                return $q.reject({
                    error: 'INVALID_CASE_IDS',
                    message: 'caseIds must be a non-empty array'
                });
            }

            // Auto-split if > 10 items
            if (caseIds.length > 10) {
                var batches = [];
                for (var i = 0; i < caseIds.length; i += 10) {
                    batches.push(caseIds.slice(i, i + 10));
                }

                // Execute all batches in parallel
                var batchPromises = batches.map(function(batch) {
                    return ApiService.checkBalanceBatch(batch);
                });

                return $q.all(batchPromises)
                    .then(function(responses) {
                        // Merge all batch responses
                        var mergedResults = [];
                        var totalSuccess = 0;
                        var totalError = 0;
                        var totalTimeMs = 0;

                        responses.forEach(function(response) {
                            if (response.results) {
                                mergedResults = mergedResults.concat(response.results);
                                totalSuccess += response.summary.successCount || 0;
                                totalError += response.summary.errorCount || 0;
                                totalTimeMs += response.summary.processingTimeMs || 0;
                            }
                        });

                        // Return in expected format
                        return {
                            results: mergedResults,
                            summary: {
                                totalRequested: caseIds.length,
                                successCount: totalSuccess,
                                errorCount: totalError,
                                processingTimeMs: totalTimeMs
                            }
                        };
                    });
            }

            // Single batch call
            return ApiService.checkBalanceBatch(caseIds)
                .then(function(response) {
                    // Transform response to expected format
                    return {
                        results: response.results.map(function(result) {
                            return {
                                caseId: result.caseId,
                                action: result.action,
                                datetime: result.datetime,
                                status: result.status,
                                errorMessage: result.errorMessage
                            };
                        }),
                        summary: response.summary
                    };
                });
        };

        return service;
    }]);
