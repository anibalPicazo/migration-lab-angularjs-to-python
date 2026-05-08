'use strict';

describe('i18nService', function() {
    var i18nService, $httpBackend, $rootScope;

    beforeEach(module('appModule'));

    // After module loads, app.run() will call ConfigService.load() then i18nService.load('es-ES')
    // We need to provide both HTTP responses before flushing
    beforeEach(inject(function(_i18nService_, _$httpBackend_, _$rootScope_) {
        i18nService = _i18nService_;
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should have loaded Spanish language after app.run()', function() {
        expect(i18nService.getCurrentLanguage()).toBe('es-ES');
    });

    it('should set a different language and broadcast event', function(done) {
        var broadcastSpy = spyOn($rootScope, '$broadcast').and.callThrough();

        $httpBackend.expectGET('src/assets/i18n/en-EN.json')
            .respond({ 'page_title': 'Account Status Query' });

        i18nService.setLanguage('en-EN').then(function(lang) {
            expect(lang).toBe('en-EN');
            expect(broadcastSpy).toHaveBeenCalledWith('i18n:languageChanged', 'en-EN');
            done();
        });

        $httpBackend.flush();
    });

    it('should get translation for key after load', function() {
        // es-ES was loaded in beforeEach with DEFAULT_MOCK_I18N translations
        expect(i18nService.getTranslation('page_title')).toBe('Consulta Estados Cuenta');
        expect(i18nService.getTranslation('label_dni')).toBe('DNI');
    });

    it('should return key if translation not found', function() {
        expect(i18nService.getTranslation('non_existent_key')).toBe('non_existent_key');
    });

    it('should cache translations on second setLanguage call', function() {
        // es-ES is already loaded, setLanguage should not make new HTTP request
        i18nService.setLanguage('es-ES');
        // No $httpBackend.flush() needed - no HTTP request was made
        expect(i18nService.getCurrentLanguage()).toBe('es-ES');
    });

    it('should return supported languages', function() {
        var langs = i18nService.getSupportedLanguages();
        expect(langs.indexOf('es-ES')).toBeGreaterThanOrEqual(0);
        expect(langs.indexOf('en-EN')).toBeGreaterThanOrEqual(0);
    });

    it('should reject unsupported language', function(done) {
        i18nService.setLanguage('fr-FR').catch(function(error) {
            expect(error.message).toContain('Unsupported language');
            done();
        });

        $rootScope.$digest();
    });
});

