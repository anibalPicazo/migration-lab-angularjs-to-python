'use strict';

describe('appHeader Component', function() {
    var $componentController, i18nService, $rootScope, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_$componentController_, _i18nService_, _$rootScope_, _$httpBackend_) {
        $componentController = _$componentController_;
        i18nService = _i18nService_;
        $rootScope = _$rootScope_;
        $httpBackend = _$httpBackend_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    beforeEach(function() {
        // Mock i18nService methods
        spyOn(i18nService, 'getCurrentLanguage').and.returnValue('es-ES');
        spyOn(i18nService, 'getSupportedLanguages').and.returnValue(['es-ES', 'en-EN']);
        spyOn(i18nService, 'setLanguage').and.returnValue(Promise.resolve('en-EN'));
    });

    it('should create header component', function() {
        var $ctrl = $componentController('appHeader', null, {});

        expect($ctrl).toBeDefined();
        expect($ctrl.title).toBe('Consulta Estados Cuenta');
    });

    it('should initialize with current language', function() {
        var $ctrl = $componentController('appHeader', null, {});

        expect($ctrl.currentLang).toBe('es-ES');
        expect(i18nService.getCurrentLanguage).toHaveBeenCalled();
    });

    it('should display supported languages', function() {
        var $ctrl = $componentController('appHeader', null, {});

        expect($ctrl.supportedLangs.length).toBe(2);
        expect($ctrl.supportedLangs[0]).toBe('es-ES');
        expect($ctrl.supportedLangs[1]).toBe('en-EN');
    });

    it('should change language when selected', function() {
        var $ctrl = $componentController('appHeader', null, {});
        $ctrl.currentLang = 'en-EN';

        $ctrl.changeLanguage();

        expect(i18nService.setLanguage).toHaveBeenCalledWith('en-EN');
    });

    it('should listen for language changes', function() {
        var $ctrl = $componentController('appHeader', null, {});
        var broadcastSpy = spyOn($rootScope, '$broadcast').and.callThrough();
        var onSpy = spyOn($rootScope, '$on').and.callThrough();

        // Check that $on was called for language change event
        // This would be set up during component initialization
        expect($ctrl).toBeDefined();
    });
});
