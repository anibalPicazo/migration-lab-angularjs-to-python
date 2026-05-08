'use strict';

describe('MockDataService', function() {
    var MockDataService, $rootScope, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_MockDataService_, _$rootScope_, _$httpBackend_) {
        MockDataService = _MockDataService_;
        $rootScope = _$rootScope_;
        $httpBackend = _$httpBackend_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should return mock search response', function(done) {
        MockDataService.getResponse('/api/cuentas/search', {}).then(function(response) {
            expect(response.success).toBe(true);
            expect(response.data.length).toBeGreaterThan(0);
            expect(response.data[0].id).toBeDefined();
            expect(response.data[0].nombre).toBeDefined();
            expect(response.data[0].estado).toBeNull();
            done();
        });

        $rootScope.$digest();
    });

    it('should return mock consultar response with states', function(done) {
        var data = {
            dni: '12345678A',
            idCuentas: ['ACC-0001-2024', 'ACC-0002-2024']
        };

        MockDataService.getResponse('/api/cuentas/consultar', data).then(function(response) {
            expect(response.success).toBe(true);
            expect(response.data.length).toBe(2);
            expect(response.data[0].id).toBe('ACC-0001-2024');
            expect(['Activa', 'Bloqueada', 'Inactiva'].indexOf(response.data[0].estado)).toBeGreaterThanOrEqual(0);
            done();
        });

        $rootScope.$digest();
    });

    it('should return error for unknown endpoint', function(done) {
        MockDataService.getResponse('/api/unknown', {}).then(function(response) {
            expect(response.success).toBe(false);
            expect(response.error).toContain('Endpoint not mocked');
            done();
        });

        $rootScope.$digest();
    });

    it('should return immediate response', function(done) {
        var resolved = false;

        MockDataService.getResponse('/api/cuentas/search', {}).then(function(response) {
            resolved = true;
        });

        expect(resolved).toBe(false);

        $rootScope.$digest();

        expect(resolved).toBe(true);
        done();
    });
});
