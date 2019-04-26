/* eslint-disable no-prototype-builtins, comma-dangle */
const express = require('express');
const _ = require('underscore');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const xmlparser = require('express-xml-bodyparser');
const jp = require('jsonpath');
const untildify = require('untildify');
const util = require('util');
const proxy = require('express-http-proxy');
const multer = require('multer');
const crypto = require('crypto');
const { createLogger, createMiddleware } = require('./logger');

const apiMocker = {};

apiMocker.defaults = {
  port: '8888',
  mockDirectory: './mocks/',
  allowedDomains: ['*'],
  allowedHeaders: ['Content-Type'],
  logRequestHeaders: false,
  allowAvoidPreFlight: false,
  useUploadFieldname: false,
  webServices: {}
};

apiMocker.createServer = (options = {}) => {
  apiMocker.options = Object.assign({}, apiMocker.defaults, options);

  const { quiet } = apiMocker.options;
  const logger = createLogger({ quiet });
  const loggerMiddleware = createMiddleware({ quiet });

  apiMocker.express = express();
  apiMocker.middlewares = [];

  apiMocker.middlewares.push(loggerMiddleware);
  if (options.uploadRoot) {
    apiMocker.middlewares.push(
      multer({
        storage: multer.diskStorage({
          destination: untildify(options.uploadRoot),
          filename: options.useUploadFieldname
            ? (req, filename, cb) => {
              cb(null, filename.fieldname);
            }
            : (req, filename, cb) => {
              cb(null, filename.originalname);
            }
        })
      }).any()
    );
  }

  let saveBody;
  if (options.proxyURL || options.allowAvoidPreFlight) {
    saveBody = (req, res, buf) => {
      req.rawBody = buf;
    };
  }
  apiMocker.middlewares.push(
    bodyParser.urlencoded({
      extended: true,
      verify: saveBody
    })
  );

  if (options.allowAvoidPreFlight) {
    apiMocker.middlewares.push(
      bodyParser.json({
        strict: false,
        verify: saveBody,
        type: '*/*'
      })
    );
  } else {
    apiMocker.middlewares.push(
      bodyParser.json({
        verify: saveBody
      })
    );
  }

  apiMocker.middlewares.push(xmlparser());
  apiMocker.middlewares.push(apiMocker.corsMiddleware);

  // new in Express 4, we use a Router now.
  apiMocker.router = express.Router();
  apiMocker.middlewares.push(apiMocker.router);

  if (options.proxyURL) {
    logger.info(`Proxying to ${options.proxyURL}`);
    const proxyOptions = {
      proxyReqPathResolver(req) {
        logger.info(`Forwarding request: ${req.originalUrl}`);
        return req.originalUrl;
      }
    };

    if (options.proxyIntercept) {
      const interceptPath = path.join(process.cwd(), options.proxyIntercept);
      logger.info(`Loading proxy intercept from ${interceptPath}`);
      // eslint-disable-next-line global-require, import/no-dynamic-require
      proxyOptions.intercept = require(interceptPath);
    }

    apiMocker.middlewares.push((req, res, next) => {
      if (req.rawBody) {
        req.body = req.rawBody;
      }
      next();
    });
    apiMocker.middlewares.push(proxy(options.proxyURL, proxyOptions));
  }

  apiMocker.logger = logger;
  return apiMocker;
};

apiMocker.setConfigFile = (file) => {
  if (!file) {
    return apiMocker;
  }
  if (!file.startsWith(path.sep)) {
    // relative path from command line
    apiMocker.configFilePath = path.resolve(process.cwd(), file);
  } else {
    apiMocker.configFilePath = file;
  }
  return apiMocker;
};

apiMocker.loadConfigFile = () => {
  if (!apiMocker.configFilePath) {
    apiMocker.logger.warn('No config file path set.');
    return;
  }

  apiMocker.logger.info(`Loading config file: ${apiMocker.configFilePath}`);
  let newOptions = _.clone(apiMocker.defaults);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const exportedValue = require(apiMocker.configFilePath);
  const config = typeof exportedValue === 'function' ? exportedValue() : exportedValue;
  if (process.env.VCAP_APP_PORT) {
    // we're running in cloudfoundry, and we need to use the VCAP port.
    config.port = process.env.VCAP_APP_PORT;
  }
  newOptions = _.extend(newOptions, apiMocker.options, config);
  newOptions.mockDirectory = untildify(newOptions.mockDirectory);
  if (newOptions.mockDirectory === '/file/system/path/to/apimocker/samplemocks/') {
    newOptions.mockDirectory = path.join(__dirname, '/../samplemocks');
    apiMocker.logger.info('Set mockDirectory to: ', newOptions.mockDirectory);
  }
  apiMocker.options = newOptions;

  _.each(apiMocker.options.webServices, (svc) => {
    _.each(svc.alternatePaths, (altPath) => {
      const altSvc = _.clone(svc);
      apiMocker.options.webServices[altPath] = altSvc;
    });
  });
  apiMocker.setRoutes(apiMocker.options.webServices);
};

