// run "mocha" in this test directory to execute.

var assert = require("assert"),
		apiMocker = require("../lib/apimocker.js"),
		path = require("path");

describe('setConfigFile', function() {
	var mocker = apiMocker.createServer();

	beforeEach(function() {
		delete mocker.configFilePath;
	});

	it('should set a relative path correctly using node path resolver', function() {
		assert.equal(path.resolve("../config.json"), mocker.setConfigFile("../config.json").configFilePath);
	});

	it('should set an absolute path correctly', function() {
		var absolutePath = path.resolve("../config.json");
		assert.equal(absolutePath, mocker.setConfigFile(absolutePath).configFilePath);
	});

	it('sets no path, if none is passed in', function() {
		assert.equal(undefined, mocker.setConfigFile().configFilePath);
	});
});

describe("loadConfigFile", function() {
	var mocker = apiMocker.createServer();
	mocker.setConfigFile(path.resolve("../config.json"));
	
	it("TODO: loads from options, defaults, config file, etc...", function() {
		mocker.loadConfigFile();
		assert.equal("abc", "abc");
	});
});