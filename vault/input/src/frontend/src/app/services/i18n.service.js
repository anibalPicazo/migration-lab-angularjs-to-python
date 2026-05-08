'use strict';

angular.module('appModule')
    .service('i18nService', ['$http', '$q', '$rootScope', function($http, $q, $rootScope) {
        var service = this;
        var currentLang = null;
        var translations = {};
        var supportedLangs = ['es-ES', 'en-EN'];

        service.load = function(initialLang) {
            // Get initial language from query param, param, or default
            var urlParams = new URLSearchParams(window.location.search);
            var langParam = urlParams.get('lang');
            var lang = langParam || initialLang || 'es-ES';

            if (supportedLangs.indexOf(lang) === -1) {
                lang = 'es-ES';
            }

            return service.setLanguage(lang);
        };

        service.setLanguage = function(lang) {
            if (supportedLangs.indexOf(lang) === -1) {
                return $q.reject(new Error('Unsupported language: ' + lang));
            }

            if (translations[lang]) {
                currentLang = lang;
                $rootScope.$broadcast('i18n:languageChanged', lang);
                return $q.when(lang);
            }

            return $http.get('src/assets/i18n/' + lang + '.json')
                .then(function(response) {
                    translations[lang] = response.data;
                    currentLang = lang;
                    $rootScope.$broadcast('i18n:languageChanged', lang);
                    return lang;
                })
                .catch(function(error) {
                    console.error('Error loading language file for ' + lang + ':', error);
                    return $q.reject(error);
                });
        };

        service.getCurrentLanguage = function() {
            return currentLang;
        };

        service.getTranslation = function(key) {
            if (!currentLang || !translations[currentLang]) {
                return key;
            }
            return translations[currentLang][key] || key;
        };

        service.getSupportedLanguages = function() {
            return supportedLangs;
        };

        return service;
    }]);
