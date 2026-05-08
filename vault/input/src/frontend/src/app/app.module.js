'use strict';

angular.module('appModule', ['ui.router'])
    .run(['$q', 'ConfigService', 'i18nService', function($q, ConfigService, i18nService) {
        // Load config first
        ConfigService.load().then(function(config) {
            // Then load i18n with default language
            return i18nService.load(config.defaultLang);
        });
    }]);
