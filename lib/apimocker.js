var express = require('express'),
		_ = require("underscore"),
		path = require("path"),
		fs = require("fs"),
		apiMocker = {};

apiMocker.defaults = {
	"port": "8888",
	"mockDirectory": "./mocks/",
	"allowedDomains": ["*"],
	"allowedHeaders": ["Content-Type"],
	"webServices": {}
};

apiMocker.createServer = function(options) {
	options = options || {};
	apiMocker.express = express();
	// apiMocker.express.use(express.bodyParser());
	// switched to use express.urlencoded and express.json, instead of bodyParser
	//  https://github.com/senchalabs/connect/wiki/Connect-3.0
	apiMocker.express.use(express.urlencoded());
	apiMocker.express.use(express.json());
	apiMocker.express.use(apiMocker.corsMiddleware);
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
    //	this makes testing easier, and avoids messing with require cache.
    var newOptions = _.clone(apiMocker.defaults),
				configJson = JSON.parse(fs.readFileSync(apiMocker.configFilePath));
    newOptions = _.extend(newOptions, apiMocker.options, configJson);
    apiMocker.options = newOptions;
    apiMocker.options.webServices = apiMocker.normalizeWebServicesConfig(apiMocker.options.webServices);
    apiMocker.setRoutes(apiMocker.options.webServices);
  } else {
    apiMocker.log("No config file path set.");
  }
};

apiMocker.normalizeWebServicesConfig = function(webServices) {
	var topLevelKeys = _.keys(webServices), newWebServices = {};
	if (webServices[topLevelKeys[0]] && webServices[topLevelKeys[0]].mockFile) {
		return webServices;
	} else {
		apiMocker.log("WARNING: apimocker config file format is deprecated.");
		_.each(topLevelKeys, function(verb) {
			var newSvc, serviceKeys = _.keys(webServices[verb]);
			_.each(serviceKeys, function(key) {
				if (newWebServices[key]) {
					newSvc = newWebServices[key];
					newSvc.verbs[newSvc.verbs.length] = verb;
				} else {
					newWebServices[key] = {
						"mockFile": webServices[verb][key],
						"verbs": [verb]
					};
				}
			});
		});
		return newWebServices;
	}
};

apiMocker.createAdminServices = function() {
	apiMocker.express.all("/admin/reload", function(req, res) {
    // need to wipe out all the old routes, or express will get confused.
		var verbs = _.keys(apiMocker.express.routes);
		_.each(verbs, function(verb) {
			apiMocker.express.routes[verb] = [];
		});
		apiMocker.createAdminServices();
		apiMocker.loadConfigFile();
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end('{"configFilePath": "' + apiMocker.configFilePath + '", "reloaded": "true"}');
	});

	apiMocker.express.all("/admin/setMock", function(req, res) {
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
		apiMocker.removeRoute(newRoute);
		apiMocker.setRoute(newRoute);
		// also need to save in our webServices object.
		delete apiMocker.options.webServices[newRoute.serviceUrl];
		apiMocker.options.webServices[newRoute.serviceUrl] = newRoute;

		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(newRoute));
	});
};

apiMocker.setRoutes = function(webServices) {
	var finalSvc,
			topLevelKeys = _.keys(webServices);
	_.each(topLevelKeys, function(key) {
		var svc = _.clone(webServices[key]);
		// apiMocker.log("about to add a new service: " + JSON.stringify(svc));
		_.each(svc.verbs, function(v) {
			finalSvc = _.clone(svc);
			finalSvc.verb = v.toLowerCase();
			finalSvc.serviceUrl = key;
			if (svc.responses) {
				finalSvc = _.extend(finalSvc, svc.responses[v]);
			}
			if (typeof svc.latency === "undefined") {
				finalSvc.latency = apiMocker.options.latency ? apiMocker.options.latency : 0;
			}
			delete finalSvc.responses;
			delete finalSvc.verbs;
			apiMocker.setRoute(finalSvc);
		});
	});
	// apiMocker.log(apiMocker.express.routes);
};

