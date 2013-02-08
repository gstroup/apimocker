var express = require('express'),
		_ = require("underscore"),
		apiMocker = {},
		defaults = {
			"port": "8888",
			"jsonMocksPath": "./mocks/",
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
	}
	apiMocker.configFilePath = file;
	_.defaults(apiMocker.options, require(file), apiMocker.defaults);
	return apiMocker;
};

apiMocker.loadConfigFile = function() {
  if (apiMocker.configFilePath) {
      apiMocker.log("Loading config file: " + apiMocker.configFilePath);
      delete require.cache[apiMocker.configFilePath];
      _.extend(apiMocker.options, apiMocker.defaults, require(apiMocker.configFilePath));
      apiMocker.setRoutes(apiMocker.options.webServices);
  } else {
      apiMocker.log("No config file path set.");
  }
};

apiMocker.createAdminServices = function() {
	apiMocker.express.all("/admin/reload", function(req, res) {
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
		}
		apiMocker.setRoute(newRoute);
		// also need to save in our webServices object.
		if (!apiMocker.options.webServices[newRoute.verb]) {
			apiMocker.options.webServices[newRoute.verb] = {};
		}
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
				"verb": verb
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
	apiMocker.log("Setting route: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " + options.mockFile);
	apiMocker.express[options.verb]("/" + options.serviceUrl, function(req, res) {
		// apiMocker.log("Returning mock: " + options.verb.toUpperCase() + " " + options.serviceUrl + " : " + options.mockFile);
		res.sendfile(apiMocker.getMockPath(options), {root: apiMocker.options.jsonMocksPath});
	});
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