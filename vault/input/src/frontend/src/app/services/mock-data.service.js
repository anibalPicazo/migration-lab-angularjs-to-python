'use strict';

angular.module('appModule')
    .service('MockDataService', ['$q', function($q) {
        var service = this;

        // Mock data for cuentas
        var mockCuentas = [
            {
                id: 'ACC-0001-2024',
                nombre: 'Cuenta Corriente',
                estado: null
            },
            {
                id: 'ACC-0002-2024',
                nombre: 'Cuenta de Ahorro',
                estado: null
            },
            {
                id: 'ACC-0003-2024',
                nombre: 'Cuenta Inversión',
                estado: null
            }
        ];

        // Mock IBAN mapping for DNI searches
        // Reference: /docs/requirements/03_act_endpoint_DNI/API_specification_DNI.md
        var mockDniToAccounts = {
            '12345678A': ['ES9121000418450200051333', 'ES6621000418401234567891'],
            '12345678Z': ['ES9121000418450200051332', 'ES6621000418401234567891', 'ES9121000418450200051333'],
            '05309480E': ['ES1234567890123456789012'],
            '44490085N': ['ES9999999999999999999999']
        };

        service.getResponse = function(endpoint, data) {
            // Simulate immediate response using $q.when()
            
            // Handle new external API endpoint: GET /v2/account-closure/get-accounts?dni={dni}
            // Reference: /docs/requirements/03_act_endpoint_DNI/API_specification_DNI.md
            if (endpoint === '/v2/account-closure/get-accounts') {
                var dni = data && data.params ? data.params.dni : (data && data.dni ? data.dni : null);
                
                if (!dni) {
                    return $q.reject({
                        status: 400,
                        data: {
                            error: 'MISSING_DNI',
                            message: 'DNI query parameter is not present'
                        }
                    });
                }
                
                // Validate DNI format
                var dniPattern = /^[0-9]{8}[A-Za-z]$/;
                if (!dniPattern.test(dni)) {
                    return $q.reject({
                        status: 400,
                        data: {
                            error: 'INVALID_DNI_FORMAT',
                            message: 'DNI format is invalid'
                        }
                    });
                }
                
                // Check if DNI exists in mock mapping
                if (!mockDniToAccounts[dni]) {
                    return $q.reject({
                        status: 404,
                        data: {
                            error: 'DNI_NOT_FOUND',
                            message: 'No accounts found for provided DNI'
                        }
                    });
                }
                
                // Return accounts with IBAN structure
                var ibans = mockDniToAccounts[dni];
                return $q.when({
                    dni: dni,
                    accounts: ibans.map(function(iban) {
                        return { iban: iban };
                    })
                });
            }
            else if (endpoint === '/api/cuentas/search') {
                // Legacy endpoint - kept for backward compatibility
                // Mock search response - returns cuentas with null estado
                return $q.when({
                    success: true,
                    data: mockCuentas.map(function(cuenta) {
                        return {
                            id: cuenta.id,
                            nombre: cuenta.nombre,
                            estado: null // Explicitly set to null
                        };
                    })
                });
            }
            else if (endpoint === '/api/cuentas/consultar') {
                // Mock consultar response - returns cuentas with assigned states
                var estados = ['Activa', 'Bloqueada', 'Inactiva'];
                var resultado = data && data.idCuentas ? 
                    data.idCuentas.map(function(id, index) {
                        return {
                            id: id,
                            estado: estados[index % 3]
                        };
                    }) : [];
                
                return $q.when({
                    success: true,
                    data: resultado
                });
            }
            else if (endpoint === '/v2/account-closure/check-balance-batch') {
                // Mock batch response - returns results and summary
                var caseIds = data && data.caseIds ? data.caseIds : [];
                var actions = ['APPROVED', 'REJECTED', 'PENDING'];
                
                // Deterministic mock: by default all succeed unless caseId indicates otherwise
                var results = caseIds.map(function(caseId, index) {
                    // Allow tests to force specific error scenarios by caseId format
                    // If caseId contains 'TIMEOUT', return timeout error
                    if (caseId.indexOf('TIMEOUT') !== -1) {
                        return {
                            caseId: caseId,
                            action: null,
                            datetime: null,
                            status: 'ERROR_TIMEOUT',
                            errorMessage: 'Upstream call exceeded timeout of 5000ms'
                        };
                    }
                    
                    // If caseId contains 'UPSTREAM', return upstream error
                    if (caseId.indexOf('UPSTREAM') !== -1) {
                        return {
                            caseId: caseId,
                            action: null,
                            datetime: null,
                            status: 'ERROR_UPSTREAM',
                            errorMessage: 'Upstream service returned HTTP 500: Internal Server Error'
                        };
                    }
                    
                    // If caseId contains 'VALIDATION', return validation error
                    if (caseId.indexOf('VALIDATION') !== -1) {
                        return {
                            caseId: caseId,
                            action: null,
                            datetime: null,
                            status: 'ERROR_VALIDATION',
                            errorMessage: 'Invalid case ID format'
                        };
                    }
                    
                    // Default: SUCCESS
                    return {
                        caseId: caseId,
                        action: actions[index % 3],
                        datetime: new Date().toISOString(),
                        status: 'SUCCESS',
                        errorMessage: null
                    };
                });

                // Calculate summary
                var successCount = results.filter(function(r) { return r.status === 'SUCCESS'; }).length;
                var errorCount = caseIds.length - successCount;

                return $q.when({
                    results: results,
                    summary: {
                        totalRequested: caseIds.length,
                        successCount: successCount,
                        errorCount: errorCount,
                        processingTimeMs: 150 + Math.random() * 200
                    }
                });
            }
            
            // Default response for unknown endpoints
            return $q.when({
                success: false,
                error: 'Endpoint not mocked: ' + endpoint
            });
        };

        return service;
    }]);