apiMocker.sendResponse = function(req, res, options) {
	var originalOptions, mockPath;
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
		apiMocker.setMockFile(options, req);
		mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile);
		if (!fs.existsSync(mockPath)) {
			apiMocker.log("No file found: " + options.mockFile + " attempting base file: " + originalOptions.mockFile);
			options = originalOptions;
		}
	}
	mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile);
	apiMocker.log("Returning mock: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
			options.mockFile);

	if (options.contentType) {
		res.header('Content-Type', options.contentType);
		fs.readFile(mockPath, {encoding: "utf8"}, function(err, data) {
			if (err) { throw err; }
			var buff = new Buffer(data, 'utf8');
			res.status(options.httpStatus).send(buff);
		});
	} else {
		res.status(options.httpStatus).sendfile(options.mockFile, {root: apiMocker.options.mockDirectory});
	}
};

apiMocker.setMockFile = function(options, req) {
	var switchValue = "",
			mockFileParts, mockFilePrefix = "", mockFileBaseName;
	if (req.body[options.switch]) { // json post request
		switchValue = req.body[options.switch];
	} else if (req.param(options.switch)) { // query param in get request
		switchValue = req.param(options.switch);
	} else {
		return;
	}
	mockFileParts = options.mockFile.split("/");
	mockFileBaseName = mockFileParts.pop();
	if (mockFileParts.length > 0) {
		mockFilePrefix = mockFileParts.join("/") + "/";
	}
	options.mockFile = mockFilePrefix + options.switch + switchValue + "." + mockFileBaseName;
};

// Sets the route for express, in case it was not set yet.
apiMocker.setRoute = function(options) {
	options.httpStatus = options.httpStatus || 200;
	apiMocker.express[options.verb]("/" + options.serviceUrl, function(req, res) {
		if (options.latency && options.latency > 0) {
			setTimeout(function() {
				apiMocker.sendResponse(req, res, options);
			}, options.latency);
		} else {
			apiMocker.sendResponse(req, res, options);
		}
	});
	apiMocker.log("Set route: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
			options.mockFile + " " + options.latency + " ms");
	if (options.switch) {
		apiMocker.log("   with switch on param: " + options.switch);
	}
};

apiMocker.removeRoute = function(options) {
	var verbs = [options.verb];
	if (options.verb === "all") {
		verbs = _.keys(apiMocker.express.routes);
	}
	_.each(verbs, function(verb) {
		var routesForVerb = apiMocker.express.routes[verb];
		routesForVerb = _.reject(routesForVerb, function(path) {
			return path.path === "/" + options.serviceUrl;
		});
		apiMocker.express.routes[verb] = routesForVerb;
	});
	// apiMocker.log(apiMocker.express.routes);
};

// CORS middleware
apiMocker.corsMiddleware = function(req, res, next) {
  var allowedHeaders = apimocker.options.allowedHeaders.reduce(function(a, b){return a + ',' + b;});

  res.header('Access-Control-Allow-Origin', apiMocker.options.allowedDomains);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', allowedHeaders);

  next();
};

apiMocker.start = function (port) {
	apiMocker.createAdminServices();
	apiMocker.loadConfigFile();
	port = port || apiMocker.options.port;
	apiMocker.expressInstance = apiMocker.express.listen(port);
	apiMocker.log("Mock server listening on port " + port);
	return apiMocker;
};

apiMocker.stop = function() {
	if (apiMocker.expressInstance) {
		apiMocker.log("Stopping mock server.");
		apiMocker.expressInstance.close();
	}
	return apiMocker;
};

// expose all the "public" methods.
exports.createServer = apiMocker.createServer;
exports.start = apiMocker.start;
exports.setConfigFile = apiMocker.setConfigFile;
exports.stop = apiMocker.stop;