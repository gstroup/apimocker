#!/usr/bin/env node
var pkg = require("../package.json"),
    commander = require("commander"),
    ApiMocker = require("../lib/apimocker.js");

commander
    .version(pkg.version)
    .option("-c, --config <path>", "Absolute path to config file.", __dirname + "/../config.json")
    .option("-O, --show-output", "Enable console logging. Default is false.")
    .option("-p, --port <port>", "Port that the http mock server will use. Default is 8888.", "8888")
    .parse(process.argv);

var options = {};
commander.port && (options.serverPort = commander.port);
commander.showOutput && (options.output = commander.showOutput);

var apiMocker = ApiMocker.createServer(options)
    .setConfigFile(commander.config)
    .start();