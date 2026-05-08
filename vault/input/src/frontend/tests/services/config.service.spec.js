'use strict';

describe('ConfigService', function() {
    var ConfigService, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_ConfigService_, _$httpBackend_) {
        ConfigService = _ConfigService_;
        $httpBackend = _$httpBackend_;
        // Allow the app.run() initial config + i18n requests and flush them
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('should have loaded config after app.run()', function() {
        var config = ConfigService.getAll();
        expect(config).toBeDefined();
        expect(config.apiBaseUrl).toBe('http://localhost:3000');
    });

    it('should return config value by key', function() {
        expect(ConfigService.get('apiBaseUrl')).toBe('http://localhost:3000');
        expect(ConfigService.get('defaultLang')).toBe('es-ES');
        expect(ConfigService.get('useMockApi')).toBe(true);
    });

    it('should return all config properties', function() {
        var allConfig = ConfigService.getAll();
        expect(allConfig.apiBaseUrl).toBe('http://localhost:3000');
        expect(allConfig.defaultLang).toBe('es-ES');
        expect(allConfig.supportedLangs).toEqual(['es-ES', 'en-EN']);
        expect(allConfig.requestTimeoutMs).toBe(30000);
        expect(allConfig.useMockApi).toBe(true);
    });

    it('should return cached config on second load call', function(done) {
        inject(function($rootScope) {
            ConfigService.load().then(function(config) {
                expect(config.apiBaseUrl).toBe('http://localhost:3000');
                done();
            });
            $rootScope.$digest();
        });
    });
});

