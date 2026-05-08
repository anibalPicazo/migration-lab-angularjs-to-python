'use strict';

describe('dniValidator Directive', function() {
    var $compile, $scope, element, ctrl, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_$compile_, $rootScope, _$httpBackend_) {
        $compile = _$compile_;
        $scope = $rootScope.$new();
        $httpBackend = _$httpBackend_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();

        // Setup form
        $scope.form = {};
    }));

    function compileInput(value) {
        element = $compile(
            '<input ng-model="model" dni-validator name="dni" />'
        )($scope);
        $scope.$digest();
        ctrl = element.controller('ngModel');
        // Simulate user input to trigger $parsers
        element.val(value);
        element.triggerHandler('input');
        $scope.$digest();
        return ctrl;
    }

    it('should validate correct DNI with valid letter', function() {
        var ctrl = compileInput('12345678Z'); // 12345678 % 23 = 14 → Z

        expect(ctrl.$valid).toBe(true);
    });

    it('should reject DNI with incorrect control letter', function() {
        var ctrl = compileInput('12345678A'); // correct letter is Z, not A

        expect(ctrl.$valid).toBe(false);
    });

    it('should reject DNI without letter', function() {
        var ctrl = compileInput('12345678');

        expect(ctrl.$valid).toBe(false);
    });

    it('should reject DNI with wrong format', function() {
        var ctrl = compileInput('ABC12345');

        expect(ctrl.$valid).toBe(false);
    });

    it('should accept empty value', function() {
        var ctrl = compileInput('');

        expect(ctrl.$valid).toBe(true);
    });

    it('should accept uppercase valid DNI', function() {
        var ctrl = compileInput('00000000T'); // 0 % 23 = 0 → T

        expect(ctrl.$valid).toBe(true);
    });

    it('should convert lowercase to uppercase and validate letter', function() {
        var ctrl = compileInput('12345678z'); // lowercase z, correct letter
        
        expect(ctrl.$valid).toBe(true);
        expect(ctrl.$modelValue).toBe('12345678Z');
    });

    it('should remove spaces and hyphens before validating letter', function() {
        var ctrl = compileInput('1234-5678 Z'); // correct letter Z after cleaning
        
        expect(ctrl.$valid).toBe(true);
        expect(ctrl.$modelValue).toBe('12345678Z');
    });

    it('should validate another correct DNI', function() {
        var ctrl = compileInput('00000023T'); // 23 % 23 = 0 → T

        expect(ctrl.$valid).toBe(true);
    });

    it('should reject DNI with all zeros and wrong letter', function() {
        var ctrl = compileInput('00000000A'); // correct is T, not A

        expect(ctrl.$valid).toBe(false);
    });
});