apiMocker.createAdminServices = () => {
  apiMocker.router.all('/admin/reload', (req, res) => {
    apiMocker.stop();
    apiMocker.createServer(apiMocker.options).start();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(`{"configFilePath": "${apiMocker.configFilePath}", "reloaded": "true"}`);
  });

  apiMocker.router.all('/admin/setMock', (req, res) => {
    let newRoute = {};
    if (req.body.serviceUrl && req.body.verb && req.body.mockFile) {
      apiMocker.logger.info(`Received JSON request: ${JSON.stringify(req.body)}`);
      newRoute = req.body;
      newRoute.verb = newRoute.verb.toLowerCase();
      newRoute.httpStatus = req.body.httpStatus;
    } else {
      newRoute.verb = req.param('verb').toLowerCase();
      newRoute.serviceUrl = req.param('serviceUrl');
      newRoute.mockFile = req.param('mockFile');
      newRoute.latency = req.param('latency');
      newRoute.contentType = req.param('contentType');
      newRoute.httpStatus = req.param('httpStatus');
    }
    // also need to save in our webServices object.
    delete apiMocker.options.webServices[newRoute.serviceUrl];
    apiMocker.options.webServices[newRoute.serviceUrl] = newRoute;
    apiMocker.setRoute(newRoute);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(newRoute));
  });
};

apiMocker.setRoutes = (webServices) => {
  const topLevelKeys = _.keys(webServices);
  _.each(topLevelKeys, (key) => {
    const svc = _.clone(webServices[key]);
    // apiMocker.logger.info('about to add a new service: ' + JSON.stringify(svc));
    _.each(svc.verbs, (v) => {
      apiMocker.setRoute(apiMocker.getServiceRoute(key, v));
    });
  });
};

apiMocker.getServiceRoute = (routePath, verb) => {
  let finalSvc = _.clone(apiMocker.options.webServices[routePath]);
  finalSvc.verb = verb.toLowerCase();
  finalSvc.serviceUrl = routePath;
  if (finalSvc.responses) {
    finalSvc = _.extend(finalSvc, finalSvc.responses[verb]);
  }
  if (typeof finalSvc.latency === 'undefined') {
    finalSvc.latency = apiMocker.options.latency ? apiMocker.options.latency : 0;
  }

  delete finalSvc.responses;
  delete finalSvc.verbs;
  return finalSvc;
};

// Fills in templated Values.
apiMocker.fillTemplate = (data, req) => {
  let filled = data.toString();
  Object.keys(req.params).forEach((key) => {
    // Handle unquoted numbers first
    // Search for '"@@key"' in JSON template,
    // replace with value (no double quotes around final value)
    filled = filled.replace(new RegExp(`"@@${key}"`, 'g'), req.params[key]);
    // Handle quoted values second
    // Search for '@key' in JSON template, replace with value
    filled = filled.replace(new RegExp(`@${key}`, 'g'), req.params[key]);
  });

  return filled;
};

apiMocker.fillTemplateSwitch = (options, data) => {
  const switches = options.templateSwitch;
  let filled = data.toString();

  switches.forEach((s) => {
    let key;
    let value;

    if (!(s instanceof Object)) {
      ({ key, value } = switches[s]);
    } else {
      ({ key, value } = s);
    }

    if (value !== null) {
      // Handle unquoted numbers first
      // Search for '"@@key"' in JSON template,
      // replace with value (no double quotes around final value)
      apiMocker.logger.info(`fillTemplateSwitch -> search for "@@${key}" replace with ${value}`);
      filled = filled.replace(new RegExp(`"@@${key}"`, 'g'), value);

      // Handle quoted values second
      // Search for '@key' in JSON template, replace with value
      apiMocker.logger.info(`fillTemplateSwitch -> search for @${key} replace with ${value}`);
      filled = filled.replace(new RegExp(`@${key}`, 'g'), value);
    } else {
      apiMocker.logger.info(`fillTemplateSwitch -> skipping search for @${key} with no value.`);
    }
  });

  return filled;
};

