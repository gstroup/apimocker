# apimocker [![Build Status](https://api.travis-ci.org/gstroup/apimocker.svg?branch=master)](https://travis-ci.org/gstroup/apimocker)
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
        apimocker \[-c, --config <path>\] \[-q, --quiet\] \[-p <port>\] \[-f, --proxy <proxyURL>\] \[-i, --intercept <proxyIntercept>\]

Out of the box, you can just run "apimocker" with no arguments.
(Except on windows, you'll need to edit config.json first.  See below.)

Then you can visit "http://localhost:7878/first" in your browser to see it work.
The quiet and port options can also be set in the config.json file,
and values from config.json will override values from the command line.
After you get up and running, you should put your config.json and mock responses in a better location.
It's not a good idea to keep them under the "node_modules" directory.
Make sure another process is not already using the port you want.
If you want port 80, you may need to use "sudo" on Mac OSX.

### Windows note
After installing from npm, you may need to edit this file:
        /Users/xxxxx/AppData/Roaming/npm/node_modules/apimocker/config.json
Change the "mockDirectory" to point to this location.
(Or another location where you put the mock responses.)
        mockDirectory: /Users/xxxxx/AppData/Roaming/npm/node_modules/apimocker/samplemocks

### Proxy
Sometimes you only want some service endpoints to be mocked, but have other requests forwarded to real service endpoints.
In this case, provide the proxy URL option on startup e.g.
`apimocker --proxy http://myrealservice.io`
When the proxy option is set, any requests to apimocker with URLs that are not configured with mock files, will be forwarded to the specified URL.

A proxy intercept function can be specified to modify responses, using the proxy intercept option (`apimocker --proxy http://myrealservice.io` --intercept config/proxyResponseCustomizer`). The value of the option should be the path, relative to the current working directory, to a module that exports an intercept function as documented in the [express-http-proxy docs](https://github.com/villadora/express-http-proxy#intercept).

### Uploads
There is a simple support of `multipart` form data upload process of a single or multiple files. A global option `uploadRoot` determines where the files will be saved after successful upload, and another option - `useUploadFieldname` tells apimocker (actually - [multer](https://github.com/expressjs/multer)) whether to save the uploaded file with the original filename found in the request (default), or the name of the field. Although the latter may sound strange, it can make certain testing procedure simpler.

### With Grunt or Gulp
If you're using Grunt for your project, there's a grunt plugin you can use to start up apimocker:
https://github.com/gstroup/grunt-apimocker

For Gulp, there's also a plugin contributed by kent-wu:
https://github.com/kent-wu/gulp-apimocker

### Running in Cloud Foundry
You can deploy apimocker into a cloud foundry instance by running `cf push`.  The port you specify will be ignored, and you'll use the standard port 80 to access apimocker.  When specifying your mockDirectory, you will need to use a relative path, like "samplemocks/".  At this time, you'll need to do another build and push whenever you change a mock file.

### Help
        apimocker -h

## Configuration
On startup, config values are loaded from the config.json file.
During runtime, mock services can be configured on the fly.
See the sample config.json file in this package.

* Config files can be either `.json` format, or in `.js`. When using `.js`, the module should export a config object, or a function that returns a config object.
* Services can be configured to return different responses, depending on a request parameter or request header.
* Content-type for a service response can be set for each service.  If not set, content-type defaults to application/xml for .xml files, and application/json for .json files.
* HTTP Status code can be set for each service.
* Latency (ms) can be set to simulate slow service responses.  Latency can be set for a single service, or globally for all services.
* Allowed domains can be set to restrict CORS requests to certain domains.
* Allowed headers can be set.  (Default is to set "access-control-allow-headers: Content-Type" if not specified in config file.)
* config.json file format has changed with the 0.1.6 release.  See below for the new format.  (Old config.json file format is deprecated and doesn't support new features, but still functioning.)
* mockDirectory value can include tilde (~) for user's home directory.
* A basepath can be specified to set a prefix on all web services.  Preceding slash is required.  For instance if basepath is set to "/apimocker", then all requests must go to "http://localhost:7878/apimocker/..."
* A static route can be opened up to serve up static assets like images.  Both staticDirectory and staticPath must be set.  If either is not set, then nothing happens.
* Additional headers can be defined for responses, in the `headers` object.  Different headers could be returned for different requests, by enabling a switch.
* Request headers can be logged, with the `logRequestHeaders` setting.
* Alternate URL paths can be specified with the `alternatePaths` setting.
* With the `enableTemplate` setting, values from the request can be inserted into the mock response.
* With the `templateSwitch` setting, parameter names and values from the request can be mapped and inserted into the mock response, including POST requests and powerful JSONPath parameter substitution into a JSON POST body.
* Set the `allowAvoidPreFlight` config option to true to allow requests sent with `Content-Type: text/plain` to be processed as json if possible. (default is false).  This allows apimocker to work with servers such as Parse Server.

```json
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
  "corsCredentials": "true",
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
      "enableTemplate": true,
      "contentType":"application/json"
    },
    "raw": {
      "mockBody": "{ \"text\" : \"Good Job!\" }",
      "verbs": ["all"]
    }
  }
}
```
The most interesting part of the configuration file is the webServices section.
This section contains a JSON object describing each service.  The key for each service object is the service URL (endpoint.)  Inside each service object, the `mockFile` (or `mockBody`) and `verbs` are required.  All other attributes of the service objects are optional.
For instance, a GET request sent to "http://server:port/first" will return the king.json file from the samplemocks directory, with a 20 ms delay. Alternatively one can specify the `mockBody` directly, bypassing the need for a specific mock file.
If you'd like to return different responses for a single URL with different HTTP verbs ("get", "post", etc) then you'll need to add the "responses" object.  See above for the "second" service.  The "responses" object should contain keys for the HTTP verbs, and values describing the response for each verb.

### Switch response based on request parameter
In your configuration, you can set up a "switch" parameter for each service.  If set, apimocker will check the request for this parameter, and return a different file based on the value.  (Apimocker will check the request for the parameter in this order: first request body, second query string, third request headers.)  For instance, if you set up a switch as seen above for "nested/ace", then you will get different responses based on the request sent to apimocker.  A JSON POST request to the URL "http://localhost:7878/nested/ace" with this data:
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

#### JsonPath with Switch Response support
For requests that without any params should be returning a list of items (e.g. `/users`), and with some param just single item (e.g. `/users/:id`) there are special configuration options provided to select those single items from prepared mock json file containing list of items. No need to create separate files per each parameter.
Example mock file could look like this:
```js
[
    {
        "name": "Han Solo",
        "role": "pilot",
        "id": 1
    },
    {
        "name": "Chewbacca",
        "role": "first officer",
        "id": 2
    },
    {
        "name": "C3P0",
        "role": "droid",
        "id": 3
    },
    {
        "name": "R2D2",
        "role": "droid",
        "id": 4
    }
]
```

and example configurataion like this:

```js
"users": {
  "mockFile": "users.json",
  "verbs": [
    "get"
  ]
},
"users/:id": {
  "mockFile": "users.json",
  "verbs": [
    "get"
  ],
  "switch": "id",
  "jsonPathSwitchResponse": {
      "jsonpath": "$[?(@.id==#id#)]",
      "mockFile": "users.json",
      "forceFirstObject": true
  }
},
"users/role/:role": {
  "mockFile": "users.json",
  "verbs": [
    "get"
  ],
  "switch": "role",
  "jsonPathSwitchResponse": {
    "jsonpath": "$[?(@.role==\"#role#\")]",
    "mockFile": "users.json",
    "forceFirstObject": false
  }
}
```

The first config property (`users`) contains just a standard `get` for all users. The second (`users/:id`) and third though (`users/role/:role`), contains a proper switch configuration and `jsonPathSwitchResponse` config that contains following parameters:
* jsonpath - this is a JsonPath selector for objects to match inside `mockFile`; parameters values from switch are transferred to it's corresponding names wrapped in `#` characters,
* mockFile - a file name with mocked response to search through,
* forceFirstOject - (default: false) this is a switch telling if we should return all found items as an array, or select first one and return it as an object.

