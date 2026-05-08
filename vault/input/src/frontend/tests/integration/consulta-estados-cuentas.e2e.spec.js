'use strict';

describe('consultaEstadosCuentas E2E Integration', function() {
    var $componentController, $httpBackend, $rootScope, $q, CuentasService, ErrorService, ApiService;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_$componentController_, _$httpBackend_, _$rootScope_, _$q_, _CuentasService_, _ErrorService_, _ApiService_) {
        $componentController = _$componentController_;
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        CuentasService = _CuentasService_;
        ErrorService = _ErrorService_;
        ApiService = _ApiService_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should complete full flow: search DNI -> select cuentas -> consult all', function(done) {
        // Mock responses
        var mockCuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro', estado: null },
            { id: 'ACC-0003-2024', nombre: 'Cuenta Inversión', estado: null }
        ];

        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                { caseId: 'ACC-0002-2024', action: 'REJECTED', datetime: '2026-04-07T14:32:16Z', status: 'SUCCESS', errorMessage: null },
                { caseId: 'ACC-0003-2024', action: 'PENDING', datetime: '2026-04-07T14:32:17Z', status: 'SUCCESS', errorMessage: null }
            ],
            summary: {
                totalRequested: 3,
                successCount: 3,
                errorCount: 0,
                processingTimeMs: 350
            }
        };

        spyOn(CuentasService, 'searchByDni').and.returnValue($q.when(mockCuentas));
        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});

        // Step 1: Search by DNI
        $ctrl.formData.dni = '12345678A';
        $ctrl.dniValid = true;
        $ctrl.searchByDni();
        $rootScope.$digest();

        expect($ctrl.cuentas.length).toBe(3);
        expect($ctrl.hasSearched).toBe(true);

        // Step 2: Select cuentas (all in this case)
        $ctrl.selectAll = true;
        $ctrl.toggleSelectAll();
        $rootScope.$digest();

        expect($ctrl.cuentas[0].selected).toBe(true);
        expect($ctrl.cuentas[1].selected).toBe(true);
        expect($ctrl.cuentas[2].selected).toBe(true);

        // Step 3: Consult all
        $ctrl.consultarTodos();
        $rootScope.$digest();

        // Verify results
        expect($ctrl.cuentas[0].estado).toBe('APPROVED');
        expect($ctrl.cuentas[1].estado).toBe('REJECTED');
        expect($ctrl.cuentas[2].estado).toBe('PENDING');
        expect(CuentasService.consultarEstadosCuentasBatch).toHaveBeenCalledWith(['ACC-0001-2024', 'ACC-0002-2024', 'ACC-0003-2024']);

        done();
    });

    it('should complete flow: search DNI -> select specific cuentas -> consult selected', function(done) {
        var mockCuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro', estado: null },
            { id: 'ACC-0003-2024', nombre: 'Cuenta Inversión', estado: null }
        ];

        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                { caseId: 'ACC-0003-2024', action: 'PENDING', datetime: '2026-04-07T14:32:17Z', status: 'SUCCESS', errorMessage: null }
            ],
            summary: {
                totalRequested: 2,
                successCount: 2,
                errorCount: 0,
                processingTimeMs: 250
            }
        };

        spyOn(CuentasService, 'searchByDni').and.returnValue($q.when(mockCuentas));
        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});

        // Step 1: Search
        $ctrl.formData.dni = '12345678A';
        $ctrl.dniValid = true;
        $ctrl.searchByDni();
        $rootScope.$digest();

        // Step 2: Select specific cuentas (first and third)
        $ctrl.cuentas[0].selected = true;
        $ctrl.cuentas[2].selected = true;
        $ctrl.onSelectionChange();
        $rootScope.$digest();

        expect($ctrl.hasSelection).toBe(true);
        expect($ctrl.cuentas[1].selected).toBe(false);

        // Step 3: Consult selected
        $ctrl.consultarSeleccionados();
        $rootScope.$digest();

        // Verify only selected cuentas are updated
        expect($ctrl.cuentas[0].estado).toBe('APPROVED');
        expect($ctrl.cuentas[1].estado).toBeNull(); // Not selected, not updated
        expect($ctrl.cuentas[2].estado).toBe('PENDING');
        expect(CuentasService.consultarEstadosCuentasBatch).toHaveBeenCalledWith(['ACC-0001-2024', 'ACC-0003-2024']);

        done();
    });

    it('should handle mixed success and error results in E2E flow', function(done) {
        var mockCuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro', estado: null }
        ];

        var mockBatchResponse = {
            results: [
                { caseId: 'ACC-0001-2024', action: 'APPROVED', datetime: '2026-04-07T14:32:15Z', status: 'SUCCESS', errorMessage: null },
                { caseId: 'ACC-0002-2024', action: null, datetime: null, status: 'ERROR_TIMEOUT', errorMessage: 'Connection timeout' }
            ],
            summary: {
                totalRequested: 2,
                successCount: 1,
                errorCount: 1,
                processingTimeMs: 5200
            }
        };

        spyOn(CuentasService, 'searchByDni').and.returnValue($q.when(mockCuentas));
        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.returnValue($q.when(mockBatchResponse));

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});

        // Flow: search, select all, consult
        $ctrl.formData.dni = '12345678A';
        $ctrl.dniValid = true;
        $ctrl.searchByDni();
        $rootScope.$digest();

        $ctrl.selectAll = true;
        $ctrl.toggleSelectAll();
        $ctrl.consultarTodos();
        $rootScope.$digest();

        // Verify partial results
        expect($ctrl.cuentas[0].estado).toBe('APPROVED');
        expect($ctrl.cuentas[1].estado).toBe('Tiempo agotado');

        done();
    });

    it('should validate table updates without reloading after consultation', function(done) {
        var mockCuentas = [
            { id: 'ACC-0001-2024', nombre: 'Cuenta Corriente', estado: null },
            { id: 'ACC-0002-2024', nombre: 'Cuenta Ahorro', estado: null }
        ];

        var mockBatchResponse1 = {
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

        var mockBatchResponse2 = {
            results: [
                { caseId: 'ACC-0001-2024', action: 'PENDING', datetime: '2026-04-07T14:35:20Z', status: 'SUCCESS', errorMessage: null },
                { caseId: 'ACC-0002-2024', action: 'APPROVED', datetime: '2026-04-07T14:35:21Z', status: 'SUCCESS', errorMessage: null }
            ],
            summary: {
                totalRequested: 2,
                successCount: 2,
                errorCount: 0,
                processingTimeMs: 260
            }
        };

        spyOn(CuentasService, 'searchByDni').and.returnValue($q.when(mockCuentas));
        var callCount = 0;
        spyOn(CuentasService, 'consultarEstadosCuentasBatch').and.callFake(function() {
            callCount++;
            return $q.when(callCount === 1 ? mockBatchResponse1 : mockBatchResponse2);
        });

        var $ctrl = $componentController('consultaEstadosCuentas', null, {});

        // Search and consult first time
        $ctrl.formData.dni = '12345678A';
        $ctrl.dniValid = true;
        $ctrl.searchByDni();
        $rootScope.$digest();

        $ctrl.selectAll = true;
        $ctrl.toggleSelectAll();
        $ctrl.consultarTodos();
        $rootScope.$digest();

        expect($ctrl.cuentas[0].estado).toBe('APPROVED');
        expect($ctrl.cuentas[1].estado).toBe('REJECTED');

        // Consult again without refreshing cuentas list
        $ctrl.consultarTodos();
        $rootScope.$digest();

        // Table should be updated with new results
        expect($ctrl.cuentas[0].estado).toBe('PENDING');
        expect($ctrl.cuentas[1].estado).toBe('APPROVED');

        done();
    });
});
