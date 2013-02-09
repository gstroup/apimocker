# apimocker
This is a node.js module to run a simple http server, which can serve up mock service responses.
Responses can be JSON or XML to simulate REST or SOAP services.
Mock services are configured in the config.json file.
(There are lots of these projects out there, but I wrote this one to support all kinds of responses,
to allow on-the-fly configuration, and to run in node.)

## Installation
		sudo npm install -g apimocker
That will install globally, and allow for easier usage.

## Usage
apimocker [-c, --config \<path\>] [-O, --output] [-p \<port\>]
<br/><br/>
Out of the box, you can just run "apimocker" with no arguments.
Then you can visit "http://localhost:7878/first" in your browser to see it work.
The output and port options can also be set in the config.json file. 
Values from config.json will override values from command line.

## Configuration
On startup, config values are loaded from the config.json file.  
During runtime, mock services can be configured on the fly.
See the sample config.json file in this package.
jsonMocksPath value should be an absolute path.
```js
{
    "jsonMocksPath": "/usr/local/lib/node_modules/apimocker/samplemocks/",
    "output": true,
    "port": "7878", 
    "webServices": {
        "get": {
            "first": "king.json",
            "nested/ace": "ace.json",
            "var/:id": "queen.xml"
        },
        "post": {
            "king": "king.json"
        },
        "all": {
            "queen": "queen.xml"
        }
    }
}
```
The most interesting part of the configuration file is the webServices section.
This contains the mock service URLs grouped by HTTP verb.  
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
