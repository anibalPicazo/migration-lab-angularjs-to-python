'use strict';

describe('ErrorService', function() {
    var ErrorService, $rootScope, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_ErrorService_, _$rootScope_, _$httpBackend_) {
        ErrorService = _ErrorService_;
        $rootScope = _$rootScope_;
        $httpBackend = _$httpBackend_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should add error and broadcast event', function() {
        var broadcastSpy = spyOn($rootScope, '$broadcast').and.callThrough();

        var error = ErrorService.addError('Test error', 500, { detail: 'test' });

        expect(error.message).toBe('Test error');
        expect(error.code).toBe(500);
        expect(error.details.detail).toBe('test');
        expect(error.timestamp).toBeDefined();
        expect(broadcastSpy).toHaveBeenCalledWith('error:new', error);
    });

    it('should get current error', function() {
        ErrorService.clearAll();
        var error = ErrorService.addError('Test error', 400, null);

        expect(ErrorService.getCurrentError()).toEqual(error);
    });

    it('should clear current error', function() {
        var broadcastSpy = spyOn($rootScope, '$broadcast').and.callThrough();
        ErrorService.addError('Test error', 400, null);

        ErrorService.clearError();

        expect(ErrorService.getCurrentError()).toBeNull();
        expect(broadcastSpy).toHaveBeenCalledWith('error:cleared');
    });

    it('should get all errors', function() {
        ErrorService.clearAll();
        
        ErrorService.addError('Error 1', 400, null);
        ErrorService.addError('Error 2', 500, null);

        var allErrors = ErrorService.getErrors();
        expect(allErrors.length).toBe(2);
        expect(allErrors[0].message).toBe('Error 1');
        expect(allErrors[1].message).toBe('Error 2');
    });

    it('should clear all errors', function() {
        ErrorService.addError('Error 1', 400, null);
        ErrorService.addError('Error 2', 500, null);

        ErrorService.clearAll();

        expect(ErrorService.getErrors().length).toBe(0);
        expect(ErrorService.getCurrentError()).toBeNull();
    });

    it('should check if error exists', function() {
        ErrorService.clearAll();

        expect(ErrorService.hasError()).toBe(false);

        ErrorService.addError('Test error', 400, null);
        expect(ErrorService.hasError()).toBe(true);

        ErrorService.clearError();
        expect(ErrorService.hasError()).toBe(false);
    });
});
