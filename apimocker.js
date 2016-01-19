var express = require('express'),
    _ = require("underscore"),
    path = require("path"),
    fs = require("fs"),
    bodyParser = require("body-parser"),
    xmlparser = require('express-xml-bodyparser'),
    apiMocker = {},
    jsonPath = require('JSONPath'),
    untildify = require('untildify'),
    util = require('util'),
    proxy = require('express-http-proxy');

apiMocker.defaults = {
  "port": "8888",
  "mockDirectory": "./mocks/",
  "allowedDomains": ["*"],
  "allowedHeaders": ["Content-Type"],
  "logRequestHeaders": false,
  "webServices": {}
};

apiMocker.createServer = function(options) {
  options = options || {};
  apiMocker.express = express();
  apiMocker.middlewares = [];
  apiMocker.middlewares.push(bodyParser.urlencoded({extended: true}));
  apiMocker.middlewares.push(bodyParser.json());
  apiMocker.middlewares.push(xmlparser());
  apiMocker.middlewares.push(apiMocker.corsMiddleware);

  // new in Express 4, we use a Router now.
  apiMocker.router = express.Router();
  apiMocker.middlewares.push(apiMocker.router);

  if (options.proxyURL) {
      apiMocker.middlewares.push(proxy(options.proxyURL, {
      forwardPath: function (req) {
        apiMocker.log("Forwarding request: " + req.originalUrl);
        return req.originalUrl;
      }
    }));
  }

  apiMocker.options = _.defaults(options, apiMocker.defaults);

  apiMocker.log = function(msg) {
    if (!apiMocker.options.quiet) {
      console.log(msg);
    }
  };
  return apiMocker;
};

apiMocker.setConfigFile = function (file) {
  if (!file) {
    return apiMocker;
  } else if (path.sep !== file.substr(0,1)) {
    //relative path from command line
    apiMocker.configFilePath = path.resolve(process.cwd(), file);
  } else {
    apiMocker.configFilePath = file;
  }
  return apiMocker;
};

apiMocker.loadConfigFile = function() {
  if (apiMocker.configFilePath) {
    apiMocker.log("Loading config file: " + apiMocker.configFilePath);
    // Switched to use fs.readFileSync instead of "require"
    //  this makes testing easier, and avoids messing with require cache.
    var newOptions = _.clone(apiMocker.defaults),
        configJson = JSON.parse(fs.readFileSync(apiMocker.configFilePath));
    if (process.env.VCAP_APP_PORT) {
      // we're running in cloudfoundry, and we need to use the VCAP port.
      configJson.port = process.env.VCAP_APP_PORT;
    }
    newOptions = _.extend(newOptions, apiMocker.options, configJson);
    newOptions.mockDirectory = untildify(newOptions.mockDirectory);
    apiMocker.options = newOptions;

    _.each(apiMocker.options.webServices, function (svc) {
      _.each(svc.alternatePaths, function (path) {
        var altSvc = _.clone(svc);
        apiMocker.options.webServices[path] = altSvc;
      });
    });

    apiMocker.setRoutes(apiMocker.options.webServices);
  } else {
    apiMocker.log("No config file path set.");
  }
};

apiMocker.createAdminServices = function() {
  apiMocker.router.all("/admin/reload", function(req, res) {
    apiMocker.stop();
    apiMocker.createServer(apiMocker.options).start();

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end('{"configFilePath": "' + apiMocker.configFilePath + '", "reloaded": "true"}');
  });

  apiMocker.router.all("/admin/setMock", function(req, res) {
    var newRoute = {};
    if (req.body.serviceUrl && req.body.verb && req.body.mockFile) {
      apiMocker.log("Received JSON request: " + JSON.stringify(req.body));
      newRoute = req.body;
      newRoute.verb = newRoute.verb.toLowerCase();
    } else {
      newRoute.verb = req.param('verb').toLowerCase();
      newRoute.serviceUrl = req.param('serviceUrl');
      newRoute.mockFile = req.param('mockFile');
      newRoute.latency = req.param('latency');
      newRoute.contentType = req.param('contentType');
    }
    // also need to save in our webServices object.
    delete apiMocker.options.webServices[newRoute.serviceUrl];
    apiMocker.options.webServices[newRoute.serviceUrl] = newRoute;
    apiMocker.setRoute(newRoute);

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify(newRoute));
  });
};

