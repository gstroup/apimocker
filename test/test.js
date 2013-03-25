// run "grunt test", or run "mocha" in this test directory to execute.
describe('unit tests', function() {
  var chai = require("chai"),  // better assertions than node offers.
      apiMocker = require("../lib/apimocker.js"),
      path = require("path"),
      fs = require("fs"),
      assert = chai.assert,
      expect = chai.expect,
      sinon = require("sinon"),
      testConfig = {
          "mockDirectory": "foo/bar/samplemocks/",
          "quiet": true,
          "port": "7879",
          "latency": 50,
          "allowedDomains": ["abc"],
          "webServices": {
              "get": {
                  "first": "king.json",
                  "nested/ace": "ace.json",
                  "var/:id": "xml/queen.xml"
              },
              "post": {
                  "king": "king.json"
              },
              "all": {
                  "queen": "xml/queen.xml"
              }
          }
      };
      chai.Assertion.includeStack = true;

  describe('createServer', function() {
    it('sets defaults when no options are passed in', function() {
      var mocker = apiMocker.createServer();
      expect(mocker.options.port).to.equal("8888");
      expect(mocker.options.mockDirectory).to.equal("./mocks/");
      expect(mocker.options.allowedDomains.length).to.equal(1);
      expect(mocker.options.allowedDomains[0]).to.equal("*");
      expect(mocker.options.webServices.get).to.be.an('object');
      expect(mocker.options.webServices.post).to.be.an('object');
    });

    it('overrides defaults with command line args', function() {
      var mocker = apiMocker.createServer({port:1234, quiet: true, foo: "bar"});
      expect(mocker.options.port).to.equal(1234);
      expect(mocker.options.mockDirectory).to.equal("./mocks/");
      expect(mocker.options.allowedDomains[0]).to.equal("*");
      expect(mocker.options.webServices.get).to.be.an('object');
      expect(mocker.options.webServices.post).to.be.an('object');
      expect(mocker.options.quiet).to.equal(true);
      expect(mocker.options.foo).to.equal("bar");
    });
  });

  describe('setConfigFile', function() {
    var mocker = apiMocker.createServer();

    beforeEach(function() {
      delete mocker.configFilePath;
    });

    after(function() {
      delete mocker.configFilePath;
    });

    it('should set a relative path correctly using node path resolver', function() {
      // var mocker = apiMocker.createServer();
      assert.equal(path.resolve("../config.json"), apiMocker.setConfigFile("../config.json").configFilePath);
    });

    it('should set an absolute path correctly', function() {
      var absolutePath = "/foo/bar/config.json";
      expect(apiMocker.setConfigFile(absolutePath).configFilePath).to.equal(absolutePath);
    });

    it('sets no path, if none is passed in', function() {
      expect(apiMocker.setConfigFile().configFilePath).to.equal(undefined);
    });
  });

  describe("loadConfigFile", function() {
    var fsStub;

    beforeEach(function createFsStub() {
      fsStub = sinon.stub(fs, "readFileSync");  // fsStub is a function
    });

    afterEach(function restoreFs() {
      fsStub.restore();
    });

    it("sets options from mock in-memory config file", function() {
      var mocker = apiMocker.createServer({quiet: true});
      fsStub.returns(JSON.stringify(testConfig));
      mocker.setConfigFile("any value");

      mocker.loadConfigFile();
      expect(mocker.options.port).to.equal(testConfig.port);
      expect(mocker.options.mockDirectory).to.equal(testConfig.mockDirectory);
      expect(mocker.options.allowedDomains[0]).to.equal(testConfig.allowedDomains[0]);
      expect(mocker.options.webServices).to.deep.equal(testConfig.webServices);
      expect(mocker.options.quiet).to.equal(true);
      expect(mocker.options.latency).to.equal(testConfig.latency);
    });

    it("combines values from defaults, options, and config file", function() {
      var mocker = apiMocker.createServer({quiet: true, test: "fun", port: 2323});
      fsStub.returns(JSON.stringify({port: 8765, latency: 99}));
      mocker = mocker.setConfigFile("another abitrary value");

      mocker.loadConfigFile();
      // value from config file
      expect(mocker.options.port).to.equal(8765);
      expect(mocker.options.latency).to.equal(99);
      // value from defaults
      expect(mocker.options.allowedDomains[0]).to.equal("*");
      expect(mocker.options.webServices).to.deep.equal(mocker.defaults.webServices);
      // value from options passed in to createServer:
      expect(mocker.options.test).to.equal("fun");
    });
  });

});