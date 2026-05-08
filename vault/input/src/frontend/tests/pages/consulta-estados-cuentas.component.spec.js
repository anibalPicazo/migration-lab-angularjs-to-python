'use strict';

describe('consultaEstadosCuentas Component', function() {
    var $componentController, $httpBackend, $rootScope, $q, CuentasService, ErrorService;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_$componentController_, _$httpBackend_, _$rootScope_, _$q_, _CuentasService_, _ErrorService_) {
        $componentController = _$componentController_;
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        CuentasService = _CuentasService_;
        ErrorService = _ErrorService_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should create component', function() {
        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        expect($ctrl).toBeDefined();
    });

    it('should initialize with empty state', function() {
        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        expect($ctrl.cuentas).toEqual([]);
        expect($ctrl.hasSearched).toBe(false);
        expect($ctrl.isLoading).toBe(false);
    });

    it('should validate DNI format', function() {
        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.formData.dni = '12345678Z'; // 12345678 % 23 = 14 → Z (correct letter)
        $ctrl.onDniChange();

        expect($ctrl.dniValid).toBe(true);
        expect($ctrl.dniInvalid).toBe(false);
    });

    it('should mark invalid DNI format', function() {
        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.formData.dni = '123';
        $ctrl.onDniChange();

        expect($ctrl.dniValid).toBe(false);
        expect($ctrl.dniInvalid).toBe(true);
    });

    it('should search cuentas by DNI', function(done) {
        var mockCuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente' },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro' }
        ];

        spyOn(CuentasService, 'searchByDni').and.returnValue($q.when(mockCuentas));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.formData.dni = '12345678A';
        $ctrl.dniValid = true;
        $ctrl.searchByDni();

        $rootScope.$digest();

        expect($ctrl.cuentas.length).toBe(2);
        expect($ctrl.hasSearched).toBe(true);
        done();
    });

    it('should handle consultarTodos with batch endpoint', function(done) {
        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                { caseId: 'ACC-0002-2024', action: 'REJECTED', datetime: '2026-04-07T14:32:16Z', status: 'SUCCESS', errorMessage: null }
            ],
            summary: {
                totalRequested: 2,
                successCount: 2,
                errorCount: 0,
                processingTimeMs: 250
            }
        };

        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro', estado: null }
        ];

        $ctrl.consultarTodos();
        $rootScope.$digest();

        expect($ctrl.cuentas[0].estado).toBe('APPROVED');
        expect($ctrl.cuentas[1].estado).toBe('REJECTED');
        done();
    });

    it('should handle consultarSeleccionados with batch endpoint', function(done) {
        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null }
            ],
            summary: {
                totalRequested: 1,
                successCount: 1,
                errorCount: 0,
                processingTimeMs: 150
            }
        };

        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null, selected: true },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro', estado: null, selected: false }
        ];

        $ctrl.consultarSeleccionados();
        $rootScope.$digest();

        expect($ctrl.cuentas[0].estado).toBe('APPROVED');
        expect(CuentasService.consultarEstadosCuentasBatch).toHaveBeenCalledWith(['ACC-0001-2024']);
        done();
    });

    it('should handle ERROR_TIMEOUT status', function(done) {
        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: null, datetime: null, status: 'ERROR_TIMEOUT', errorMessage: 'Timeout' }
            ],
            summary: {
                totalRequested: 1,
                successCount: 0,
                errorCount: 1,
                processingTimeMs: 5100
            }
        };

        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null }
        ];

        $ctrl.consultarTodos();
        $rootScope.$digest();

        expect($ctrl.cuentas[0].estado).toBe('Tiempo agotado');
        done();
    });

    it('should handle ERROR_UPSTREAM status', function(done) {
        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: null, datetime: null, status: 'ERROR_UPSTREAM', errorMessage: 'Service error' }
            ],
            summary: {
                totalRequested: 1,
                successCount: 0,
                errorCount: 1,
                processingTimeMs: 300
            }
        };

        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null }
        ];

        $ctrl.consultarTodos();
        $rootScope.$digest();

        expect($ctrl.cuentas[0].estado).toBe('Servicio no disponible');
        done();
    });

    it('should toggle select all', function() {
        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', selected: false },
            { id: 'ACC-0002-2024', selected: false }
        ];

        $ctrl.selectAll = true;
        $ctrl.toggleSelectAll();

        expect($ctrl.cuentas[0].selected).toBe(true);
        expect($ctrl.cuentas[1].selected).toBe(true);
    });

    it('should handle selection change', function() {
        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', selected: true },
            { id: 'ACC-0002-2024', selected: false }
        ];

        $ctrl.onSelectionChange();

        expect($ctrl.hasSelection).toBe(true);
        expect($ctrl.selectAll).toBe(false);
    });

    it('should not allow consultarSeleccionados with no selection', function(done) {
        spyOn(ErrorService, 'addError');

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});
        $ctrl.cuentas = [
            { id: 'ACC-0001-2024', selected: false },
            { id: 'ACC-0002-2024', selected: false }
        ];

        $ctrl.consultarSeleccionados();

        expect(ErrorService.addError).toHaveBeenCalled();
        done();
    });
});