apiMocker.processTemplateData = (data, options, req, res) => {
  let templatedData;
  if (options.templateSwitch) {
    templatedData = apiMocker.fillTemplateSwitch(options, data, req);
  }

  if (options.enableTemplate === true) {
    templatedData = apiMocker.fillTemplate(data, req);
  }

  const buff = Buffer.from(templatedData || data, 'utf8');

  res.status(options.httpStatus || 200).send(buff);
};

apiMocker.sendResponse = (req, res, serviceKeys) => {
  let originalOptions;
  let mockPath;
  // we want to look up the service info from our in-memory 'webServices' every time.
  let options = apiMocker.getServiceRoute(serviceKeys.serviceUrl, serviceKeys.verb);

  setTimeout(() => {
    if (options.httpStatus === 204 || options.httpStatus === 304) {
      // express handles these two differently - it strips out body, content-type,
      // and content-length headers.
      // There's no body or content-length, so we just send the status code.
      res.sendStatus(options.httpStatus);
      return;
    }

    // Filter whether the raw body is what we're expecting, if such filter is provided.
    if (!!options.bodies && !!options.bodies[req.method.toLowerCase()]) {
      if (
        // eslint-disable-next-line max-len
        !_.find(options.bodies[req.method.toLowerCase()], filterDef => apiMocker.compareHashed(filterDef, req.rawBody || JSON.stringify(req.body)))
      ) {
        res.status(404).send();
        return;
      }
    }

    if (options.switch && !options.jsonPathSwitchResponse) {
      options = _.clone(options);
      originalOptions = _.clone(options);
      apiMocker.setSwitchOptions(options, req);
      mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile || '');
      if (!fs.existsSync(mockPath)) {
        apiMocker.logger.warn(
          `No file found: ${options.mockFile} attempting base file: ${originalOptions.mockFile}`
        );
        options.mockFile = originalOptions.mockFile;
      }
    }

    if (options.templateSwitch) {
      apiMocker.setTemplateSwitchOptions(options, req);
    }

    if (apiMocker.options.logRequestHeaders || options.logRequestHeaders) {
      apiMocker.logger.info('Request headers:');
      apiMocker.logger.info(req.headers);
    }

    if (options.headers) {
      res.set(options.headers);
    }

    if (options.mockBody) {
      if (options.contentType) {
        res.set('Content-Type', options.contentType);
      }
      apiMocker.processTemplateData(options.mockBody, options, req, res);
      return;
    }

    if (!options.mockFile) {
      const status = options.httpStatus || 404;
      res.status(status).send();
      return;
    }

    // Add mockFile name for logging
    res.locals.mockFile = options.mockFile;

    if (options.switch && options.jsonPathSwitchResponse) {
      let jpath = options.jsonPathSwitchResponse.jsonpath;
      const fpath = path.join(
        apiMocker.options.mockDirectory,
        options.jsonPathSwitchResponse.mockFile
      );
      const forceFirstObject = options.jsonPathSwitchResponse.forceFirstObject || false;
      _.each(_.keys(req.params), (key) => {
        const param = '#key#'.replace('key', key);
        jpath = jpath.replace(param, req.params[key]);
      });
      try {
        const mockFile = fs.readFileSync(fpath, { encoding: 'utf8' });
        const allElems = jp.query(JSON.parse(mockFile), jpath);
        res.status(options.httpStatus || 200).send(forceFirstObject ? allElems[0] : allElems);
      } catch (err) {
        apiMocker.logger.error(err);
        res.sendStatus(options.httpStatus || 404);
      }
      return;
    }

    mockPath = path.join(apiMocker.options.mockDirectory, options.mockFile);

    fs.exists(mockPath, (exists) => {
      if (exists) {
        if (options.contentType) {
          res.set('Content-Type', options.contentType);
          fs.readFile(mockPath, { encoding: 'utf8' }, (err, data) => {
            if (err) {
              throw err;
            }
            apiMocker.processTemplateData(data.toString(), options, req, res);
          });
        } else {
          res
            .status(options.httpStatus || 200)
            .sendFile(options.mockFile, { root: apiMocker.options.mockDirectory });
        }
      } else {
        res.sendStatus(options.httpStatus || 404);
      }
    });
  }, options.latency);
};

// Utility function to get a key's value from json body, route param, querystring, or header.
const getRequestParam = (req, key) => {
  const rawParamValue = req.body[key] || req.params[key] || req.query[key] || req.header(key);
  return rawParamValue;
};

