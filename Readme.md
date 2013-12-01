# NodeJS Functional and Unit Testing just got fun

Testing nodeJS applications -- for example, those written ontop of the Jive SDK -- has become easier than ever, using the jive testing framework (https://github.com/jivesoftware/jive-testing-framework). The framework:
is a convenient wrapper for the excellent Mocha library, and enables you to inject useful framework and custom utilities into the testing context.
includes a super useful "server simulator" that you can instantiate and control from within your testing context. Yep, you can dynamically spawn servers up, program their intended responses, and even ship *code* to these servers to further customize their behavior. This makes the framework especially useful for testing applications that need to mock the interaction of external systems (eg. Jive, salesforce, or whatever).
is a test coverage measurer/visualizing tool. Stay tuned on how to do this in a future post from me.
 
## Including the framework
To begin testing your application, make sure you include the testing framework in your package.json:
 
```
{
    …  
    "dependencies": {  
        …  
        "jive-testing-framework" : "git+ssh://git@github.com/jivesoftware/jive-testing-framework.git",  
        …  
    }  
}
```

The framework is not yet published to NPM, so it must be pulled down by nodes directly from the public github repository, stay tuned for nom packaging.
 
## Setting up your test runner
Next you have to create a runner. I've called my example one run.js, and it should be executable by node (eg. node run.js should work).
 
```
var testUtils = require('jive-testing-framework/testUtils');
var jive = require('jive-sdk');  
var jiveMongo = require('../');  
  
var makeRunner = function() {  
    var runner = Object.create(require('jive-testing-framework/baseSuite'));  
  
    runner.getParentSuiteName = function() {  
        return 'jive';  
    };  
  
    runner.onTestStart = function(test) {  
        test['ctx']['persistence'] = new jiveMongo({  
            'databaseUrl' : 'mongodb://localhost:27017/mongoTestDB'  
        });;  
    };  
  
    runner.onTestEnd = function(test) {  
        test['ctx']['persistence'].destroy();  
    };  
  
    return runner;  
};  
  
makeRunner().runTests(  
    {  
        'context' : {  
            'testUtils' : testUtils,  
            'jive' : jive,  
            'jiveMongo' : jiveMongo  
        },  
        'runMode' : 'test',  
        'testcases' : process.cwd()  + '/library',  
        'timeout' : 5000  
    }  
).then( function(allClear) {  
    if ( allClear ) {  
        process.exit(0);  
    } else {  
        process.exit(-1);  
    }  
});
```
 
In this simple runner, I've created a makeRunner function that extends the base test runner in the framework (jive-testing-framework/baseSuite). The base suite runner has extension points which your particular instance can override. In my example, on the start of every test I inject into the test context an instance of mongodb client. I can inject anything I want into the context, and it will be available from within the test as this['<NAME OF MY RESOURCE>']. Then on each test teardown, I destroy the mongodb client. The .getParentSuiteName() function is overridden in my runner to indicate that tests of suite 'jive' and its children should be executed.
 
Any resources that should always be present will be injected into the testing context via the 'context' parameter to runTests. In my example, I injected an instance of the framework testUtils, the jive-sdk, and the jive mongo driver into the context.
 
The 'test cases' parameter to runTests() is the location of the testcase library, described below. The 'timeout' parameter controls how much time Mocha should give to an individual test before that test is counted as failed. The 'runMode' parameter determines whether or not we are running the testing framework in test mode, or in coverage mode.
 
## Setting up the testcase library
In your project, set up a testcase folder hierarchy. Its root should be equal to the ''testcases' parameter of context attribute fed to runTests. Here is what mine looks like:
 
```
\projectroot
       \test  
            \library  
                 \mongo  
                      \testcases  
                 \othermonogotests  
                      \testcases
```

The test runner will recursively execute any Mocha tests found in the \testcases folders inside your library root.
 
Here is one such file, called tests.js, located under \library\mongo\testcases\tests.js:
 
```
var assert = require('assert');
var test = require('../basePersistenceTest');  
  
describe('jive', function () {  
  
    describe ('#persistence.mongo', function () {  
  
        it('save', function (done) {  
            var jive = this['jive'];  
            var testUtils = this['testUtils'];  
            var persistence = this['persistence'];  
  
            test.testSave(testUtils, persistence).then(  
                function() {  
                    setTimeout( function() {  
                        done();  
                    }, 1000);  
                },  
  
                function(e) {  
                    assert.fail(e);  
                }  
            ).finally( function() {  
                    return persistence.close();  
                });  
        })  
});
```

In this example, I pull out the jive, persistence, and testUtils resources injected into the test context, then provide them as parameters into a custom testing utility called 'basePersistenceTest' that exists in a folder just above the one housing my currently executing test. Note that I could have also just used those resources inline in my test.
 
## Simulating a remote server
Here is a fun example of simulating Jive, and controlling what it will return.

```
var assert = require('assert');
  
describe('jive', function () {  
  
    describe ('server', function () {  
  
    it('test', function (done) {  
        var jive = this['jive'];  
        var testUtils = this['testUtils'];  
  
        var server;  
        testUtils.createServer( {  
            'port' : 5556,  
            'routes' : [  
                {  
                    'method'        : 'get',  
                    'statusCode'    : '200',  
                    'path'          : '/hi',  
                    'body'          : 'hiya',  
                    'handler' : function() {  
                        // optional  
                        // this is going to run on the remote server!  
                        // mutates the response for /hi -- making that endpoint reject now that its  
                        // been called once  
                        delete app.routes.get;  
                        self.setEndpoint(  
                            'get',  
                            '/hi',  
                            '400',  
                            JSON.stringify({ 'expired' : 'now'})  
                        );  
                    }  
                }  
            ]  
        }).then( function(_server) {  
                server = _server;  
                return jive.util.buildRequest( 'http://localhost:5556/hi').then( function(response) {  
                    // first call should be success  
                    console.log(response);  
                    assert.ok(response);  
                    assert.equal( response.entity.body, 'hiya');  
                }).then( function() {  
                    // second call should fail  
                    return jive.util.buildRequest( 'http://localhost:5556/hi').then(  
                        function(response) {  
                            // expected error  
                            assert.fail(response);  
                        },  
                        function(err) {  
                            assert.ok(err);  
                            assert.equal( err['statusCode'], 400);  
                        }  
                    );  
  
                });  
            }).catch(function(e) {  
                assert.fail(e);  
            }).then( function() {  
                done();  
            }).finally( function() {  
                if ( server ) {  
                    return server.stop();  
                }  
            });  
     });  
  
});
```
 
## More fun things you can do
As part of your run.js you can inject some of the other amazingly useful utilities such as mockery and simon, for noninvasive mocks of whole libraries and individual functions. But hopefully what I have presented here will make unit and functional testing easier for nodeJS apps.
 