So it is possible to select just a single user by id as an object (`/users/1`), but it is also possible to return multiple users as an array (`users/role/droid`).

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

### Templating your response
Templating is a powerful feature which allows values in the route,  request parameters, or POST data to be inserted into the response, be it JSON, HTML, etc.

To utilize this capability, in the request string, insert a colon followed by a variable identifier at the location where the value should be substituted. Then set "enableTemplate" to true, specify a content type, and in the response file, wherever the substitution should appear, insert the '@' symbol followed by the chosen variable identifier. This placeholder can appear anywhere in the mock template file, including in multiple places.

 In this first example, the values represented by Name and Number will be taken from the request and substituted into the response:

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
  "Name": "@Name",
  "Number": "@@Number"
}
```

When you call /John/12345 you will be returned:
```js
{
	"Name": "John"
	"Number": 12345
}
```

### TemplateSwitch your response
Another form of templating uses the `templateSwitch` setting. This feature uses the same structure as the `switch` setting and is similar but more flexible than the `enableTemplate` feature in order to map parameter names and values from the request into the mock  template response. GET and POST requests are supported including powerful JSONPath parameter substitution, even substitution into a JSON POST BODY.

To utilize this capability, add the templateSwitch section, specify a content type for the template file, and in the response file, wherever the substitution should appear, insert the '@' symbol followed by the chosen variable identifier. This placeholder can appear anywhere in the mock template file, including in multiple places.

The two templateSwitch examples show the flexibility of the templateSwitch syntax.

config.json with full switch attributes:
```js
    "referral" : {
      "mockFile": "referral_error.json",
      "verbs": ["post"],
      "templateSwitch": [{"key": "partnerUserId",
                         "switch": "$.data.partner_user_id",
                         "type": "default"},
                         {"key": "affiliateKey",
                          "switch": "$.data.affiliate_key",
                          "type": "default"},
                         {"key": "email",
                          "switch": "$.data.contact_details.email",
                          "type": "default"},
                         {"key": "phone",
                          "switch": "$.data.contact_details.phone_number",
                          "type": "default"}],
      "contentType": "application/json",
      "responses": {
        "post": {"httpStatus": 200, "mockFile": "referral_success.json"}
      }
    },