// only used when there is a switch configured
apiMocker.setSwitchOptions = (options, req) => {
  let switchFilePrefix = '';
  let switchParamValue;
  let mockFileParts;
  let mockFilePrefix = '';
  let mockFileBaseName;

  let switches = options.switch;
  if (!(switches instanceof Array)) {
    switches = [switches];
  }

  switches.forEach((s) => {
    switchParamValue = null;
    let switchObject = s;

    let specific = true;

    if (!(s instanceof Object)) {
      // The user didn't configure a switch object. Make one.
      switchObject = {
        key: s,
        switch: s,
        type: 'default'
      };

      if (s.match(/\/(.+)\//)) {
        switchObject.type = 'regexp';
      } else if (s.indexOf('$') === 0) {
        switchObject.type = 'jsonpath';
      }

      // As we had no switch object, we have to test default-type first to
      // mimic the old behaviour.
      specific = false;
    }

    if (!switchObject.hasOwnProperty('key')) {
      // Add key if the user was too lazy
      switchObject.key = switchObject.switch;
    }

    // Sanity check the switchobject
    if (
      !switchObject.hasOwnProperty('switch')
      || !switchObject.hasOwnProperty('type')
      || !switchObject.hasOwnProperty('key')
    ) {
      return;
    }

    if (!specific || switchObject.type === 'default') {
      const rawParamValue = getRequestParam(req, switchObject.switch);
      if (rawParamValue) {
        switchParamValue = encodeURIComponent(rawParamValue);
      }
    }

    if (!switchParamValue) {
      if (switchObject.type === 'regexp') {
        const regexpTest = switchObject.switch.match(/\/(.+)\//);
        if (regexpTest) {
          // A regexp switch
          let searchBody = req.body;

          if (typeof req.body !== 'string') {
            // We don't have a body string, parse it in JSON
            searchBody = JSON.stringify(req.body);
          }

          const regexpSwitch = new RegExp(regexpTest[1]).exec(searchBody);
          if (regexpSwitch) {
            // Value is the first group
            switchParamValue = encodeURIComponent(regexpSwitch[1]);
          }
        }
      } else {
        // use JsonPath - use first value found if multiple occurances exist
        const allElems = jp.query(req.body, switchObject.switch);
        if (allElems.length > 0) {
          switchParamValue = encodeURIComponent(allElems[0]);
        }
      }
    }

    if (switchParamValue) {
      switchFilePrefix = switchFilePrefix + switchObject.key + switchParamValue;
    }
  });

  if (!switchFilePrefix) {
    return;
  }

  if (options.switchResponses && options.switchResponses[switchFilePrefix]) {
    _.extend(options, options.switchResponses[switchFilePrefix]);
    if (options.switchResponses[switchFilePrefix].mockFile) {
      return;
    }
  }

  if (options.mockFile) {
    mockFileParts = options.mockFile.split('/');
    mockFileBaseName = mockFileParts.pop();
    if (mockFileParts.length > 0) {
      mockFilePrefix = `${mockFileParts.join('/')}/`;
    }
    // eslint-disable-next-line no-param-reassign
    options.mockFile = `${mockFilePrefix + switchFilePrefix}.${mockFileBaseName}`;
  }
};

// only used when there is a templateSwitch configured
apiMocker.setTemplateSwitchOptions = (options, req) => {
  let switchParamValue;
  let switches = options.templateSwitch;

  if (!(switches instanceof Array)) {
    switches = [switches];
  }

  switches.forEach((s) => {
    switchParamValue = null;
    let switchObject = s;

    let specific = true;

    if (!(s instanceof Object)) {
      // The user didn't configure a switch object. Make one.
      switchObject = {
        key: s,
        switch: s,
        type: 'default',
        value: null
      };

      if (s.match(/\/(.+)\//)) {
        switchObject.type = 'regexp';
      } else if (s.indexOf('$') === 0) {
        switchObject.type = 'jsonpath';
      }

      // As we had no switch object, we have to test default-type first to
      // mimic the old behaviour.
      specific = false;
    }

    if (!switchObject.hasOwnProperty('key')) {
      // Add key if the user was too lazy
      switchObject.key = switchObject.switch;
    }

    // Sanity check the switchobject
    if (
      !switchObject.hasOwnProperty('switch')
      || !switchObject.hasOwnProperty('type')
      || !switchObject.hasOwnProperty('key')
    ) {
      apiMocker.logger.info(
        'templateSwitch invalid config: missing switch, type or key property. Aborting templateSwitch for this request.'
      );
      return;
    }

    if (!specific || switchObject.type === 'default') {
      const rawParamValue = getRequestParam(req, switchObject.switch);
      if (rawParamValue) {
        switchParamValue = encodeURIComponent(rawParamValue);
      }
    }

    if (!switchParamValue) {
      if (switchObject.type === 'regexp') {
        const regexpTest = switchObject.switch.match(/\/(.+)\//);
        if (regexpTest) {
          // A regexp switch
          let searchBody = req.body;

          if (typeof req.body !== 'string') {
            // We don't have a body string, parse it in JSON
            searchBody = JSON.stringify(req.body);
          }

          const regexpSwitch = new RegExp(regexpTest[1]).exec(searchBody);
          if (regexpSwitch) {
            // Value is the first group
            switchParamValue = encodeURIComponent(regexpSwitch[1]);
          }
        }
      } else {
        // use JsonPath - use first value found if multiple occurances exist
        const allElems = jp.query(req.body, switchObject.switch);
        if (allElems.length > 0) {
          switchParamValue = encodeURIComponent(allElems[0]);
        }
      }
    }

    if (switchParamValue) {
      switchObject.value = switchParamValue;
      // eslint-disable-next-line no-param-reassign
      options.templateSwitch[s] = switchObject;
    } else {
      apiMocker.logger.warn(`templateSwitch[${switchObject.switch}] value NOT FOUND`);
    }
  });
};

// Sets the route for express, in case it was not set yet.
apiMocker.setRoute = (options) => {
  const displayFile = options.mockFile || '<no mockFile>';
  const displayLatency = options.latency ? `${options.latency} ms` : '';

  apiMocker.router[options.verb](`/${options.serviceUrl}`, (req, res) => {
    apiMocker.sendResponse(req, res, options);
  });
  apiMocker.logger.info(
    `Set route: ${options.verb.toUpperCase()} ${
      options.serviceUrl
    } : ${displayFile} ${displayLatency}`
  );
  if (options.switch) {
    let switchDescription = options.switch;
    if (options.switch instanceof Array || options.switch instanceof Object) {
      switchDescription = util.inspect(options.switch);
    }
    apiMocker.logger.info(` with switch on param: ${switchDescription}`);
  }
};

// CORS middleware
apiMocker.corsMiddleware = (req, res, next) => {
  const allowedHeaders = apiMocker.options.allowedHeaders.join(',');
  const credentials = apiMocker.options.corsCredentials || '';
  res.set('Access-Control-Allow-Origin', apiMocker.options.allowedDomains);
  res.set('Access-Control-Allow-Methods', 'GET,PUT,POST,PATCH,DELETE');
  res.set('Access-Control-Allow-Headers', allowedHeaders);
  res.set('Access-Control-Allow-Credentials', credentials);

  next();
};

apiMocker.compareHashed = (filterDef, body) => {
  if (!(filterDef instanceof Object)) {
    // eslint-disable-next-line eqeqeq
    return filterDef == body;
  }
  const algo = _.keys(filterDef)[0];
  const hasher = crypto.createHash(algo);
  hasher.update(body);
  const digest = hasher.digest('hex');
  apiMocker.logger.warn(`Body hash ${algo}: ${digest}`);
  // eslint-disable-next-line eqeqeq
  return digest.toLowerCase() == filterDef[algo].toLowerCase();
};

apiMocker.start = (serverPort, callback) => {
  apiMocker.createAdminServices();
  apiMocker.loadConfigFile();

  apiMocker.middlewares.forEach((mw) => {
    if (mw === apiMocker.router && apiMocker.options.basepath) {
      apiMocker.logger.info('Using basepath: ', apiMocker.options.basepath);
      apiMocker.express.use(apiMocker.options.basepath, mw);
    } else {
      apiMocker.express.use(mw);
    }
  });

  const port = serverPort || apiMocker.options.port;
  if (apiMocker.options.staticDirectory && apiMocker.options.staticPath) {
    apiMocker.express.use(
      apiMocker.options.staticPath,
      express.static(apiMocker.options.staticDirectory)
    );
  }

  apiMocker.expressInstance = apiMocker.express.listen(port, callback);
  apiMocker.logger.info(`Mock server listening on port ${port}`);
  return apiMocker;
};

apiMocker.stop = (callback) => {
  // Invalidate cached config between uses to allow it to be reconstructed.
  delete require.cache[require.resolve(apiMocker.configFilePath)];

  if (apiMocker.expressInstance) {
    apiMocker.logger.info('Stopping mock server.');
    apiMocker.expressInstance.close(callback);
  }
  return apiMocker;
};

// expose all the 'public' methods.
exports.createServer = apiMocker.createServer;
exports.start = apiMocker.start;
exports.setConfigFile = apiMocker.setConfigFile;
exports.stop = apiMocker.stop;
exports.middlewares = apiMocker.middlewares;
