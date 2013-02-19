# apimocker
This is a node.js module to run a simple http server, which can serve up mock service responses.
Responses can be JSON or XML to simulate REST or SOAP services.
Mock services are configured in the config.json file.
Using apimocker, you can develop your web or mobile app with no dependency on back end services.
(There are lots of these projects out there, but I wrote this one to support all kinds of responses,
to allow on-the-fly configuration, and to run in node.)

## Installation
		sudo npm install -g apimocker
That will install globally, and allow for easier usage.
(On Windows, you don't need "sudo".)

## Usage
        apimocker [-c, --config \<path\>] [-O, --output] [-p \<port\>]

Out of the box, you can just run "apimocker" with no arguments.  
(Except on windows, you'll need to edit config.json first.  See below.)

Then you can visit "http://localhost:7878/first" in your browser to see it work.
The output and port options can also be set in the config.json file. 
Values from config.json will override values from command line.
After you get up and running, you should put your mock responses in a better location.
It's not a good idea to keep them under the "node_modules" directory.

### Windows note
After installing from npm, you'll need to edit this file:
        /Users/xxxxx/AppData/Roaming/npm/node_modules/apimocker/config.json
Change the "mockDirectory" to point to this location.  
(Or another location where you put the mock responses.)
        mockDirectory: /Users/xxxxx/AppData/Roaming/npm/node_modules/apimocker/samplemocks

### Help
        apimocker -h

## Configuration
On startup, config values are loaded from the config.json file.  
During runtime, mock services can be configured on the fly.
See the sample config.json file in this package.
mockDirectory value should be an absolute path.
```js
{
    "note": "This is a sample config file. You should change the mockDirectory to a more reasonable path.",
    "mockDirectory": "/usr/local/lib/node_modules/apimocker/samplemocks/",
    "output": true,
    "port": "7878", 
    "webServices": {
        "get": {
            "first": "king.json",
            "second": "king.json",
            "nested/ace": "ace.json",
            "var/:id": "queen.xml"
        },
        "post": {
            "king": "king.json"
        },
        "all": {
            "queen": "xml/queen.xml"
        }
    }
}
```
The most interesting part of the configuration file is the webServices section.
This contains the mock service URLs grouped by HTTP verb. 
In each section, there's a key/value pair for each mock service.  The key is the service URL (endpoint), the value is the mock response file name.
For instance, a request sent to "http://server:port/first" will return the king.json file from the samplemocks directory.
Response type will match the file extension.

## Runtime configuration
After starting the apimocker, mocks can be configured using a simple http api.

### /admin/setMock
This allows you to set different responses for a single service at any time by sending an http request.
Request can be a post containing a JSON object in the body:
```js
{
	"verb":"get",
	"serviceUrl":"third",
	"mockFile":"queen.xml"
}
```		
		
or a get with query string parameters:
localhost:7878/admin/setMock?verb=get&serviceUrl=second&mockFile=ace.json

### /admin/reload
If the config.json file is edited, you can send an http request to /admin/reload to pick up the changes.

## Acknowledgements
Big thanks to magalhas for his httpd-mock project.  This gave me a great starting point.
