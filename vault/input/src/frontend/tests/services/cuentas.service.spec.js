'use strict';

describe('CuentasService', function() {
    var CuentasService, ApiService, $rootScope, $q;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_CuentasService_, _ApiService_, _$rootScope_, _$q_, _$httpBackend_) {
        CuentasService = _CuentasService_;
        ApiService = _ApiService_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        setupGlobalMocks(_$httpBackend_);
        _$httpBackend_.flush();
    }));

    it('should search cuentas by DNI', function(done) {
        spyOn(ApiService, 'get').and.returnValue($q.when({
            dni: '12345678A',
            accounts: [
                { iban: 'ES9121000418450200051332' },
                { iban: 'ES6621000418401234567891' }
            ]
        }));

        CuentasService.searchByDni('12345678A').then(function(cuentas) {
            expect(cuentas.length).toBe(2);
            expect(cuentas[0].id).toBe('ES9121000418450200051332');
            expect(cuentas[0].iban).toBe('ES9121000418450200051332');
            done();
        });

        $rootScope.$digest();
    });

    it('should return empty array when search returns undefined data', function(done) {
        spyOn(ApiService, 'get').and.returnValue($q.when({
            dni: '12345678A',
            accounts: undefined
        }));

        CuentasService.searchByDni('12345678A').then(function(cuentas) {
            expect(cuentas).toEqual([]);
            done();
        });

        $rootScope.$digest();
    });

    it('should handle 400 error for INVALID_DNI_FORMAT from server', function(done) {
        spyOn(ApiService, 'get').and.returnValue($q.reject({
            status: 400,
            data: {
                error: 'INVALID_DNI_FORMAT',
                message: 'DNI format is invalid'
            }
        }));

        // Use a valid format DNI to bypass client-side validation
        CuentasService.searchByDni('12345678X').catch(function(error) {
            expect(error.status).toBe(400);
            expect(error.data.error).toBe('INVALID_DNI_FORMAT');
            done();
        });

        $rootScope.$digest();
    });

    it('should handle 404 error for DNI_NOT_FOUND', function(done) {
        spyOn(ApiService, 'get').and.returnValue($q.reject({
            status: 404,
            data: {
                error: 'DNI_NOT_FOUND',
                message: 'No accounts found for provided DNI'
            }
        }));

        CuentasService.searchByDni('99999999Z').catch(function(error) {
            expect(error.status).toBe(404);
            expect(error.data.error).toBe('DNI_NOT_FOUND');
            done();
        });

        $rootScope.$digest();
    });

    it('should handle timeout errors', function(done) {
        spyOn(ApiService, 'get').and.returnValue($q.reject({
            status: -1,
            statusText: 'timeout',
            code: 'ECONNABORTED'
        }));

        CuentasService.searchByDni('12345678A').catch(function(error) {
            expect(error.status).toBe(0);
            expect(error.statusText).toBe('TIMEOUT');
            done();
        });

        $rootScope.$digest();
    });

    it('should consult all cuentas', function(done) {
        var mockResponse = {
            data: [
                { id: 'ACC-0001-2024', estado: 'Activa' },
                { id: 'ACC-0002-2024', estado: 'Bloqueada' }
            ]
        };

        spyOn(ApiService, 'post').and.returnValue($q.when(mockResponse));

        CuentasService.consultarTodos('12345678A', ['ACC-0001-2024', 'ACC-0002-2024'])
            .then(function(cuentas) {
                expect(cuentas.length).toBe(2);
                expect(cuentas[0].estado).toBe('Activa');
                done();
            });

        $rootScope.$digest();
    });

    it('should consult selected cuentas', function(done) {
        var mockResponse = {
            data: [
                { id: 'ACC-0001-2024', estado: 'Activa' }
            ]
        };

        spyOn(ApiService, 'post').and.returnValue($q.when(mockResponse));

        CuentasService.consultarSeleccionados('12345678A', ['ACC-0001-2024'])
            .then(function(cuentas) {
                expect(cuentas.length).toBe(1);
                expect(cuentas[0].id).toBe('ACC-0001-2024');
                done();
            });

        $rootScope.$digest();
    });

    describe('Batch Consultation', function() {
        it('should reject if caseIds is not an array', function(done) {
            CuentasService.consultarEstadosCuentasBatch('not-array')
                .catch(function(error) {
                    expect(error.error).toBe('INVALID_CASE_IDS');
                    done();
                });

            $rootScope.$digest();
        });

        it('should reject if caseIds is empty', function(done) {
            CuentasService.consultarEstadosCuentasBatch([])
                .catch(function(error) {
                    expect(error.error).toBe('INVALID_CASE_IDS');
                    done();
                });

            $rootScope.$digest();
        });

        it('should handle single batch with <= 10 items', function(done) {
            var mockBatchResponse = {
                results: [
                    { caseId: 'CASE001', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                    { caseId: 'CASE002', action: 'REJECTED', datetime: '2026-04-07T14:32:16Z', status: 'SUCCESS', errorMessage: null }
                ],
                summary: {
                    totalRequested: 2,
                    successCount: 2,
                    errorCount: 0,
                    processingTimeMs: 250
                }
            };

            spyOn(ApiService, 'checkBalanceBatch').and.returnValue($q.when(mockBatchResponse));

            CuentasService.consultarEstadosCuentasBatch(['CASE001', 'CASE002'])
                .then(function(response) {
                    expect(response.results.length).toBe(2);
                    expect(response.summary.totalRequested).toBe(2);
                    expect(response.summary.successCount).toBe(2);
                    done();
                });

            $rootScope.$digest();
        });

        it('should auto-split batches > 10 items', function(done) {
            var mockBatchResponse = {
                results: [
                    { caseId: 'CASE001', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null }
                ],
                summary: {
                    totalRequested: 1,
                    successCount: 1,
                    errorCount: 0,
                    processingTimeMs: 150
                }
            };

            spyOn(ApiService, 'checkBalanceBatch').and.returnValue($q.when(mockBatchResponse));

            var caseIds = [];
            for (var i = 0; i < 15; i++) {
                caseIds.push('CASE' + String(i).padStart(3, '0'));
            }

            CuentasService.consultarEstadosCuentasBatch(caseIds)
                .then(function(response) {
                    // Should have called checkBalanceBatch twice (first 10, then 5)
                    expect(ApiService.checkBalanceBatch).toHaveBeenCalledTimes(2);
                    expect(response.summary.totalRequested).toBe(15);
                    done();
                });

            $rootScope.$digest();
        });

        it('should transform batch response correctly', function(done) {
            var mockBatchResponse = {
                results: [
                    { caseId: 'CASE001', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                    { caseId: 'CASE002', action: null, datetime: null, status: 'ERROR_TIMEOUT', errorMessage: 'Timeout' }
                ],
                summary: {
                    totalRequested: 2,
                    successCount: 1,
                    errorCount: 1,
                    processingTimeMs: 5100
                }
            };

            spyOn(ApiService, 'checkBalanceBatch').and.returnValue($q.when(mockBatchResponse));

            CuentasService.consultarEstadosCuentasBatch(['CASE001', 'CASE002'])
                .then(function(response) {
                    expect(response.results[0].caseId).toBe('CASE001');
                    expect(response.results[0].status).toBe('SUCCESS');
                    expect(response.results[1].status).toBe('ERROR_TIMEOUT');
                    done();
                });

            $rootScope.$digest();
        });

        it('should handle mixed success and error results', function(done) {
            var mockBatchResponse = {
                results: [
                    { caseId: 'CASE001', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                    { caseId: 'CASE002', action: null, datetime: null, status: 'ERROR_UPSTREAM', errorMessage: 'Service error' }
                ],
                summary: {
                    totalRequested: 2,
                    successCount: 1,
                    errorCount: 1,
                    processingTimeMs: 300
                }
            };

            spyOn(ApiService, 'checkBalanceBatch').and.returnValue($q.when(mockBatchResponse));

            CuentasService.consultarEstadosCuentasBatch(['CASE001', 'CASE002'])
                .then(function(response) {
                    expect(response.results.length).toBe(2);
                    expect(response.summary.errorCount).toBe(1);
                    done();
                });

            $rootScope.$digest();
        });
    });
});


