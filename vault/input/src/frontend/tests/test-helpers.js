'use strict';

/**
 * Test helpers and shared setup for AngularJS tests
 * 
 * The app.run() loads config.json and then i18n files, so we need to allow those requests globally.
 * Call setupGlobalMocks($httpBackend) in beforeEach and then $httpBackend.flush() to settle them.
 */

var DEFAULT_MOCK_CONFIG = {
    apiBaseUrl: 'http://localhost:3000',
    defaultLang: 'es-ES',
    supportedLangs: ['es-ES', 'en-EN'],
    requestTimeoutMs: 30000,
    useMockApi: true
};

var DEFAULT_MOCK_I18N = {
    'page_title': 'Consulta Estados Cuenta',
    'label_dni': 'DNI',
    'app_title': 'Consulta Estados Cuenta'
};

/**
 * Setup all HTTP mocks needed for app.run() initialization.
 * Call this before $httpBackend.flush() in every beforeEach that uses the full module.
 * @param {object} $httpBackend - Angular $httpBackend mock
 */
function setupGlobalMocks($httpBackend) {
    $httpBackend.whenGET('src/assets/config.json').respond(DEFAULT_MOCK_CONFIG);
    $httpBackend.whenGET(/assets\/i18n\//).respond(DEFAULT_MOCK_I18N);
}
