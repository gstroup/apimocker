# apimocker [![Build Status](https://api.travis-ci.org/gstroup/apimocker.svg?branch=master)](https://api.travis-ci.org/gstroup/apimocker.svg)
[![NPM](https://nodei.co/npm/apimocker.svg?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apimocker/)

This is a node.js module to run a simple http server, which can serve up mock service responses.
Responses can be JSON or XML to simulate REST or SOAP services.
Access-Control HTTP Headers are set by default to allow CORS requests.
Mock services are configured in the config.json file, or on the fly, to allow for easy functional testing.
Apimocker can return different responses or HTTP status codes, based on request parameters - even complex JSON requests.
Using apimocker, you can develop your web or mobile app with no dependency on back end services.
(There are lots of these projects out there, but I wrote this one to support all kinds of responses,
to allow on-the-fly configuration, and to run in node.)

## Installation
		sudo npm install -g apimocker
That will install globally, and allow for easier usage.
(On Windows, you don't need "sudo".)

## Usage
        apimocker [-c, --config <path>] [-q, --quiet] [-p <port>] [-f, --proxy <proxyURL>]

Out of the box, you can just run "apimocker" with no arguments.
(Except on windows, you'll need to edit config.json first.  See below.)

Then you can visit "http://localhost:7878/first" in your browser to see it work.
The quiet and port options can also be set in the config.json file,
and values from config.json will override values from the command line.
After you get up and running, you should put your config.json and mock responses in a better location.
It's not a good idea to keep them under the "node_modules" directory.
Make sure another process is not already using the port you want.
If you want port 80, you may need to use "sudo" on Mac OSX.

### Proxy
Sometimes you only want some service endpoints to be mocked, but have other requests forwarded to real service endpoints.
In this case, provide the proxy URL option on startup e.g.
`apimocker --proxy http://myrealservice.io`
When the proxy option is set, any requests to apimocker with URLs that are not configured with mock files, will be forwarded to the specified URL.

### With Grunt or Gulp
If you're using Grunt for your project, there's a grunt plugin you can use to start up apimocker:
[https://github.com/gstroup/grunt-apimocker]()

For Gulp, there's also a plugin contributed by kent-wu:
[https://github.com/kent-wu/gulp-apimocker]()

### Windows note
After installing from npm, you'll need to edit this file:
        /Users/xxxxx/AppData/Roaming/npm/node_modules/apimocker/config.json
Change the "mockDirectory" to point to this location.
(Or another location where you put the mock responses.)
        mockDirectory: /Users/xxxxx/AppData/Roaming/npm/node_modules/apimocker/samplemocks

### Running in Cloud Foundry
You can deploy apimocker into a cloud foundry instance by running `cf push`.  The port you specify will be ignored, and you'll use the standard port 80 to access apimocker.  When specifying your mockDirectory, you will need to use a relative path, like "samplemocks/".  At this time, you'll need to do another build and push whenever you change a mock file.

### Help
        apimocker -h

## Configuration
On startup, config values are loaded from the config.json file.
During runtime, mock services can be configured on the fly.
See the sample config.json file in this package.

* Services can be configured to return different responses, depending on a request parameter or request header.
* Content-type for a service response can be set for each service.  If not set, content-type defaults to application/xml for .xml files, and application/json for .json files.
* HTTP Status code can be set for each service.
* Latency (ms) can be set to simulate slow service responses.  Latency can be set for a single service, or globally for all services.
* Allowed domains can be set to restrict CORS requests to certain domains.
* Allowed headers can be set.  (Default is to set "access-control-allow-headers: Content-Type" if not specified in config file.)
* config.json file format has changed with the 0.1.6 release.  See below for the new format.  (Old config.json file format is deprecated and doesn't support new features, but still functioning.)
* mockDirectory value can include tilde (~) for user's home directory.
* A static route can be opened up to serve up static assets like images.  Both staticDirectory and staticPath must be set.  If either is not set, then nothing happens.
* Additional headers can be defined for responses.
* Request headers can be logged, with the `logRequestHeaders` setting.
* Alternate URL paths can be specified with the `alternatePaths` setting.
* With the `enableTemplate` setting, values from the request can be inserted into the mock response.

```js
{
  "note": "This is a sample config file. You should change the mockDirectory to a more reasonable path.",
  "mockDirectory": "/usr/local/lib/node_modules/apimocker/samplemocks/",
  "staticDirectory": "/optional/file/system/path/to/static/directory",
  "staticPath": "/optional/web/path/to/static/directory",
  "quiet": false,
  "port": "7878",
  "latency": 50,
  "logRequestHeaders": false,
  "allowedDomains": ["abc.com"],
  "allowedHeaders": ["Content-Type", "my-custom-header"],
  "webServices": {
    "first": {
      "mockFile": "king.json",
      "latency": 20,
      "verbs": ["get"],
      "alternatePaths": ["1st"]
    },
    "second": {
      "verbs": ["delete", "post"],
      "responses": {
        "delete": {"httpStatus": 204},
        "post": {
          "contentType": "foobar",
          "mockFile": "king.json"
        }
      }
    },
    "nested/ace": {
      "mockFile": "ace.json",
      "verbs": ["post", "get"],
      "switch": "customerId"
    },
    "nested/ace2": {
      "mockFile": "ace.json",
      "verbs": ["post", "get"],
      "switch": ["customerId","multitest"]
    },
    "var/:id": {
      "mockFile": "xml/queen.xml",
      "verbs": ["all"],
      "switch": "id"
    },
    "login": {
      "verbs": ["post"],
      "switch": ["userId", "password"],
      "responses": {
        "post": {"httpStatus": 401, "mockFile": "sorry.json"}
      },
      "switchResponses": {
        "userIduser1passwordgood": {"httpStatus": 200, "mockFile": "king.json"},
        "userIdadminpasswordgood": {"httpStatus": 200}
      }
    },
    "nested/aceinsleeve": {
      "verbs": [
        "post"
      ],
      "switch": "$..ItemId[(@.length-1)]",
      "responses": {
        "post": {"httpStatus": 200, "mockFile": "aceinsleeve.json"}
      },
      "switchResponses": {
        "$..ItemId[(@.length-1)]4": {"httpStatus": 500, "mockFile": "ItemId4.aceinsleeve.json"}
      }
    },
    "firstheaders": {
      "mockFile": "king.json",
      "contentType": "foobar",
      "headers": {
        "x-requested-by": "4c2df03a17a803c063f21aa86a36f6f55bdde1f85b89e49ee1b383f281d18c09c2ba30654090df3531cd2318e3c",
        "dummyheader": "dummyvalue"
      },
      "verbs": ["get"]
    },
    "template/:Name/:Number" :{
      "mockFile": "templateSample.json",
      "verbs":["get"],
      "enableTemplate": true
      "contentType":"application/json"
    }
  }
}
```
The most interesting part of the configuration file is the webServices section.
This section contains a JSON object describing each service.  The key for each service object is the service URL (endpoint.)  Inside each service object, the "mockFile" and "verbs" are required.  All other attributes of the service objects are optional.
For instance, a GET request sent to "http://server:port/first" will return the king.json file from the samplemocks directory, with a 20 ms delay.
If you'd like to return different responses for a single URL with different HTTP verbs ("get", "post", etc) then you'll need to add the "responses" object.  See above for the "second" service.  The "responses" object should contain keys for the HTTP verbs, and values describing the response for each verb.

### Switch response based on request parameter
In your configuration, you can set up a "switch" parameter for each service.  If set, apimocker will check the request for this parameter, and return a different file based on the value.  (Apimocker will check the request for the parmater in this order: first request body, second query string, third request headers.)  For instance, if you set up a switch as seen above for "nested/ace", then you can will get different responses based on the request sent to apimocker.  A JSON POST request to the URL "http://localhost:7878/nested/ace" with this data:
```js
{
  "customerId": 1234
}
```
will return data from the mock file called "customerId1234.ace.json".  Switch values can also be passed in as query parameters:
        http://localhost:7878/nested/ace?customerId=1234
or as part of the URL, if you have configured your service to handle variables, like the "var/:id" service above:
        http://localhost:7878/var/789
If the specific file, such as "customerId1234.ace.json" is not found, then apimocker will attempt to return the base file: "ace.json".

For simple switching, you can use strings as shown in the configuration above.  For more complex switching, using RegExp or JsonPath, you can use switch objects, to describe each switch.
```js
{
	"type": "one of these strings: default|regexp|jsonpath",
	"key": "identifier used in mock file name",
	"switch": "string | regular expression | json path expression"
}
```

#### Multiple switches
You can now also define an array of values to switch on. Given the configuration in "ace2", a request to "nested/ace2" containing:
```js
{
  "multitest": "abc",
  "customerId": 1234
}
```
will return data from the mock file called "customerId1234multitestabc.ace.json".  Note that when using multiple switches, the filename must have parameters in the same order as configured in the "switch" setting in config.json.
Also, apimocker will look for the filename that matches ALL the request parameters.  If one does not match, then the base file will be returned.

#### Switch HTTP Status
To specify a different HTTP status, depending on a request parameter, you'll need to set up the "switchResponses" as shown above for the "login" service.  You can also set a specific mock file using the "switchRespones" configuration.  The switchReponses config section is an object, where the key is a composite of the switch keys specified in the "switch" setting for the service, and the values for each key, passed in as request parameters.  For instance, a post request to "/login" containing:
```js
{
  "userId": "user1",
  "password": "good"
}
```
will return data from the mock file called "king.json", with HTTP status 200.
Any other password will return "sorry.json" with HTTP status 401.

#### JsonPath Support
For complex JSON requests, JsonPath expressions are supported in the switch parameter. If your switch parameter begins with "$." then it will be evaluated as a JsonPath expression.  
For example to switch the response based on the value of the last occurence of ItemId in a JSON request, use configuration as shown for "aceinsleeve":
```js
"switch": "$..ItemId[(@.length-1)]",
  "responses": {
    "post": {"httpStatus": 200, "mockFile": "aceinsleeve.json"}
  },
  "switchResponses": {
    "$..ItemId[(@.length-1)]4": {"httpStatus": 500, "mockFile": "ItemId4.aceinsleeve.json"}
  }
```
According to this configuration, if the value of the last occurence of ItemId is 4, the mockFile "ItemId4.aceinsleeve.json" will be retured with a HTTP status code of 500. Otherwise, mockFile "aceinsleeve.json"
will be returned with HTTP status 200. Note: If the JsonPath expression evaluates to more then 1 element (for example, all books cheaper than 10 as in $.store.book[?(@.price < 10)] ) then the first element is considered for testing the value.

#### RegExp Support
As an alternative to JsonPath, Javascript Regular Expressions are supported in the switch parameter.  See unit tests in the test.js file for examples of using Regular Expressions.

### Returning additional headers with the response
To return additional custom headers in the response, set the headers map in the configuration file, like this example:
```js
    "firstheaders": {
      "mockFile": "king.json",
      "contentType": "foobar",
      "headers": {
        "x-requested-by": "4c2df03a17a803c063f21aa86a36f6f55bdde1f85b89e49ee1b383f281d18c09c2ba30654090df3531cd2318e3c",
        "dummyheader": "dummyvalue"
      },
      "verbs": ["get"]
    }
```
In this example the headers x-requested-by and dummy will be returned on the response.  contentType can be specified separately, as it is above, or specified as "content-type" in the "headers" map.

### Templating your JSON
You can take values in the route and insert them into your json. All you need to do is set "enableTemplate" to true, specify a content type and have a matching @ in the mock json file. Here's an example:

config.json
```js
 "template/:Name/:Number" :{
   "mockFile": "templateSample.json",
   "verbs":["get"],
   "enableTemplate": true
   "contentType":"application/json"
 }
```
templateSample.json
```js
{
  "Name": "@Name"
  "Number": @Number
}   
```

When you call /John/12345 you will be returned:
```js
{
	"Name": "John"
	"Number": 12345
}
```

### Adding custom middleware
For advanced users, apimocker accepts any custom middleware functions you'd like to add.  The `middlewares` property is an array of middleware functions you can modify.  Here's a basic example:
```
var apiMocker = require("../lib/apimocker.js");
var customMiddleware = function(req, res, next) {
		res.header('foo', 'bar');
		next();
	};
var mocker = apiMocker.createServer({quiet: true}).setConfigFile("test/test-config.json");
mocker.middlewares.unshift(customMiddleware);
mocker.start(null, done);
```

## Runtime configuration
After starting apimocker, mocks can be configured using a simple http api.
This http api can be called easily from your functional tests, to test your code's handling of different responses.

### /admin/setMock
This allows you to set a different response for a single service at any time by sending an http request.
Request can be a post containing a JSON object in the body:
```js
{
	"verb":"get",
	"serviceUrl":"third",
	"mockFile":"queen.xml",
    "latency": 100,
    "contentType": "anythingyouwant"
}
```

or a get with query string parameters:
localhost:7878/admin/setMock?verb=get&serviceUrl=second&mockFile=ace.json

### /admin/reload
If the config.json file is edited, you can send an http request to /admin/reload to pick up the changes.

## Versions
#### 0.4.11
Added template feature, to insert values from request into the mock response.  Thanks @Samurai336 !
#### 0.4.10
Added express-xml-bodyparser, so that XML post requests can be use for RegExp switches.  Thanks @asnov !
#### 0.4.9
Added support for custom middleware functions.
#### 0.4.8
Added proxy option. Thanks @ztsmith !
#### 0.4.7
Added ability to switch using Regular Expression.  (See issue #2, #33, #34)  Thanks @dploeger !
#### 0.4.6
Added ability to switch on header param.  Thanks @stelio !
#### 0.4.5
Added support for alternate paths in a web service config. Added support for a callback function when starting the server.  Thanks @ztsmith !
#### 0.4.4
Added option to log request headers.  Thanks @dmeenhuis !
#### 0.4.3
Added support to run apimocker in Cloud Foundry.
#### 0.4.2
Added support for tilde (~) in mockDirectory config setting.
#### 0.4.0
Removed support for old deprecated config file format.  Fixed issue #19.
#### 0.3.5
Added support for additional custom HTTP headers.  Thanks to @jcstover !
#### 0.3.4
Added support for switching response based on complex JSON request, using JSONPath.  (see issue #14)  Thanks to @priyagampa !
#### 0.3.3
Added support for switching response HTTP status based on a request parameter.  (see issue #12)
#### 0.3.2
Added support for multiple switch parameters on a single URL.  Thanks @skjegg and @snyoz !
#### 0.3.1
Added support for a static path.  (see issue #9)
#### 0.3.0
Refactored and updated to use Express 4.5.  (No functional change.)
#### 0.2.4
Allows configuration of the "access-control-allow-headers" HTTP header.
#### 0.2.3
Now allows HTTP status code to be set for each response.  Config file format also allows configuration of different responses based on http verb.
#### 0.1.8
New "switch" feature added, allowing different responses based on a request parameter.
#### 0.1.6
New config file format was introduced, allowing for custom content-types and more fine grained control over services.

## Contributors
Run "grunt watch" in the root "apimocker" directory to start the grunt watch task.  This will run JSHint and mocha tests.

## Acknowledgements
Big thanks to magalhas for his httpd-mock project.  This gave me a great starting point.
Also thanks to clafonta and the Mockey project for inspiration.

## License
This projected is licensed under the terms of the MIT license.
