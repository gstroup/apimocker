var express = require('express'),
		_ = require("underscore"),
		path = require("path"),
		fs = require("fs"),
		apiMocker = {};

apiMocker.defaults = {
			"port": "8888",
			"mockDirectory": "./mocks/",
			"allowedDomains": ["*"],
			"webServices": {}
		};

apiMocker.createServer = function(options) {
	options = options || {};
	apiMocker.express = express();
	apiMocker.express.use(express.bodyParser());
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
			var serviceKeys = _.keys(webServices[verb]);
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
	var topLevelKeys = _.keys(webServices);
	_.each(topLevelKeys, function(key) {
		var svc = _.clone(webServices[key]);
		// apiMocker.log("about to add a new service: " + JSON.stringify(svc));
		_.each(svc.verbs, function(v) {
			// apiMocker.log("adding a service");
			svc.verb = v.toLowerCase();
			svc.serviceUrl = key;
			if (typeof svc.latency === "undefined") {
				svc.latency = apiMocker.options.latency ? apiMocker.options.latency : 0;
			}
			apiMocker.setRoute(svc);
		});
	});
	// apiMocker.log(apiMocker.express.routes);
};

apiMocker.sendResponse = function(res, options) {
	apiMocker.log("Returning mock: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
			options.mockFile);

	if (options.contentType) {
		apiMocker.log("Content-Type: " + options.contentType);
		res.header('Content-Type', options.contentType);
		var mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile);
		fs.readFile(mockPath, {encoding: "utf8"}, function(err, data) {
			if (err) throw err;
			var buff = new Buffer(data, 'utf8');
			res.send(buff);
		});
	} else {
		res.sendfile(options.mockFile, {root: apiMocker.options.mockDirectory});
	}
};

// Sets the route for express, in case it was not set yet.
apiMocker.setRoute = function(options) {
	var latency = options.latency ? options.latency : 0;
	apiMocker.express[options.verb]("/" + options.serviceUrl, function(req, res) {
		// TODO: set latency from route.
		if (options.latency && options.latency > 0) {
			setTimeout(function() {
				apiMocker.sendResponse(res, options);
			}, options.latency);
		} else {
			apiMocker.sendResponse(res, options);
		}
	});
	apiMocker.log("Set route: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
			options.mockFile + " " + options.latency + " ms");
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
    res.header('Access-Control-Allow-Origin', apiMocker.options.allowedDomains);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
};

apiMocker.start = function (port) {
	apiMocker.createAdminServices();
	apiMocker.loadConfigFile();
	port = port || apiMocker.options.port;
	apiMocker.express.listen(port);
	apiMocker.log("Mock server listening on port " + port);
	return apiMocker;
};

// expose all the "public" methods.
exports.createServer = apiMocker.createServer;
exports.start = apiMocker.start;
exports.setConfigFile = apiMocker.setConfigFile;