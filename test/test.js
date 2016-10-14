/* global describe, it, beforeEach, afterEach, after */

// run "grunt test", or run "mocha" in this test directory to execute.
describe('unit tests: ', function() {
  var chai = require("chai"),  // better assertions than node offers.
      apiMocker = require("../lib/apimocker.js"),
      path = require("path"),
      fs = require("fs"),
      assert = chai.assert,
      expect = chai.expect,
      sinon = require("sinon"),
      untildify = require("untildify"),
      testConfig = {
          "mockDirectory": "~/foo/bar/samplemocks/",
          "quiet": true,
          "port": "7879",
          "latency": 50,
          "logRequestHeaders": true,
          "allowedDomains": ["abc"],
          "allowedHeaders": ["my-custom1", "my-custom2"],
          "webServices": {
            "first": {
              "verbs": ["get","post"],
              "responses": {
                "get": {
                  "mockFile": "king.json"
                },
                "post": {
                  "mockFile": "ace.json"
                }
              },
              "alternatePaths": ["1st"]
            },
            "nested/ace": {
              "mockFile": "ace.json",
              "verbs": ["get"]
            },
            "var/:id": {
              "mockFile": "xml/queen.xml",
              "verbs": ["get"]
            },
            "queen": {
              "mockFile": "xml/queen.xml",
              "verbs": ["all"]
            }
          }
      };
      chai.config.includeStack = true;

  describe('createServer: ', function() {
    it('sets defaults when no options are passed in', function() {
      var mocker = apiMocker.createServer();
      expect(mocker.options.port).to.equal("8888");
      expect(mocker.options.mockDirectory).to.equal("./mocks/");
      expect(mocker.options.allowedDomains.length).to.equal(1);
      expect(mocker.options.allowedDomains[0]).to.equal("*");
      expect(mocker.options.allowedHeaders[0]).to.equal("Content-Type");
      expect(mocker.options.quiet).to.equal(undefined);
      expect(mocker.options.logRequestHeaders).to.equal(false);
    });

    it('overrides defaults with command line args', function() {
      var mocker = apiMocker.createServer({port:1234, quiet: true, foo: "bar"});
      expect(mocker.options.port).to.equal(1234);
      expect(mocker.options.mockDirectory).to.equal("./mocks/");
      expect(mocker.options.allowedDomains[0]).to.equal("*");
      expect(mocker.options.quiet).to.equal(true);
      expect(mocker.options.foo).to.equal("bar");
    });
  });

  describe('setConfigFile: ', function() {
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
      var absolutePath = path.normalize('/foo/bar/config.json');
      expect(apiMocker.setConfigFile(absolutePath).configFilePath).to.equal(absolutePath);
    });

    it('sets no path, if none is passed in', function() {
      expect(apiMocker.setConfigFile().configFilePath).to.equal(undefined);
    });
  });

  describe("loadConfigFile: ", function() {
    var fsStub;

    beforeEach(function createFsStub() {
      fsStub = sinon.stub(fs, "readFileSync");  // fsStub is a function
    });

    afterEach(function restoreFs() {
      fsStub.restore();
    });

    it("sets options from new format mock config file", function() {
      var mocker = apiMocker.createServer({quiet: true});
      fsStub.returns(JSON.stringify(testConfig));
      mocker.setConfigFile("any value");
      mocker.loadConfigFile();
      expect(mocker.options.port).to.equal(testConfig.port);
      expect(mocker.options.allowedDomains[0]).to.equal(testConfig.allowedDomains[0]);
      expect(mocker.options.allowedHeaders[0]).to.equal("my-custom1");
      expect(mocker.options.allowedHeaders[1]).to.equal("my-custom2");

      expect(mocker.options.webServices.first)
        .to.eql(mocker.options.webServices["1st"]);
      delete mocker.options.webServices["1st"];
      expect(mocker.options.webServices).to.deep.equal(testConfig.webServices);

      expect(mocker.options.quiet).to.equal(true);
      expect(mocker.options.latency).to.equal(testConfig.latency);
      expect(mocker.options.logRequestHeaders).to.equal(testConfig.logRequestHeaders);
    });

    it("combines values from defaults, options, and config file", function() {
      var mocker = apiMocker.createServer({quiet: true, test: "fun", port: 2323});
      fsStub.returns(JSON.stringify({port: 8765, latency: 99, logRequestHeaders: false}));
      mocker = mocker.setConfigFile("another abitrary value");

      mocker.loadConfigFile();
      // value from config file
      expect(mocker.options.port).to.equal(8765);
      expect(mocker.options.latency).to.equal(99);
      expect(mocker.options.logRequestHeaders).to.equal(false);
      // value from defaults
      expect(mocker.options.allowedDomains[0]).to.equal("*");
      expect(mocker.options.webServices).to.deep.equal(mocker.defaults.webServices);
      // value from options passed in to createServer:
      expect(mocker.options.test).to.equal("fun");
    });

    it("expands ~ in mockDirectory setting", function() {
      var mocker = apiMocker.createServer({quiet: true});
      fsStub.returns(JSON.stringify(testConfig));
      mocker.loadConfigFile();
      expect(mocker.options.mockDirectory).to.equal(untildify(testConfig.mockDirectory));
    });
  });

  describe("setSwitchOptions: ", function() {
    var mocker, svcOptions, reqStub;

    beforeEach(function createMocker() {
      mocker = apiMocker.createServer({quiet: true});
      svcOptions = {switch: "productId", mockFile: "base"};
      reqStub = {
        param: function() {return null;},
        body: {}
      };
    });

    it("does not set mock file path if switch is not found in request", function() {
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("base");
    });

    it("sets correct mock file path if switch is found in query string", function() {
      reqStub.param = function() {return "123";};
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("productId123.base");
    });

    it("sets correct mock file path if switch is found in json body", function() {
      reqStub.body.productId = "678";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("productId678.base");
    });

    it("sets correct mock file path if switch is found in request header with matching case", function() {
      reqStub.headers = {productId: "765"};
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("productId765.base");
    });

    it("sets correct mock file path if switch is found in request header with different case", function() {
      reqStub.headers = {PRODUCTid: "765"};
      svcOptions = {switch: "PRodUCTID", mockFile: "base"};
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("PRodUCTID765.base");
    });

    it("sets correct mock file path with switch and nested path", function() {
      reqStub.body.productId="678";
      svcOptions.mockFile = "path/to/base";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("path/to/productId678.base");
    });

    it("sets correct mock file path with switch value containing special character", function() {
      reqStub.body.productId="abc/123";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("productIdabc%2F123.base");
    });

    it("sets correct mock file path with two switch values", function() {
      svcOptions.switch = ["productId", "color"];
      reqStub.body.productId = "345";
      reqStub.body.color = "red";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("productId345colorred.base");
    });

    it("sets correct http status based on matching switch value", function() {
      svcOptions.switch = "password";
      svcOptions.switchResponses = {
        passwordgood: {httpStatus: 200}
      };
      reqStub.body.password = "good";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.httpStatus).to.equal(200);
    });

    it("sets correct mock file path when switch matches and switchResponse contains a mockFile", function() {
      reqStub.body.productId = "678";
      svcOptions.switchResponses = {
        "productId678": {mockFile: "specialFileName"}
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("specialFileName");
    });

    it("sets correct http status when switch value does not match", function() {
      svcOptions.switch = "password";
      svcOptions.httpStatus = 401;

      svcOptions.switchResponses = {
        passwordgood: {httpStatus: 200}
      };
      reqStub.body.password = "bad";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.httpStatus).to.equal(401);
    });

    it("sets correct http status when two switches match", function() {
      svcOptions.switch = ["userId", "password"];
      svcOptions.httpStatus = 401;
      svcOptions.switchResponses = {
        userId1234passwordgood: {httpStatus: 200}
      };
      reqStub.body.password = "good";
      reqStub.body.userId = "1234";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.httpStatus).to.equal(200);
    });

    it("sets correct mock file path when switch uses JsonPath and switch matches", function() {
        svcOptions.switch = "$.car.engine.part";
        svcOptions.switchResponses = {
          "$.car.engine.partTiming%20Belt": {mockFile: "product456"}
        };
        reqStub.body = {
          car: {
            engine: {
              part: "Timing Belt"
            }
          }
        };
        mocker.setSwitchOptions(svcOptions, reqStub);
        expect(svcOptions.mockFile).to.equal("product456");
    });

    it("sets correct mock file path when switch uses JsonPath and switch value does not match", function() {
        svcOptions.switch = "$.car.engine.part";
        svcOptions.switchResponses = {
          "$.car.engine.partTiming%20Belt": {mockFile: "product456"}
        };
        reqStub.body = {
          car: {
            wheel: {}
          }
        };
        mocker.setSwitchOptions(svcOptions, reqStub);
        expect(svcOptions.mockFile).to.equal("base");
    });

    it("sets correct mock file path when switch uses JsonPath as a switch object and switch matches", function() {
      svcOptions.switch = {
        type: "jsonpath",
        switch: "$.car.engine.part"
      };
      svcOptions.switchResponses = {
        "$.car.engine.partTiming%20Belt": {mockFile: "product456"}
      };
      reqStub.body = {
        car: {
          engine: {
            part: "Timing Belt"
          }
        }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("product456");
    });

    it("sets correct mock file path when switch uses JsonPath and switch value does not match", function() {
      svcOptions.switch = {
        type: "jsonpath",
        switch: "$.car.engine.part"
      };
      svcOptions.switchResponses = {
        "$.car.engine.partTiming%20Belt": {mockFile: "product456"}
      };
      reqStub.body = {
        car: {
          wheel: {}
        }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("base");
    });

    it("sets the correct mock file path when switch uses RegExp and switch matches", function() {
        svcOptions.switch = "/\"carEnginePart([^\"]*)\"/";
        svcOptions.switchResponses = {
          "/\"carEnginePart([^\"]*)\"/Belt": {mockFile: "product456"}
        };
        reqStub.body = "\"carPartWheel\":" +
            " wheel,\n\"carEnginePartBelt\": belt";
        mocker.setSwitchOptions(svcOptions, reqStub);
        expect(svcOptions.mockFile).to.equal("product456");
    });

    it("sets the correct mock file path when switch uses RegExp and switch value does not match", function() {
      svcOptions.switch = "/\"carEnginePart([^\"]*)\"/";
      svcOptions.switchResponses = {
        "Belt": {mockFile: "product456"}
      };
      reqStub.body = "\"carPartWheel\": wheel";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("base");
    });

    it("sets the correct mock file path when switch uses RegExp in a switch object and switch matches", function() {
      svcOptions.switch = {
        type: "regexp",
        switch: "/\"carEnginePart([^\"]*)\"/",
        key: "carenginepart"
      };
      svcOptions.switchResponses = {
        "carenginepartBelt": {mockFile: "product456"}
      };
      reqStub.body = "\"carPartWheel\":" +
          " wheel,\n\"carEnginePartBelt\": belt";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("product456");
    });

    it("sets the correct mock file path when switch uses RegExp in a switch object and switch does not match", function() {
      svcOptions.switch = {
        type: "regexp",
        switch: "/\"carEnginePart([^\"]*)\"/",
        key: "carenginepart"
      };
      svcOptions.switchResponses = {
        "carenginepartBelt": {mockFile: "product456"}
      };
      reqStub.body = "\"carPartWheel\": wheel";
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal("base");
    });

  });

  describe("setRoute:", function() {
    var am = apiMocker.createServer();

    it("sets no default http status code", function() {
      var options = {
        verb: "get",
        latency: 0,
        serviceUrl: "foo.com",
        mockFile: "file.json"
      };
      am.setRoute(options);
      expect(options.httpStatus).to.equal(undefined);
    });
  });

  describe("setRoutes:", function() {
    var am = apiMocker.createServer(),
        setRouteMock;

    beforeEach(function () {
      setRouteMock = sinon.mock(am, "setRoute");
    });

    afterEach(function restoreFs() {
      setRouteMock.restore();
    });

    it("calls setRoute with a simple service definition", function() {
      var webServices = {
        "first": {
          "mockFile": "king.json",
          "latency": 20,
          "verbs": ["get", "post"]
        }
      };
      am.options.webServices = webServices;
      setRouteMock.expects("setRoute").withExactArgs({ latency: 20, mockFile: "king.json", serviceUrl: "first", verb: "get" });
      setRouteMock.expects("setRoute").withExactArgs({ latency: 20, mockFile: "king.json", serviceUrl: "first", verb: "post" });
      am.setRoutes(webServices);
      setRouteMock.verify();
    });

    it("calls setRoute with complex service definition", function() {
      var webServices = {
        "second": {
          "verbs": ["delete", "post"],
          "responses": {
            "delete": {"httpStatus": 204},
            "post": {
              "contentType": "foobar",
              "mockFile": "king.json"
            }
          }
        }
      };
      am.options.webServices = webServices;
      setRouteMock.expects("setRoute").withExactArgs({ httpStatus: 204, latency: 0, serviceUrl: "second", verb: "delete" });
      setRouteMock.expects("setRoute").withExactArgs({ latency: 0, serviceUrl: "second", verb: "post", contentType: "foobar", mockFile: "king.json" });
      am.setRoutes(webServices);
      setRouteMock.verify();
    });
  });

});
