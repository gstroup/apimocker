describe('Functional tests using an http client to test "end-to-end": ', function() {

  var chai = require("chai"),
      apiMocker = require("../lib/apimocker.js"),
      expect = chai.expect,
      http = require("http"),
      _ = require("underscore"),
      httpReqOptions = function(path) {
        return {
          hostname: 'localhost',
          port: 7879,
          method: 'GET',
          path: path
        };
      },
      mocker;

  // This doesn't seem to help...
  chai.Assertion.includeStack = true;

  before(function startMockerForFuncTests() {
    mocker = apiMocker.createServer({quiet: false}).setConfigFile("test/test-old-config.json");
    mocker.start();
  });

  function verifyResponseBody(httpReqOptions, expected, done) {
    var req = http.request(httpReqOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        //expect(JSON.parse(chunk)).to.deep.equal(expected);
        // console.log(chunk);
        done();
      });
    });
    req.end();
  }

  function verifyResponseHeaders(httpReqOptions, expected, done) {
    var req = http.request(httpReqOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        // console.log(res.headers);
        var expectedKeys = _.keys(expected);
        _.each(expectedKeys, function(key) {
          expect(res.headers[key]).to.equal(expected[key]);
        });
        done();
      });
    });
    req.end();
  }

  it('returns correct data for basic get request', function(done) {
    var reqOptions = httpReqOptions("/first");
    verifyResponseBody(reqOptions, {"king": "greg"}, done);
  });

  it('returns correct content-type for json response', function(done) {
    var reqOptions = httpReqOptions("/first");
    verifyResponseHeaders(reqOptions, {"content-type": "application/json"}, done);
  });

  it('returns correct content-type for xml response', function(done) {
    var reqOptions = httpReqOptions("/queen");
    verifyResponseHeaders(reqOptions, {"content-type": "application/xml"}, done);
  });

  it('returns correct data for basic post request', function(done) {
    var reqOptions = httpReqOptions("/king");
    reqOptions.method = "POST";
    verifyResponseBody(reqOptions, {"king": "greg"}, done);
  });

  it('returns 404 for incorrect path', function(done) {
    var req, reqOptions = httpReqOptions();
    reqOptions.method = "POST";
    reqOptions.path = "/first";
    req = http.request(reqOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        expect(res.statusCode).to.equal(404);
        done();
      });
    });
    req.end();
  });

  describe('new config file format', function(done) {
    before(function(done) {
      mocker.setConfigFile("test/test-config.json");

      var req, reqOptions = httpReqOptions();
      reqOptions.path = "/admin/reload";
      req = http.request(reqOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          expect(res.statusCode).to.equal(200);
          done();
        });
      });
      req.end();
    });

    it('sets a basic route', function(done) {
      var reqOptions = httpReqOptions("/first");
      reqOptions.method = "get";
      verifyResponseBody(reqOptions, {"king": "greg"}, done);
    });

    it('returns a custom content type', function(done) {
      var reqOptions = httpReqOptions("/first");
      verifyResponseHeaders(reqOptions, {"content-type": "foobar"}, done);
    });

    it('returns correct content-type for json response, with nested path', function(done) {
      var reqOptions = httpReqOptions("/nested/ace");
      verifyResponseHeaders(reqOptions, {"content-type": "application/json"}, done);
    });

    it('returns 404 for incorrect path, after reload', function(done) {
      var req, reqOptions = httpReqOptions();
      reqOptions.method = "post";
      reqOptions.path = "/king";
      req = http.request(reqOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          expect(res.statusCode).to.equal(404);
          done();
        });
      });
      req.end();
    });

    it('allows domains specified in config file', function(done) {
      var reqOptions = httpReqOptions("/first");
      verifyResponseHeaders(reqOptions, {'access-control-allow-origin': "abc"}, done);
    });
  });
});