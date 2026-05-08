'use strict';

describe('ApiService', function() {
    var ApiService, MockDataService, $rootScope, $q, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(function() {
        module(function($provide) {
            $provide.value('ConfigService', {
                load: jasmine.createSpy('load').and.callFake(function() {
                    // Return $q.when(...) but $q not available yet here, handle in inject
                    return {
                        then: function(fn) {
                            fn({
                                apiBaseUrl: 'http://localhost:3000',
                                requestTimeoutMs: 30000,
                                useMockApi: true,
                                defaultLang: 'es-ES'
                            });
                            return this;
                        },
                        catch: function() { return this; }
                    };
                }),
                getAll: jasmine.createSpy('getAll').and.returnValue({
                    apiBaseUrl: 'http://localhost:3000',
                    requestTimeoutMs: 30000,
                    useMockApi: true,
                    defaultLang: 'es-ES'
                })
            });
        });
    });

    beforeEach(inject(function(_ApiService_, _MockDataService_, _$rootScope_, _$q_, _$httpBackend_) {
        ApiService = _ApiService_;
        MockDataService = _MockDataService_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        $httpBackend = _$httpBackend_;
        // i18nService.load() is called in app.run(), allow that request
        $httpBackend.whenGET(/assets\/i18n\//).respond({});
        $httpBackend.flush();
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('should use mock API when enabled', function(done) {
        ApiService.post('/api/cuentas/search', {}).then(function(response) {
            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
            done();
        });

        $rootScope.$digest();
    });

    it('should support GET requests with mock', function(done) {
        ApiService.get('/api/cuentas/status', { id: 'ACC-0001-2024' }).then(function(response) {
            expect(response).toBeDefined();
            done();
        });

        $rootScope.$digest();
    });

    it('should handle POST with data parameter', function(done) {
        var testData = { dni: '12345678A', idCuentas: ['ACC-0001-2024'] };

        ApiService.post('/api/cuentas/consultar', testData).then(function(response) {
            expect(response.success).toBe(true);
            done();
        });

        $rootScope.$digest();
    });

    describe('Batch Endpoint (v2)', function() {
        it('should validate input - not an array', function(done) {
            ApiService.checkBalanceBatch('not-an-array').catch(function(error) {
                expect(error.error).toBe('BATCH_VALIDATION_ERROR');
                expect(error.message).toContain('array');
                done();
            });

            $rootScope.$digest();
        });

        it('should validate input - empty array', function(done) {
            ApiService.checkBalanceBatch([]).catch(function(error) {
                expect(error.error).toBe('EMPTY_BATCH');
                done();
            });

            $rootScope.$digest();
        });

        it('should validate input - exceeds max 10 items', function(done) {
            var caseIds = [];
            for (var i = 0; i < 15; i++) {
                caseIds.push('CASE-' + i);
            }

            ApiService.checkBalanceBatch(caseIds).catch(function(error) {
                expect(error.error).toBe('BATCH_SIZE_EXCEEDED');
                expect(error.details.requestedCount).toBe(15);
                expect(error.details.maxAllowed).toBe(10);
                done();
            });

            $rootScope.$digest();
        });

        it('should successfully call batch endpoint with valid input', function(done) {
            var caseIds = ['CASE001', 'CASE002', 'CASE003'];

            ApiService.checkBalanceBatch(caseIds).then(function(response) {
                expect(response.results).toBeDefined();
                expect(response.results.length).toBe(3);
                expect(response.summary).toBeDefined();
                expect(response.summary.totalRequested).toBe(3);
                expect(response.summary.successCount).toBe(3);
                done();
            });

            $rootScope.$digest();
        });

        it('should handle batch with exactly 10 items', function(done) {
            var caseIds = [];
            for (var i = 0; i < 10; i++) {
                caseIds.push('CASE-' + String(i).padStart(3, '0'));
            }

            ApiService.checkBalanceBatch(caseIds).then(function(response) {
                expect(response.results.length).toBe(10);
                expect(response.summary.totalRequested).toBe(10);
                done();
            });

            $rootScope.$digest();
        });

        it('should transform SUCCESS results correctly', function(done) {
            var caseIds = ['CASE001'];

            ApiService.checkBalanceBatch(caseIds).then(function(response) {
                var result = response.results[0];
                expect(result.caseId).toBe('CASE001');
                expect(result.status).toBe('SUCCESS');
                expect(result.action).toBeDefined();
                expect(result.datetime).toBeDefined();
                expect(result.errorMessage).toBeNull();
                done();
            });

            $rootScope.$digest();
        });
    });
});

