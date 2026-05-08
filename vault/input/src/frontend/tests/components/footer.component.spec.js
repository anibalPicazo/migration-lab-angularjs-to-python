'use strict';

describe('appFooter Component', function() {
    var $componentController, $httpBackend;

    beforeEach(module('appModule'));

    beforeEach(inject(function(_$componentController_, _$httpBackend_) {
        $componentController = _$componentController_;
        $httpBackend = _$httpBackend_;
        setupGlobalMocks($httpBackend);
        $httpBackend.flush();
    }));

    it('should create footer component', function() {
        var $ctrl = $componentController('appFooter', null, {});

        expect($ctrl).toBeDefined();
    });

    it('should set current date', function() {
        var $ctrl = $componentController('appFooter', null, {});

        expect($ctrl.currentDate).toBeDefined();
        expect($ctrl.currentDate instanceof Date).toBe(true);
    });

    it('should display year in footer', function() {
        var $ctrl = $componentController('appFooter', null, {});
        var currentYear = new Date().getFullYear();

        expect($ctrl.currentDate.getFullYear()).toBe(currentYear);
    });
});
