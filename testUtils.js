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

var q = require('q');
var fs = require('fs');
var uuid = require('node-uuid');
var crypto = require('crypto');
var temp = require('temp');
var assert = require('assert');

// track temp files
temp.track();

exports.recursiveDirectoryProcessor = function (currentFsItem, root, targetRoot, force, processor) {

    var recurseDirectory = function (directory) {
        return q.nfcall(fs.readdir, directory).then(function (subItems) {
            var promises = [];
            subItems.forEach(function (subItem) {
                promises.push(exports.recursiveDirectoryProcessor(directory + '/' + subItem, root, targetRoot, force, processor));
            });

            return q.all(promises);
        });
    };

    return q.nfcall(fs.stat, currentFsItem).then(function (stat) {
        var targetPath = targetRoot + '/' + currentFsItem.substr(root.length + 1, currentFsItem.length);

        if (stat.isDirectory()) {
            if (root !== currentFsItem) {
                return exports.fsexists(targetPath).then(function (exists) {
                    if (root == currentFsItem || (exists && !force)) {
                        return recurseDirectory(currentFsItem);
                    } else {
                        return processor('dir', currentFsItem, targetPath).then(function () {
                            return recurseDirectory(currentFsItem)
                        });
                    }
                });
            }

            return recurseDirectory(currentFsItem);
        }

        // must be a file
        return exports.fsexists(targetPath).then(function (exists) {
            if (!exists || force) {
                return processor('file', currentFsItem, targetPath)
            } else {
                return q.fcall(function () {
                });
            }
        });
    });
};

exports.fsexists = function (path) {
    var deferred = q.defer();
    var method = fs.exists ? fs.exists : require('path').exists;
    method(path, function (exists) {
        deferred.resolve(exists);
    });

    return deferred.promise;
};

var hex_high_10 = { // set the highest bit and clear the next highest
    '0': '8',
    '1': '9',
    '2': 'a',
    '3': 'b',
    '4': '8',
    '5': '9',
    '6': 'a',
    '7': 'b',
    '8': '8',
    '9': '9',
    'a': 'a',
    'b': 'b',
    'c': '8',
    'd': '9',
    'e': 'a',
    'f': 'b'
};

exports.guid = function (src) {
    if (!src) {
        return uuid.v4();
    } else {
        var sum = crypto.createHash('sha1');

        // namespace in raw form. FIXME using ns:URL for now, what should it be?
        sum.update(new Buffer('a6e4EZ2tEdGAtADAT9QwyA==', 'base64'));

        // add HTTP path
        sum.update(src);

        // get sha1 hash in hex form
        var u = sum.digest('hex');

        // format as UUID (add dashes, version bits and reserved bits)
        u =
            u.substr(0, 8) + '-' + // time_low
                u.substr(8, 4) + '-' + // time_mid
                '5' + // time_hi_and_version high 4 bits (version)
                u.substr(13, 3) + '-' + // time_hi_and_version low 4 bits (time high)
                hex_high_10[u.substr(16, 1)] + u.substr(17, 1) + // cloc_seq_hi_and_reserved
                u.substr(18, 2) + '-' + // clock_seq_low
                u.substr(20, 12); // node
        return u;
    }
};

exports.createFakeURL = function(fakePath) {
    var url = 'http://' + exports.guid() + '.com';
    if ( fakePath ) {
        url += '/' + exports.guid();
    }

    return url;
};

exports.createTempDir = function() {
    var deferred = q.defer();
    temp.mkdir(exports.guid(), function(err, dirPath) {
        deferred.resolve(dirPath);
    });
    return deferred.promise;
};

exports.cleanupTemp = function() {
    temp.cleanup();
};

exports.getResourceFilePath = function(filename) {
    return process.cwd() + '/resources/' + filename;
};

exports.waitSec = function(seconds) {
    var deferred = q.defer();
    setTimeout( function() { deferred.resolve() }, seconds * 1000);
    return deferred.promise;
};

exports.createServer = function(config) {
    var d = q.defer();
    var server = require('./serverControl');

    server.start(config).then(
        function() {
            // build up endpoints
            var routes = config['routes'] || [];
            var promises = [];

            routes.forEach( function(route) {
                if ( route && route['method'] ) {
                    var p = server.setEndpoint(
                        route['method'],
                        route['statusCode'],
                        route['path'],
                        route['body'],
                        route['handler']
                    );
                    promises.push(p);
                }
            });

            return q.all(promises);
        }, function() {
           return q.reject();
        }
    ).then( function() {
        return d.resolve(server);
    });

    return d.promise;
};

exports.fsread = function (path) {
    var deferred = q.defer();
    fs.readFile(path, function (err, data) {
        deferred.resolve(data);
        return data;
    });
    return deferred.promise;
};

exports.fsreadJson = function (path) {
    return exports.fsread(path).then(function (data) {
        return JSON.parse(new Buffer(data).toString());
    });
};

exports.fswrite = function (data, path) {
    var deferred = q.defer();

    fs.writeFile(path, data, function (err) {
        if (err) {
            deferred.reject(err);
        }
        else {
            deferred.resolve();
        }
    });
    return deferred.promise;
};

exports.makeRunner = function( options ) {
    options = options || {};
    var runMode = options['runMode'] || 'test';
    var eventHandlers = options['eventHandlers'] || {};

    var runner = Object.create(require('./baseSuite'));
    for ( var key in eventHandlers ) {
        if ( eventHandlers.hasOwnProperty(key) ) {
            var value = eventHandlers[key];
            runner[key] = value;
        }
    }

    return runner;
};