```

config.json using key == switch, and type as default. This route returns an HTML mock template.
```js
    "partner-join" : {
        "mockFile": "ijd_partner_smartbanner.html",
        "verbs":["get"],
        "templateSwitch": ["partner_user_id",
                           "affiliate_key",
                           "referral_id",
                           "email",
                           "phone"],
        "contentType":"text/html"
    },
```

with referral_success.json:
```js
{
    "data" : {
      "partner_user_id": "@@partnerUserId",
      "referral_id": "21EC2020-3AEA-4069-A2DD-08002B30309D",
      "download_url" : "http://localhost:7878/app-download?affiliate_key=@affiliateKey&partner_user_id=@partnerUserId&referral_id=21EC2020-3AEA-4069-A2DD-08002B30309D&email=@email&phone=@phone"
    }
}
```

A POST request to /referral with a JSON POST body of:
```js
   {
       "data": {
             "partner_user_id": 123456789,
             "affiliate_key": "ABCDEFG12345",
             "contact_details": {
                 "email": "test@apimocker.com",
                 "phone": "800-555-1212"
             }
       }
   }
```

Will  result in the referral_success.json with the POST body parameters inserted as follows:
```js
{
    "data" : {
      "partner_user_id": 123456789,
      "referral_id": "21EC2020-3AEA-4069-A2DD-08002B30309D",
      "download_url" : "http://localhost:7878/app-download?affiliate_key=ABCDEFG12345&partner_user_id=123456789&referral_id=21EC2020-3AEA-4069-A2DD-08002B30309D&email=test%40apimocker.com&phone=800-555-1212"
    }
}
```
NOTE: In the template and templateSwitch examples above, special cases are included which will now be described below:

For a JSON template, if the value for the JSON key to be returned should be a numeric value, not a value wrapped in quotes, it is recommended to use the following convention: prefix the variable identifier with two '@' instead of one and within quotes: (e.g: "@@Number"). This tells the template parser to replace the quotes immediately before and after the placeholder as part of the templating process. This allows the mock JSON templates to remain valid JSON while still providing the ability to return numeric-only values.

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
See version history here: [HISTORY.md](HISTORY.md)

## Contributors
Run "grunt watch" in the root "apimocker" directory to start the grunt watch task.  This will run eslint and mocha tests.
All Pull Requests must include at least one test.

## Acknowledgements
Big thanks to magalhas for his httpd-mock project.  This gave me a great starting point.
Also thanks to clafonta and the Mockey project for inspiration.

## License
This projected is licensed under the terms of the MIT license.
