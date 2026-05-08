'use strict';

describe('translate Filter', function() {
    var translateFilter, i18nService, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_i18nService_, $filter, _$httpBackend_) {
        i18nService = _i18nService_;
        translateFilter = $filter('translate');
        $httpBackend = _$httpBackend_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should translate key to value', function() {
        spyOn(i18nService, 'getTranslation').and.returnValue('Translated Text');

        var result = translateFilter('test_key');

        expect(result).toBe('Translated Text');
        expect(i18nService.getTranslation).toHaveBeenCalledWith('test_key');
    });

    it('should return key if translation not found', function() {
        spyOn(i18nService, 'getTranslation').and.returnValue('unknown_key');

        var result = translateFilter('unknown_key');

        expect(result).toBe('unknown_key');
    });

    it('should handle empty key', function() {
        spyOn(i18nService, 'getTranslation').and.returnValue('');

        var result = translateFilter('');

        expect(result).toBe('');
    });
});
