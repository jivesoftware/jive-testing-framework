module.exports = function(grunt) {

    var testUtils = require('../testUtils');

    grunt.registerTask('runJiveTests', function() {

        var done = this.async();
        var options = this.options({
            'reporter': 'spec',
            'rootSuiteName': 'jive',
            'testcases': process.cwd()  + '/test',
            'timeout': 5000,
            'eventHandlers': {},
            'context': {
                'testUtils' : testUtils,
                'jive' : require(process.cwd()+'/node_modules/jive-sdk') // Default to whatever jive-sdk is being used by the caller
            }
        });

        testUtils.makeRunner({
            'eventHandlers': options.eventHandlers
        }).runTests({
            'context' : options.context,
            'reporter': options.reporter,
            'rootSuiteName' : options.rootSuiteName,
            'testcases' : options.testcases,
            'timeout' : options.timeout
        }).then(function(allClear) {
            done(allClear);
        });
    });

};