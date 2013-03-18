var express = require('express'),
		_ = require("underscore"),
		path = require("path"),
		fs = require("fs"),
		apiMocker = {},
		defaults = {
			"port": "8888",
			"mockDirectory": "./mocks/",
			"output": false,
			"webServices": {
				"get": {},
				"post": {}
			}
		};

apiMocker.createServer = function(options) {
	apiMocker.express = express();
	apiMocker.express.use(express.bodyParser());
	apiMocker.options = {};
	apiMocker.defaults = defaults;
	apiMocker.log = function(msg) {
		if (apiMocker.options.output + "" === "true") {
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
	_.defaults(apiMocker.options, require(apiMocker.configFilePath), apiMocker.defaults);
	return apiMocker;
};

apiMocker.loadConfigFile = function() {
  if (apiMocker.configFilePath) {
      apiMocker.log("Loading config file: " + apiMocker.configFilePath);
      // Since the configFilePath can be set in different ways, 
      //	I may need to delete from cache in different ways.
      delete require.cache[apiMocker.configFilePath];
      delete require.cache[require.resolve(apiMocker.configFilePath)];
      _.extend(apiMocker.options, apiMocker.defaults, require(apiMocker.configFilePath));
      apiMocker.setRoutes(apiMocker.options.webServices);
  } else {
      apiMocker.log("No config file path set.");
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
		}
		apiMocker.removeRoute(newRoute);
		apiMocker.setRoute(newRoute);
		// also need to save in our webServices object.
		if (!apiMocker.options.webServices[newRoute.verb]) {
			apiMocker.options.webServices[newRoute.verb] = {};
		}
		delete apiMocker.options.webServices[newRoute.verb][newRoute.serviceUrl];
		apiMocker.options.webServices[newRoute.verb][newRoute.serviceUrl] = newRoute.mockFile;

		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(newRoute));
	});
};

apiMocker.setRoutes = function(webServices) {
	var verbs = _.keys(webServices);
	_.each(verbs, function(verb) {
		var serviceKeys = _.keys(webServices[verb]);
		_.each(serviceKeys, function(key) {
			apiMocker.setRoute({
				"serviceUrl": key,
				"mockFile": webServices[verb][key],
				"verb": verb,
				"latency": apiMocker.options.latency ? apiMocker.options.latency : 0
			});
		});
	});
	// apiMocker.log(apiMocker.express.routes);
};

apiMocker.getMockPath = function(options) {
	apiMocker.log("Returning mock: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " +
			apiMocker.options.webServices[options.verb][options.serviceUrl]);
	return apiMocker.options.webServices[options.verb][options.serviceUrl];
};

// Sets the route for express, in case it was not set yet.
apiMocker.setRoute = function(options) {
	var latency = options.latency ? options.latency : 0;
	apiMocker.express[options.verb]("/" + options.serviceUrl, function(req, res) {
		if (options.latency && options.latency > 0) {
			setTimeout(function() {
				res.sendfile(apiMocker.getMockPath(options), {root: apiMocker.options.mockDirectory});

				// res.type("text/xml");
				// apiMocker.log("sending text/xml");
				// var mockPath = path.join(apiMocker.options.mockDirectory, apiMocker.getMockPath(options));
				// fs.readFile(mockPath, {encoding: "utf8"}, function(err, data) {
				//	if (err) throw err;
				//	// apiMocker.log("xml data: " + data);
				//	var buff = new Buffer(data, 'utf8');
				//	res.send(buff);
				// });
			}, options.latency);
		} else {
			res.sendfile(apiMocker.getMockPath(options), {root: apiMocker.options.mockDirectory});
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

apiMocker.start = function (port) {
	port = port || apiMocker.options.port;
	apiMocker.createAdminServices();
	apiMocker.loadConfigFile();
	apiMocker.express.listen(port);

	apiMocker.log("Mock server listening on port " + port);
	return apiMocker;
};

// expose all the "public" methods.
exports.createServer = apiMocker.createServer;
exports.start = apiMocker.start;
exports.setConfigFile = apiMocker.setConfigFile;