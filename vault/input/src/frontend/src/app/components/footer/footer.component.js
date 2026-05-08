'use strict';

angular.module('appModule')
    .component('appFooter', {
        template: `<div class="app-footer">
    <p>© {{ $ctrl.currentDate | date:'yyyy' }} - Todos los derechos reservados</p>
</div>`,
        controller: [function() {
            var $ctrl = this;
            $ctrl.currentDate = new Date();
        }],
        bindings: {}
    });
