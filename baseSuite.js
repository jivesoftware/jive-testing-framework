/*
 * Copyright 2013 Jive Software
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

var Mocha = require('mocha');
var fs = require('fs');
var q = require('q');
var path = require('path');
var testUtils = require('./testUtils');

exports.getTestDir = function() {
    // overridden
};

exports.beforeTest = function() {
    // overridden
};

exports.onTestPass = function(test) {
    // overridden
};

exports.onTestFail = function(test) {
    // overridden
};

exports.onTestStart = function(test) {
    // overridden
};

exports.onTestEnd = function(test) {
    // overridden
};

exports.setupSuite = function(test) {
    // overridden
};

exports.teardownSuite = function(test) {
    // overridden
};

exports.allClear = true;
exports.context = {};

exports.runTests = function(options) {
    var deferred = q.defer();

    exports.context = options['context'];

    var mochaOptions = {
        reporter: 'dot',
        ui: 'bdd',
        timeout: options['timeout'] || 10000
    };

    var suppressMessages;
    if ( options['runMode'] == 'coverage' ) {
        mochaOptions['reporter'] = 'html-cov';
        suppressMessages = true;
    } else {
        mochaOptions['reporter'] = 'list';
    }

    var mocha = new Mocha(mochaOptions);
    var that = this;
    var testDir = options['testcases'] || exports.getTestDir();

    testUtils.recursiveDirectoryProcessor( testDir, testDir, testDir, true, function(type, file) {
        if (path.extname(file) === '.js') {
            mocha.addFile(file);
        }
        return q.resolve();
    }).then( function() {

        var runner = mocha.run(function () {
            that.beforeTest();
        });

        runner.on('suite', function (test) {
            if ( test['title'] == that.getParentSuiteName() ) {
                if ( that.context ) {
                    for ( var key in exports.context ) {
                        if ( exports.context.hasOwnProperty(key) ) {
                            var value = exports.context[key];
                            test['ctx'][key] = value;
                        }
                    }
                }
                that.setupSuite( test['ctx']);
            }
        });

        runner.on('suite end', function (test) {
            if ( test['title'] == that.getParentSuiteName() ) {
                that.teardownSuite(test);
            }
        });

        runner.on('end', function (test) {
            deferred.resolve(exports.allClear);
        });

        runner.on('test', function (test) {
            that.onTestStart(test);
        });

        runner.on('pass', function (test) {
            that.onTestPass(test);
            that.onTestEnd(test);
        });

        runner.on('fail', function (test) {
            that.allClear = false;
            that.onTestFail(test);
            that.onTestEnd(test);
        });

    });

    return deferred.promise;
};