apiMocker.setRoutes = function(webServices) {
  var topLevelKeys = _.keys(webServices);
  _.each(topLevelKeys, function(key) {
    var svc = _.clone(webServices[key]);
    // apiMocker.log("about to add a new service: " + JSON.stringify(svc));
    _.each(svc.verbs, function(v) {
      apiMocker.setRoute(apiMocker.getServiceRoute(key, v));
    });
  });
};

apiMocker.getServiceRoute = function(path, verb) {

  var finalSvc = _.clone(apiMocker.options.webServices[path]);
  finalSvc.verb = verb.toLowerCase();
  finalSvc.serviceUrl = path;
  if (finalSvc.responses) {
    finalSvc = _.extend(finalSvc, finalSvc.responses[verb]);
  }
  if (typeof finalSvc.latency === "undefined") {
    finalSvc.latency = apiMocker.options.latency ? apiMocker.options.latency : 0;
  }
  finalSvc.httpStatus = finalSvc.httpStatus || 200;

  delete finalSvc.responses;
  delete finalSvc.verbs;
  return finalSvc;
};

// Fills in templated Values. 
apiMocker.fillTemplate = function(data, req){

	for(var templateString in req.params){
		data = data.replace("@"+templateString, req.param(templateString)); 
	}; 

	return data; 
}; 

apiMocker.sendResponse = function(req, res, serviceKeys) {
  var originalOptions, mockPath;
  // we want to look up the service info from our in-memory "webServices" every time.
  var options = apiMocker.getServiceRoute(serviceKeys.serviceUrl, serviceKeys.verb);

  setTimeout(function() {

    if (options.httpStatus === 204 || options.httpStatus === 304) {
      // express handles these two differently - it strips out body, content-type, and content-length headers.
      // there's no body or content-length, so we just send the status code.
      apiMocker.log("Returning http status: " + options.httpStatus);
      res.send(options.httpStatus);
      return;
    }
    if (options.switch) {
      options = _.clone(options);
      originalOptions = _.clone(options);
      apiMocker.setSwitchOptions(options, req);
      mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile || "");
      if (!fs.existsSync(mockPath)) {
        apiMocker.log("No file found: " + options.mockFile + " attempting base file: " + originalOptions.mockFile);
        options.mockFile = originalOptions.mockFile;
      }
    }

    if (!options.mockFile) {
      apiMocker.log("ERROR: No mockFile was configured for route: " + options.serviceUrl);
      res.status(500).send({ apimockerError: 'No mockFile was configured for route.  Check apimocker config.json file.', route: options.serviceUrl });
      return;
    }

    mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile);
    apiMocker.log("Returning mock: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
        options.mockFile);

    if(apiMocker.options.logRequestHeaders) {
      apiMocker.log("Request headers:");
      apiMocker.log(req.headers);
    }

    if (options.headers) {
        res.header(options.headers);
    }

    if (options.contentType) {
      res.header('Content-Type', options.contentType);
      fs.readFile(mockPath, {encoding: "utf8"}, function(err, data) {
        if (err) { throw err; }

	data = apiMocker.fillTemplate(data, req); 
	
        var buff = new Buffer(data, 'utf8');
	
        res.status(options.httpStatus).send(buff);
      });
    } else {
      res.status(options.httpStatus).sendfile(encodeURIComponent(options.mockFile), {root: apiMocker.options.mockDirectory});
    }

  }, options.latency);
};

