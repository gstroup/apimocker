// run "grunt test", or run "mocha" in this test directory to execute.

const path = require('path');
// better assertions than node offers.
const chai = require('chai');
const sinon = require('sinon');
const mockRequire = require('mock-require');
const untildify = require('untildify');
const apiMocker = require('../lib/apimocker.js');

const { assert, expect } = chai;

describe('unit tests: ', () => {
  chai.config.includeStack = true;

  describe('createServer: ', () => {
    it('sets defaults when no options are passed in', () => {
      const mocker = apiMocker.createServer();
      expect(mocker.options.port).to.equal('8888');
      expect(mocker.options.mockDirectory).to.equal('./mocks/');
      expect(mocker.options.allowedDomains.length).to.equal(1);
      expect(mocker.options.allowedDomains[0]).to.equal('*');
      expect(mocker.options.allowedHeaders[0]).to.equal('Content-Type');
      expect(mocker.options.quiet).to.equal(undefined);
      expect(mocker.options.logRequestHeaders).to.equal(false);
    });

    it('overrides defaults with command line args', () => {
      const mocker = apiMocker.createServer({ port: 1234, quiet: true, foo: 'bar' });
      expect(mocker.options.port).to.equal(1234);
      expect(mocker.options.mockDirectory).to.equal('./mocks/');
      expect(mocker.options.allowedDomains[0]).to.equal('*');
      expect(mocker.options.quiet).to.equal(true);
      expect(mocker.options.foo).to.equal('bar');
    });
  });

  describe('setConfigFile: ', () => {
    const mocker = apiMocker.createServer();

    beforeEach(() => {
      delete mocker.configFilePath;
    });

    after(() => {
      delete mocker.configFilePath;
    });

    it('should set a relative path correctly using node path resolver', () => {
      assert.equal(
        path.resolve('../config.json'),
        mocker.setConfigFile('../config.json').configFilePath
      );
    });

    it('should set an absolute path correctly', () => {
      const absolutePath = path.normalize('/foo/bar/config.json');
      expect(mocker.setConfigFile(absolutePath).configFilePath).to.equal(absolutePath);
    });

    it('sets no path, if none is passed in', () => {
      expect(mocker.setConfigFile().configFilePath).to.equal(undefined);
    });
  });

  describe('loadConfigFile: ', () => {
    // Note:
    // Starting mock config paths with a / or ~ to avoid
    // the absoulute path resolution within setConfig which will not match
    // the path mocked by mock-require.
    const mockConfig = {
      mockDirectory: '~/foo/bar/samplemocks/',
      quiet: true,
      port: '7879',
      latency: 50,
      logRequestHeaders: true,
      allowedDomains: ['abc'],
      allowedHeaders: ['my-custom1', 'my-custom2'],
      webServices: {
        first: {
          verbs: ['get', 'post'],
          responses: {
            get: {
              mockFile: 'king.json'
            },
            post: {
              mockFile: 'ace.json'
            }
          },
          alternatePaths: ['1st']
        },
        'nested/ace': {
          mockFile: 'ace.json',
          verbs: ['get']
        },
        'var/:id': {
          mockFile: 'xml/queen.xml',
          verbs: ['get']
        },
        queen: {
          mockFile: 'xml/queen.xml',
          verbs: ['all']
        }
      }
    };

    afterEach(() => {
      mockRequire.stopAll();
    });

    it('sets options from new format mock config file', () => {
      const mocker = apiMocker.createServer({ quiet: true });
      mockRequire('/mock-config.json', mockConfig);
      mocker.setConfigFile('/mock-config.json');
      mocker.loadConfigFile();

      expect(mocker.options.port).to.equal(mockConfig.port);
      expect(mocker.options.allowedDomains[0]).to.equal(mockConfig.allowedDomains[0]);
      expect(mocker.options.allowedHeaders[0]).to.equal('my-custom1');
      expect(mocker.options.allowedHeaders[1]).to.equal('my-custom2');

      expect(mocker.options.webServices.first).to.eql(mocker.options.webServices['1st']);
      delete mocker.options.webServices['1st'];
      expect(mocker.options.webServices).to.deep.equal(mockConfig.webServices);

      expect(mocker.options.quiet).to.equal(true);
      expect(mocker.options.latency).to.equal(mockConfig.latency);
      expect(mocker.options.logRequestHeaders).to.equal(mockConfig.logRequestHeaders);
    });

    it('combines values from defaults, options, and config file', () => {
      let mocker = apiMocker.createServer({ quiet: true, test: 'fun', port: 2323 });
      mockRequire('/partial-config', { port: 8765, latency: 99, logRequestHeaders: false });
      mocker = mocker.setConfigFile('/partial-config');
      mocker.loadConfigFile();

      // value from config file
      expect(mocker.options.port).to.equal(8765);
      expect(mocker.options.latency).to.equal(99);
      expect(mocker.options.logRequestHeaders).to.equal(false);
      // value from defaults
      expect(mocker.options.allowedDomains[0]).to.equal('*');
      expect(mocker.options.webServices).to.deep.equal(mocker.defaults.webServices);
      // value from options passed in to createServer:
      expect(mocker.options.test).to.equal('fun');
    });

    it('expands ~ in mockDirectory setting', () => {
      const mocker = apiMocker.createServer({ quiet: true });
      mockRequire('/mock-config.json', mockConfig);
      mocker.setConfigFile('/mock-config.json');
      mocker.loadConfigFile();

      expect(mocker.options.mockDirectory).to.equal(untildify(mockConfig.mockDirectory));
    });

    it('supports js config files that export a function', () => {
      const mocker = apiMocker.createServer({ quiet: true });
      const port = '1111';
      mockRequire('/partial-config', () => ({ port }));
      mocker.setConfigFile('/partial-config');
      mocker.loadConfigFile();

      expect(mocker.options.port).to.equal(port);
    });

    it('supports js config files that export an object', () => {
      const mocker = apiMocker.createServer({ quiet: true });
      const port = '2222';
      mockRequire('/partial-config', { port });
      mocker.setConfigFile('/partial-config');
      mocker.loadConfigFile();

      expect(mocker.options.port).to.equal(port);
    });

    it('should not allow requests that avoid pre flight by default', () => {
      const mocker = apiMocker.createServer({ quiet: true });
      expect(mocker.options.allowAvoidPreFlight).to.equal(false);
    });

    it('should allow requests that avoid pre flight if specified in config', () => {
      const mocker = apiMocker.createServer({ quiet: true });
      mockRequire('/partial-config', {
        allowAvoidPreFlight: true
      });
      mocker.setConfigFile('/partial-config');
      mocker.loadConfigFile();

      expect(mocker.options.allowAvoidPreFlight).to.equal(true);
    });
  });

  describe('setSwitchOptions: ', () => {
    let mocker;
    let svcOptions;
    let reqStub;

    beforeEach(() => {
      mocker = apiMocker.createServer({ quiet: true });
      svcOptions = { switch: 'productId', mockFile: 'base' };
      reqStub = {
        body: {},
        params: {},
        query: {},
        header: () => {}
      };
    });

    it('does not set mock file path if switch is not found in request', () => {
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('base');
    });

    it('sets correct mock file path if switch is found in query string', () => {
      reqStub.query = { productId: '123' };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('productId123.base');
    });

    it('sets correct mock file path if switch is found in json body', () => {
      reqStub.body.productId = '678';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('productId678.base');
    });

    it('sets correct mock file path if switch is found in route parameter', () => {
      reqStub.params = { productId: '123' };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('productId123.base');
    });

    it('sets correct mock file path if switch is found in request header with matching case', () => {
      reqStub.header = () => '765';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('productId765.base');
    });

    it('sets correct mock file path if switch is found in request header with different case', () => {
      reqStub.header = () => '765';
      svcOptions = { switch: 'PRodUCTID', mockFile: 'base' };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('PRodUCTID765.base');
    });

    it('sets correct mock file path with switch and nested path', () => {
      reqStub.body.productId = '678';
      svcOptions.mockFile = 'path/to/base';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('path/to/productId678.base');
    });

    it('sets correct mock file path with switch value containing special character', () => {
      reqStub.body.productId = 'abc/123';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('productIdabc%2F123.base');
    });

    it('sets correct mock file path with two switch values', () => {
      svcOptions.switch = ['productId', 'color'];
      reqStub.body.productId = '345';
      reqStub.body.color = 'red';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('productId345colorred.base');
    });

    it('sets correct http status based on matching switch value', () => {
      svcOptions.switch = 'password';
      svcOptions.switchResponses = {
        passwordgood: { httpStatus: 200 }
      };
      reqStub.body.password = 'good';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.httpStatus).to.equal(200);
    });

    it('sets correct mock file path when switch matches and switchResponse contains a mockFile', () => {
      reqStub.body.productId = '678';
      svcOptions.switchResponses = {
        productId678: { mockFile: 'specialFileName' }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('specialFileName');
    });

    it('sets correct http status when switch value does not match', () => {
      svcOptions.switch = 'password';
      svcOptions.httpStatus = 401;

      svcOptions.switchResponses = {
        passwordgood: { httpStatus: 200 }
      };
      reqStub.body.password = 'bad';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.httpStatus).to.equal(401);
    });

    it('sets correct http status when two switches match', () => {
      svcOptions.switch = ['userId', 'password'];
      svcOptions.httpStatus = 401;
      svcOptions.switchResponses = {
        userId1234passwordgood: { httpStatus: 200 }
      };
      reqStub.body.password = 'good';
      reqStub.body.userId = '1234';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.httpStatus).to.equal(200);
    });

    it('sets correct mock file path when switch uses JsonPath and switch matches', () => {
      svcOptions.switch = '$.car.engine.part';
      svcOptions.switchResponses = {
        '$.car.engine.partTiming%20Belt': { mockFile: 'product456' }
      };
      reqStub.body = {
        car: {
          engine: {
            part: 'Timing Belt'
          }
        }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('product456');
    });

    it('sets correct mock file path when switch uses JsonPath and switch value does not match', () => {
      svcOptions.switch = '$.car.engine.part';
      svcOptions.switchResponses = {
        '$.car.engine.partTiming%20Belt': { mockFile: 'product456' }
      };
      reqStub.body = {
        car: {
          wheel: {}
        }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('base');
    });

    it('sets correct mock file path when switch uses JsonPath as a switch object and switch matches', () => {
      svcOptions.switch = {
        type: 'jsonpath',
        switch: '$.car.engine.part'
      };
      svcOptions.switchResponses = {
        '$.car.engine.partTiming%20Belt': { mockFile: 'product456' }
      };
      reqStub.body = {
        car: {
          engine: {
            part: 'Timing Belt'
          }
        }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('product456');
    });

    it('sets correct mock file path when switch uses JsonPath and switch value does not match', () => {
      svcOptions.switch = {
        type: 'jsonpath',
        switch: '$.car.engine.part'
      };
      svcOptions.switchResponses = {
        '$.car.engine.partTiming%20Belt': { mockFile: 'product456' }
      };
      reqStub.body = {
        car: {
          wheel: {}
        }
      };
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('base');
    });

    it('sets the correct mock file path when switch uses RegExp and switch matches', () => {
      svcOptions.switch = '/"carEnginePart([^"]*)"/';
      svcOptions.switchResponses = {
        '/"carEnginePart([^"]*)"/Belt': { mockFile: 'product456' }
      };
      reqStub.body = '"carPartWheel": wheel,\n"carEnginePartBelt": belt';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('product456');
    });

    it('sets the correct mock file path when switch uses RegExp and switch value does not match', () => {
      svcOptions.switch = '/"carEnginePart([^"]*)"/';
      svcOptions.switchResponses = {
        Belt: { mockFile: 'product456' }
      };
      reqStub.body = '"carPartWheel": wheel';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('base');
    });

    it('sets the correct mock file path when switch uses RegExp in a switch object and switch matches', () => {
      svcOptions.switch = {
        type: 'regexp',
        switch: '/"carEnginePart([^"]*)"/',
        key: 'carenginepart'
      };
      svcOptions.switchResponses = {
        carenginepartBelt: { mockFile: 'product456' }
      };
      reqStub.body = '"carPartWheel": wheel,\n"carEnginePartBelt": belt';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('product456');
    });

    it('sets the correct mock file path when switch uses RegExp in a switch object and switch does not match', () => {
      svcOptions.switch = {
        type: 'regexp',
        switch: '/"carEnginePart([^"]*)"/',
        key: 'carenginepart'
      };
      svcOptions.switchResponses = {
        carenginepartBelt: { mockFile: 'product456' }
      };
      reqStub.body = '"carPartWheel": wheel';
      mocker.setSwitchOptions(svcOptions, reqStub);
      expect(svcOptions.mockFile).to.equal('base');
    });
  });

  describe('setRoute:', () => {
    const am = apiMocker.createServer();

    it('sets no default http status code', () => {
      const options = {
        verb: 'get',
        latency: 0,
        serviceUrl: 'foo.com',
        mockFile: 'file.json'
      };
      am.setRoute(options);
      expect(options.httpStatus).to.equal(undefined);
    });
  });

  describe('setRoutes:', () => {
    const am = apiMocker.createServer();
    let setRouteMock;

    beforeEach(() => {
      setRouteMock = sinon.mock(am, 'setRoute');
    });

    afterEach(() => {
      setRouteMock.restore();
    });

    it('calls setRoute with a simple service definition', () => {
      const webServices = {
        first: {
          mockFile: 'king.json',
          latency: 20,
          verbs: ['get', 'post']
        }
      };
      am.options.webServices = webServices;
      setRouteMock.expects('setRoute').withExactArgs({
        latency: 20,
        mockFile: 'king.json',
        serviceUrl: 'first',
        verb: 'get'
      });
      setRouteMock.expects('setRoute').withExactArgs({
        latency: 20,
        mockFile: 'king.json',
        serviceUrl: 'first',
        verb: 'post'
      });
      am.setRoutes(webServices);
      setRouteMock.verify();
    });

    it('calls setRoute with complex service definition', () => {
      const webServices = {
        second: {
          verbs: ['delete', 'post'],
          responses: {
            delete: { httpStatus: 204 },
            post: {
              contentType: 'foobar',
              mockFile: 'king.json'
            }
          }
        }
      };
      am.options.webServices = webServices;
      setRouteMock.expects('setRoute').withExactArgs({
        httpStatus: 204,
        latency: 0,
        serviceUrl: 'second',
        verb: 'delete'
      });
      setRouteMock.expects('setRoute').withExactArgs({
        latency: 0,
        serviceUrl: 'second',
        verb: 'post',
        contentType: 'foobar',
        mockFile: 'king.json'
      });
      am.setRoutes(webServices);
      setRouteMock.verify();
    });
  });
});
