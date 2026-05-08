'use strict';

angular.module('appModule')
    .component('consultaEstadosCuentas', {
        template: `<div class="container">
    <div class="card">
        <div class="card-body">
            <!-- DNI Search Section: input + button on same row -->
            <div class="field">
                <label class="label">{{ 'label_dni' | translate }}</label>
                <div style="display: flex; gap: var(--space-md); align-items: center;">
                    <input 
                        class="input"
                        type="text" 
                        ng-model="$ctrl.formData.dni"
                        dni-validator
                        ng-change="$ctrl.onDniChange()"
                        placeholder="Ej. 12345678A"
                        ng-disabled="$ctrl.isLoading"
                        style="flex: 1;">
                    <span ng-if="$ctrl.dniValid" class="validation-icon validation-icon--success">✓</span>
                    <span ng-if="$ctrl.dniInvalid" class="validation-icon validation-icon--error">✗</span>
                    <button 
                        class="btn btn--primary"
                        ng-click="$ctrl.searchByDni()"
                        ng-disabled="!$ctrl.dniValid || $ctrl.isLoading">
                        <span ng-if="!$ctrl.isLoadingSearch">🔍 {{ 'btn_search' | translate }}</span>
                        <span ng-if="$ctrl.isLoadingSearch"><app-loading-spinner size="sm"></app-loading-spinner></span>
                    </button>
                </div>
                <p ng-if="!$ctrl.hasSearched" style="font-size: var(--font-size-sm); color: var(--color-gray-600); margin-top: var(--space-sm);">
                    {{ 'help_dni' | translate }}
                </p>
            </div>

            <!-- Action Buttons (always visible, disabled when no accounts) -->
            <div style="display: flex; gap: var(--space-md); margin-bottom: var(--space-lg);">
                <button 
                    class="btn btn--primary"
                    ng-click="$ctrl.consultarTodos()"
                    ng-disabled="$ctrl.cuentas.length === 0 || $ctrl.isLoading">
                    <span ng-if="!$ctrl.isLoadingConsultarTodos">{{ 'btn_consult_all' | translate }}</span>
                    <span ng-if="$ctrl.isLoadingConsultarTodos"><app-loading-spinner size="sm"></app-loading-spinner></span>
                </button>
                
                <button 
                    class="btn btn--primary"
                    ng-click="$ctrl.consultarSeleccionados()"
                    ng-disabled="!$ctrl.hasSelection || $ctrl.isLoading">
                    <span ng-if="!$ctrl.isLoadingConsultarSeleccionados">{{ 'btn_consult_selected' | translate }}</span>
                    <span ng-if="$ctrl.isLoadingConsultarSeleccionados"><app-loading-spinner size="sm"></app-loading-spinner></span>
                </button>
            </div>

            <!-- Results Table -->
            <div ng-if="$ctrl.hasSearched">
                <table ng-if="$ctrl.cuentas.length > 0">
                    <thead>
                        <tr>
                            <th style="width: 60px;">
                                <input 
                                    type="checkbox" 
                                    ng-model="$ctrl.selectAll"
                                    ng-change="$ctrl.toggleSelectAll()">
                            </th>
                            <th style="width: 60%;">{{ 'label_cuenta_id' | translate }}</th>
                            <th style="width: 40%;">{{ 'label_estado' | translate }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr ng-repeat="cuenta in $ctrl.cuentas">
                            <td>
                                <input 
                                    type="checkbox" 
                                    ng-model="cuenta.selected"
                                    ng-change="$ctrl.onSelectionChange()">
                            </td>
                            <td>{{cuenta.id}}</td>
                            <td>{{cuenta.estado || ''}}</td>
                        </tr>
                    </tbody>
                </table>

                <p ng-if="$ctrl.cuentas.length === 0" style="color: var(--color-gray-600);">
                    {{ 'no_results' | translate }}
                </p>
            </div>
        </div>

        <!-- Footer with Date (between table and bottom) -->
        <div style="padding-top: var(--space-lg); padding-bottom: var(--space-lg); border-top: 1px solid var(--color-gray-200); border-bottom: 1px solid var(--color-gray-200);">
            <div style="text-align: center; font-size: var(--font-size-sm); color: var(--color-gray-600);">
                {{ $ctrl.currentDate | date:'dd/MM/yyyy' }}
            </div>
        </div>
    </div>
</div>`,
        controller: ['CuentasService', 'ErrorService', 'i18nService', '$scope', function(CuentasService, ErrorService, i18nService, $scope) {
            var $ctrl = this;

            // State
            $ctrl.formData = {
                dni: ''
            };
            $ctrl.cuentas = [];
            $ctrl.hasSearched = false;
            $ctrl.isLoading = false;
            $ctrl.isLoadingSearch = false;
            $ctrl.isLoadingConsultarTodos = false;
            $ctrl.isLoadingConsultarSeleccionados = false;
            $ctrl.selectAll = false;
            $ctrl.dniValid = false;
            $ctrl.dniInvalid = false;
            $ctrl.hasSelection = false;
            $ctrl.currentDate = new Date();

            // Handle DNI validation visual feedback
            $ctrl.onDniChange = function() {
                var dni = $ctrl.formData.dni;
                if (!dni) {
                    $ctrl.dniValid = false;
                    $ctrl.dniInvalid = false;
                    return;
                }
                var cleaned = dni.toString().replace(/[\s-]/g, '').toUpperCase();
                var DNI_PATTERN = /^[0-9]{8}[A-Za-z]$/;
                var DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
                var structureOk = DNI_PATTERN.test(cleaned);
                var letterOk = structureOk && cleaned[8] === DNI_LETTERS[parseInt(cleaned.substring(0, 8), 10) % 23];
                $ctrl.dniValid = letterOk;
                $ctrl.dniInvalid = cleaned.length > 0 && !$ctrl.dniValid;
            };

            // Search by DNI
            $ctrl.searchByDni = function() {
                if (!$ctrl.dniValid) return;

                $ctrl.isLoadingSearch = true;
                $ctrl.isLoading = true;
                ErrorService.clearError();
                
                // Clear previous results when starting new search
                $ctrl.cuentas = [];
                $ctrl.selectAll = false;
                $ctrl.hasSearched = false;

                CuentasService.searchByDni($ctrl.formData.dni)
                    .then(function(response) {
                        $ctrl.cuentas = response.map(function(cuenta) {
                            return angular.extend({}, cuenta, { selected: false });
                        });
                        $ctrl.hasSearched = true;
                        $ctrl.selectAll = false;
                    })
                    .catch(function(error) {
                        // Handle specific error codes from external API contract
                        var errorMessage = 'Error durante la búsqueda';
                        
                        if (error.status === 400 && error.data) {
                            if (error.data.error === 'INVALID_DNI_FORMAT') {
                                errorMessage = 'El formato del DNI es inválido';
                            } else if (error.data.error === 'MISSING_DNI') {
                                errorMessage = 'El parámetro DNI es requerido';
                            }
                        } else if (error.status === 404 && error.data) {
                            if (error.data.error === 'DNI_NOT_FOUND') {
                                errorMessage = 'No se encontraron cuentas para el DNI proporcionado';
                            }
                        } else if (error.status === 0 || error.statusText === 'TIMEOUT') {
                            errorMessage = 'La solicitud tardó demasiado. Intente nuevamente';
                        }
                        
                        ErrorService.addError(errorMessage, error.status, error);
                        $ctrl.hasSearched = true;  // Show error state
                    })
                    .finally(function() {
                        $ctrl.isLoadingSearch = false;
                        $ctrl.isLoading = false;
                    });
            };

            // Toggle select all
            $ctrl.toggleSelectAll = function() {
                $ctrl.cuentas.forEach(function(cuenta) {
                    cuenta.selected = $ctrl.selectAll;
                });
                $ctrl.onSelectionChange();
            };

            // Handle selection change
            $ctrl.onSelectionChange = function() {
                var allSelected = $ctrl.cuentas.every(function(c) { return c.selected; });
                var someSelected = $ctrl.cuentas.some(function(c) { return c.selected; });
                
                $ctrl.selectAll = allSelected;
                $ctrl.hasSelection = someSelected;
            };

            // Consult all cuentas
            $ctrl.consultarTodos = function() {
                $ctrl.isLoadingConsultarTodos = true;
                $ctrl.isLoading = true;
                ErrorService.clearError();

                var caseIds = $ctrl.cuentas.map(function(c) { return c.id; });

                CuentasService.consultarEstadosCuentasBatch(caseIds)
                    .then(function(response) {
                        // Update estados in the results
                        if (response.results) {
                            response.results.forEach(function(result) {
                                var cuenta = $ctrl.cuentas.find(function(c) { return c.id === result.caseId; });
                                if (cuenta) {
                                    if (result.status === 'SUCCESS') {
                                        // Map action to estado
                                        cuenta.estado = result.action || 'UNKNOWN';
                                    } else if (result.status === 'ERROR_TIMEOUT') {
                                        cuenta.estado = 'Tiempo agotado';
                                    } else if (result.status === 'ERROR_UPSTREAM') {
                                        cuenta.estado = 'Servicio no disponible';
                                    } else if (result.status === 'ERROR_VALIDATION') {
                                        cuenta.estado = 'Error validación';
                                    } else {
                                        cuenta.estado = 'Error (' + result.status + ')';
                                    }
                                }
                            });
                        }
                    })
                    .catch(function(error) {
                        // Handle validation errors differently
                        if (error.error === 'BATCH_SIZE_EXCEEDED') {
                            ErrorService.addError('Too many accounts to consult at once. Max 10 per request.', 'VALIDATION_ERROR', error);
                        } else if (error.error === 'EMPTY_BATCH') {
                            ErrorService.addError('No accounts to consult.', 'VALIDATION_ERROR', error);
                        } else {
                            ErrorService.addError('Error consulting all accounts', error.status || 'ERROR', error);
                        }
                    })
                    .finally(function() {
                        $ctrl.isLoadingConsultarTodos = false;
                        $ctrl.isLoading = false;
                    });
            };

            // Consult selected cuentas
            $ctrl.consultarSeleccionados = function() {
                var selected = $ctrl.cuentas.filter(function(c) { return c.selected; });
                if (selected.length === 0) {
                    ErrorService.addError('No accounts selected', 'VALIDATION', {});
                    return;
                }

                $ctrl.isLoadingConsultarSeleccionados = true;
                $ctrl.isLoading = true;
                ErrorService.clearError();

                var caseIds = selected.map(function(c) { return c.id; });

                CuentasService.consultarEstadosCuentasBatch(caseIds)
                    .then(function(response) {
                        // Update only selected cuentas
                        if (response.results) {
                            response.results.forEach(function(result) {
                                var cuenta = $ctrl.cuentas.find(function(c) { return c.id === result.caseId; });
                                if (cuenta) {
                                    if (result.status === 'SUCCESS') {
                                        // Map action to estado
                                        cuenta.estado = result.action || 'UNKNOWN';
                                    } else if (result.status === 'ERROR_TIMEOUT') {
                                        cuenta.estado = 'Tiempo agotado';
                                    } else if (result.status === 'ERROR_UPSTREAM') {
                                        cuenta.estado = 'Servicio no disponible';
                                    } else if (result.status === 'ERROR_VALIDATION') {
                                        cuenta.estado = 'Error validación';
                                    } else {
                                        cuenta.estado = 'Error (' + result.status + ')';
                                    }
                                }
                            });
                        }
                    })
                    .catch(function(error) {
                        // Handle validation errors differently
                        if (error.error === 'BATCH_SIZE_EXCEEDED') {
                            ErrorService.addError('Too many accounts selected. Max 10 per request.', 'VALIDATION_ERROR', error);
                        } else if (error.error === 'EMPTY_BATCH') {
                            ErrorService.addError('No accounts to consult.', 'VALIDATION_ERROR', error);
                        } else {
                            ErrorService.addError('Error consulting selected accounts', error.status || 'ERROR', error);
                        }
                    })
                    .finally(function() {
                        $ctrl.isLoadingConsultarSeleccionados = false;
                        $ctrl.isLoading = false;
                    });
            };

            // New search - reset
            $ctrl.nuevoSearch = function() {
                $ctrl.formData.dni = '';
                $ctrl.cuentas = [];
                $ctrl.hasSearched = false;
                $ctrl.selectAll = false;
                $ctrl.dniValid = false;
                $ctrl.dniInvalid = false;
                ErrorService.clearError();
            };
        }],
        bindings: {}
    });
