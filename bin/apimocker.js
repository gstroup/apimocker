#!/usr/bin/env node
var pkg = require("../package.json"),
    commander = require("commander"),
    ApiMocker = require("../lib/apimocker.js");

commander
    .version(pkg.version)
    .option("-c, --config <path>", "Path to config.json file.", __dirname + "/../config.json")
    .option("-q, --quiet", "Disable console logging.")
    .option("-p, --port <port>", "Port that the http mock server will use. Default is 8888.", "8888")
    .option("-f, --proxy <proxyURL>", "URL of a real service to proxy to, for endpoints that are not mocked.", false)
    .parse(process.argv);

var options = {};
options.port = commander.port;
options.quiet = !!commander.quiet;
options.proxyURL = commander.proxy;

var apiMocker = ApiMocker.createServer(options)
    .setConfigFile(commander.config)
    .start();
