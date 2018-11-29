#!/usr/bin/env node
const commander = require('commander');
const pkg = require('../package.json');

const ApiMocker = require('../lib/apimocker.js');

commander
  .version(pkg.version)
  .option('-c, --config <path>', 'Path to config.json file.', `${__dirname}/../config.json`)
  .option('-q, --quiet', 'Disable console logging.')
  .option('-p, --port <port>', 'Port that the http mock server will use. Default is 8888.', '8888')
  .option('-f, --proxy <proxyURL>', 'URL of a real service to proxy to, for endpoints that are not mocked.', false)
  .option('-i, --intercept <proxyIntercept>', 'Path to a module that exports an express-http-proxy intercept function')
  .option('-u, --upload-root <path>', 'Root path for storing uploaded files', null)
  .parse(process.argv);

const options = {};
options.port = commander.port;
options.quiet = !!commander.quiet;
options.proxyURL = commander.proxy;
options.proxyIntercept = commander.intercept;
options.uploadRoot = commander.uploadRoot;

ApiMocker.createServer(options)
  .setConfigFile(commander.config)
  .start();
