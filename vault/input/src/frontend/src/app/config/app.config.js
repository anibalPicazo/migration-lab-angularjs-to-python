'use strict';

angular.module('appModule')
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        $stateProvider
            .state('home', {
                url: '/',
                template: '<consulta-estados-cuentas></consulta-estados-cuentas>',
                controller: function() {}
            })
            .state('cuenta-status', {
                url: '/account-status',
                template: '<consulta-estados-cuentas></consulta-estados-cuentas>',
                controller: function() {}
            });

        // Default route
        $urlRouterProvider.otherwise('/');
    }]);
