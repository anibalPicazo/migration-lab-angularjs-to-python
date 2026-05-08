'use strict';

angular.module('appModule')
    .component('appHeader', {
        template: `<div class="app-header">
    <div class="app-header-title">{{ 'page_title' | translate }}</div>
    <div class="app-header-right">
        <select class="language-selector" ng-model="$ctrl.currentLang" ng-change="$ctrl.changeLanguage()">
            <option ng-repeat="lang in $ctrl.supportedLangs" value="{{lang}}">{{lang}}</option>
        </select>
    </div>
</div>`,
        controller: ['i18nService', '$rootScope', function(i18nService, $rootScope) {
            var $ctrl = this;
            $ctrl.title = 'Consulta Estados Cuenta';
            $ctrl.currentLang = i18nService.getCurrentLanguage();
            $ctrl.supportedLangs = i18nService.getSupportedLanguages();

            $ctrl.changeLanguage = function() {
                if ($ctrl.currentLang) {
                    i18nService.setLanguage($ctrl.currentLang);
                }
            };

            // Listen for language changes from other components
            $rootScope.$on('i18n:languageChanged', function(event, lang) {
                $ctrl.currentLang = lang;
            });
        }],
        bindings: {}
    });
