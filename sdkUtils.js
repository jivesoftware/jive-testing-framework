var q = require('q');

exports.initializeApp = function(options) {

    beforeEach(function(done) {
        var jive = this['jive'];
        var that = this;

        var port = (options['port'] || 5555);

        setupService(jive, {
            'svcRootDir' : options['svcRootDir'] || process.cwd(),
            'persistence' : 'memory',
            'logLevel' : options['logLevel'] || 'FATAL',
            'skipCreateExtension' : true,
            'clientUrl' : 'http://localhost:'+port,
            'port': port,
            'suppressHttpLogging' : true
        }).then(function(service) {
            that.service = service;
            done();
        });

    });

    beforeEach(function(done) {
        var jive = this['jive'];
        var that = this;

        var communityUrl = options['communityUrl'] || 'http://localhost:5556';

        persistExampleCommunities(jive, 1, communityUrl).then(function(community) {
            that.community = community;
            done();
        });
    });

    afterEach(function() {
        this.service.stop();
    });
};

exports.initializeJiveServer = function(options) {
    beforeEach(function(done) {
        var jive = this['jive'];
        var testUtils = this['testUtils'];
        var that = this;

        testUtils.createServer({
            'port': options['port'] || 5556
        }).then(function(jiveServer) {
            that.jiveServer = jiveServer;
            done();
        });

    });

    afterEach(function() {
        this.jiveServer.stop();
    });
};

exports.createAuthorizationHeader = function( community ) {
    var jiveURL = community['jiveUrl'], tenantId = community['tenantId'],
        clientId = community['clientId'], clientSecret = community['clientSecret'];
    var header = 'JiveEXTN ';
    var headerDetail='';
    headerDetail += 'algorithm=HmacSHA256';
    headerDetail += '&client_id=' + clientId;
    headerDetail += '&jive_url=' + encodeURIComponent( jiveURL );
    headerDetail += '&tenant_id=' + tenantId;
    headerDetail += '&timestamp=' + new Date().getTime();

    var hmac_signature = require('crypto').createHmac('SHA256', new Buffer(clientSecret, 'base64')).update(headerDetail).digest('base64');

    header += headerDetail;
    header += '&signature=' + hmac_signature;

    return header;
};

exports.testWithJiveRoutes = function(ctx, routes) {
    var promises = [];

    routes.forEach(function(route) {
        var p = ctx.jiveServer.setEndpoint(route['method'], route['statusCode'], route['path'], route['body'], route['handler']);
        promises.push(p);
    });

    return q.all(promises);
};

function createExampleCommunity(jive, jiveUrl) {
    return {
        "jiveUrl": jiveUrl,
        "version": "post-samurai",
        "tenantId": jive.util.guid(),
        "clientId": jive.util.guid(),
        "clientSecret": jive.util.guid(),
        "jiveCommunity": require('url').parse(jiveUrl).host
    };
}

function persistExampleCommunities(jive, quantity,jiveUrl) {
    var communities = [];
    var promises = [];

    for ( var i = 0; i < quantity; i++ ){
        var instance = createExampleCommunity(jive, jiveUrl);

        var p = jive.community.save(instance).then(function(saved) {
            communities.push(saved);
            return q.resolve();
        });
        promises.push( p );
    }

    return q.all(promises).then( function() {
        return quantity == 1 ? communities[0] : communities;
    });
}

function setupService (jive, config) {
    var p = q.defer();
    var startHttp = config && (!config['role'] || config['role'] == 'http');
    var app = startHttp ? require('express')() : {use: function() {}};

    jive.service.init( app, config).then(function() {
        return jive.service.autowire();
    }).then( function() {
        return jive.service.start();
    }).then( function() {

        var deferred = q.defer();
        if ( startHttp ) {
            var server = require('http').createServer(app);
            server.listen(config.port, function () {
                deferred.resolve(server);
            } );
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    }).then( function(server) {
        p.resolve({
            'stop' : function() {
                if ( server ) {
                    server.close();
                }
                return jive.service.stop();
            }
        });
    }).fail( function(e) {
        p.reject(e);
    });

    return p.promise;
}