// only used when there is a switch configured
apiMocker.setSwitchOptions = function(options, req) {
  var switchFilePrefix = "", switchParamValue,
      mockFileParts, mockFilePrefix = "", mockFileBaseName;

  var switches = options.switch;
  if(!(switches instanceof Array)){
    switches = [switches];
  }

  switches.forEach(function(s){
    switchParamValue = null;
    var switchObject = s,
        specific = true;

    if (!(s instanceof Object)) {
      // The user didn't configure a switch object. Make one.
      switchObject = {
        key: s,
        switch: s,
        type: "default"
      };

      if (s.match(/\/(.+)\//)) {
        switchObject.type = "regexp";
      } else if (s.indexOf("$") === 0) {
        switchObject.type = "jsonpath";
      }

      // As we had no switch object, we have to test default-type first to
      // mimic the old behaviour.
      specific = false;
    }

    if (!switchObject.hasOwnProperty("key")) {
      // Add key if the user was too lazy
      switchObject.key = switchObject.switch;
    }

    // Sanity check the switchobject
    if (
      !switchObject.hasOwnProperty("switch") ||
      !switchObject.hasOwnProperty("type") ||
      !switchObject.hasOwnProperty("key")
    ) {
      return;
    }

    if (!specific || switchObject.type === "default") {

      if (req.body[switchObject.switch]) { // json post request
        switchParamValue = encodeURIComponent( req.body[switchObject.switch] );
      } else if (req.param(switchObject.switch)) { // query param in get request
        switchParamValue = encodeURIComponent( req.param(switchObject.switch));
      } else if (req.headers) { // check for switch in header param
        for (var h in req.headers) {
          if (req.headers.hasOwnProperty(h) && h.toLowerCase() === switchObject.switch.toLowerCase()) {
            switchParamValue = encodeURIComponent(req.headers[h]);
            break;
          }
        }
      }

    }

    if (!switchParamValue) {

      if (switchObject.type === "regexp") {
        var regexpTest = switchObject.switch.match(/\/(.+)\//);
        if (regexpTest) { // A regexp switch
          var searchBody = req.body;

          if (typeof(req.body) !== "string") {
            // We don't have a body string, parse it in JSON
            searchBody = JSON.stringify(req.body);
          }

          var regexpSwitch = new RegExp(regexpTest[1]).exec(searchBody);
          if (regexpSwitch) {
            // Value is the first group
            switchParamValue = encodeURIComponent(regexpSwitch[1]);
          }
        }
      } else {
        //use JsonPath - use first value found if multiple occurances exist
        var allElems = jsonPath.eval(req.body, switchObject.switch);  // jshint ignore:line
        if (allElems.length > 0) {
          switchParamValue = encodeURIComponent(allElems[0]);
        }
      }
    }

    if (switchParamValue) {
      switchFilePrefix = switchFilePrefix + switchObject.key + switchParamValue;
    }
  });

  if(!switchFilePrefix){
    return;
  }

  if (options.switchResponses && options.switchResponses[switchFilePrefix]) {
    _.extend(options, options.switchResponses[switchFilePrefix]);
    if (options.switchResponses[switchFilePrefix].mockFile) {
      return;
    }
  }

  mockFileParts = options.mockFile.split("/");
  mockFileBaseName = mockFileParts.pop();
  if (mockFileParts.length > 0) {
    mockFilePrefix = mockFileParts.join("/") + "/";
  }
  options.mockFile = mockFilePrefix + switchFilePrefix + "." + mockFileBaseName;
};

// Sets the route for express, in case it was not set yet.
apiMocker.setRoute = function(options) {
  var displayFile = options.mockFile || "<no mockFile>",
      displayLatency = options.latency ? options.latency + " ms" : "";
  options.httpStatus = options.httpStatus || 200;
  apiMocker.router[options.verb]("/" + options.serviceUrl, function(req, res) {

    apiMocker.sendResponse(req, res, options);
  });
  apiMocker.log("Set route: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
      displayFile + " " + displayLatency);
  if (options.switch) {
    var switchDescription = options.switch;
    if (options.switch instanceof Array || options.switch instanceof Object) {
      switchDescription = util.inspect(options.switch);
    }
    apiMocker.log("   with switch on param: " + switchDescription);
  }
};

// CORS middleware
apiMocker.corsMiddleware = function(req, res, next) {
  var allowedHeaders = apiMocker.options.allowedHeaders.join(',');
  res.header('Access-Control-Allow-Origin', apiMocker.options.allowedDomains);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', allowedHeaders);

  next();
};

apiMocker.start = function (port, callback) {
  apiMocker.createAdminServices();
  apiMocker.loadConfigFile();
  apiMocker.middlewares.forEach(function(mw) {
      apiMocker.express.use(mw);
  });
  port = port || apiMocker.options.port;
  // console.log(JSON.stringify(apiMocker.options));
  if (apiMocker.options.staticDirectory && apiMocker.options.staticPath) {
    apiMocker.express.use(apiMocker.options.staticPath, express.static(apiMocker.options.staticDirectory));
  }

  apiMocker.expressInstance = apiMocker.express.listen(port, callback);
  apiMocker.log("Mock server listening on port " + port);
  return apiMocker;
};

apiMocker.stop = function(callback) {
  if (apiMocker.expressInstance) {
    apiMocker.log("Stopping mock server.");
    apiMocker.expressInstance.close(callback);
  }
  return apiMocker;
};

// expose all the "public" methods.
exports.createServer = apiMocker.createServer;
exports.start = apiMocker.start;
exports.setConfigFile = apiMocker.setConfigFile;
exports.stop = apiMocker.stop;
exports.middlewares = apiMocker.middlewares;
