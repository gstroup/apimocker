/* global describe, it, xit, before */

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
      httpPostOptions = function(path, data) {
        return {
          hostname: 'localhost',
          port: 7879,
          method: 'POST',
          path: path,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        };
      },
      mocker;

  // This doesn't seem to help...
  chai.Assertion.includeStack = true;

  function verifyResponseBody(httpReqOptions, postData, expected, done) {
    var req = http.request(httpReqOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        expect(JSON.parse(chunk)).to.deep.equal(expected);
        // console.log(chunk);
        if (done) {
          done();
        }
      });
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  }

  function verifyResponseHeaders(httpReqOptions, expected, done) {
    var req = http.request(httpReqOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function () { //chunk) {
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

  function verifyResponseStatus(httpReqOptions, postData, expectedStatus, done) {
    var req = http.request(httpReqOptions, function(res) {
      res.setEncoding('utf8');
      res.on('data', function() {
        // console.log("data event, status: " + res.statusCode);
        expect(res.statusCode).to.equal(expectedStatus);
      });
      res.on('end', function() {
        // console.log("status: " + res.statusCode);
        expect(res.statusCode).to.equal(expectedStatus);
        done();
      });
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  }

  describe("old file format:", function() {
    before(function startMockerForFuncTests() {
      mocker = apiMocker.createServer({quiet: false}).setConfigFile("test/test-old-config.json");
      mocker.start();
    });

    it('returns correct data for basic get request', function(done) {
      var reqOptions = httpReqOptions("/first");
      verifyResponseBody(reqOptions, null, {"king": "greg"}, done);
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
      verifyResponseBody(reqOptions, null, {"king": "greg"}, done);
    });

    it('returns 404 for incorrect path', function(done) {
      var reqOptions = httpReqOptions("/first");
      reqOptions.method = "POST";
      verifyResponseStatus(reqOptions, "{}", 404, done);
    });
  });

  describe('new config file format:', function() {
    before(function(done) {
      mocker.setConfigFile("test/test-config.json");

      var req, reqOptions = httpReqOptions();
      reqOptions.path = "/admin/reload";
      req = http.request(reqOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function () {
          expect(res.statusCode).to.equal(200);
          done();
        });
      });
      req.end();
    });

    it('sets a basic route', function(done) {
      var reqOptions = httpReqOptions("/first");
      reqOptions.method = "get";
      verifyResponseBody(reqOptions, null, {"king": "greg"}, done);
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
      var reqOptions = httpReqOptions();
      reqOptions.method = "post";
      reqOptions.path = "/king";
      verifyResponseStatus(reqOptions, "{}", 404, done);
    });

    it('allows domains specified in config file', function(done) {
      var reqOptions = httpReqOptions("/first");
      verifyResponseHeaders(reqOptions, {'access-control-allow-origin': "abc"}, done);
    });

    it('allows headers as specified in config file', function(done) {
      var reqOptions = httpReqOptions("/first");
      verifyResponseHeaders(reqOptions, {'access-control-allow-headers': 'Content-Type,my-custom-header'}, done);
    });

    it('returns correct file for switch param in json request', function(done) {
      var postData = '{"customerId": 1234}',
          postOptions =  httpPostOptions("/nested/ace", postData),
          expected = {
            "ace": "greg",
            "note": "request contained customerId = 1234"
          };
      verifyResponseBody(postOptions, postData, expected, done);
    });

    it('returns base file when no match for switch param in json request', function(done) {
      var postData = '{"customerId": 124}',
          postOptions =  httpPostOptions("/nested/ace", postData),
          expected = {
            "ace": "greg"
          };
      verifyResponseBody(postOptions, postData, expected, done);
    });

    it('returns base file when no switch param passed in json request', function(done) {
      var postData = '{"phonenumber": 124}',
          postOptions =  httpPostOptions("/nested/ace", postData),
          expected = {
            "ace": "greg"
          };
      verifyResponseBody(postOptions, postData, expected, done);
    });

    it('returns correct file for switch param in query string', function(done) {
      var reqOptions =  httpReqOptions("/nested/ace?customerId=1234"),
          expected = {
            "ace": "greg",
            "note": "request contained customerId = 1234"
          };
      verifyResponseBody(reqOptions, null, expected, done);
    });

    it('returns correct httpStatus when switches match', function(done) {
      var postData = '{"userId": "user1", "password": "good"}',
          postOptions =  httpPostOptions("/login", postData);
      verifyResponseStatus(postOptions, postData, 200, done);
    });

    it('returns correct httpStatus when switch does not match', function(done) {
      var postOptions =  httpPostOptions("/login", "{}");
      verifyResponseStatus(postOptions, "{}", 401, done);
    });

    it("returns httpStatus of 200 if not set", function(done) {
      verifyResponseStatus(httpReqOptions("/first"), null, 200, done);
    });

    it("returns httpStatus specified in config file, when contentType is passed in", function(done) {
      var reqOptions = httpPostOptions("/protected", '{}');
      reqOptions.method = "put";
      verifyResponseStatus(reqOptions, "{}", 403, done);
    });

    it("returns httpStatus 204 specified in config file", function(done) {
      var reqOptions = httpReqOptions("/second");
      reqOptions.method = "delete";
      verifyResponseStatus(reqOptions, null, 204, done);
    });

    // TODO: Fix this test... it fails intermittently, due to timing problems.
    xit("returns correct mock file after admin/setMock was called twice", function(done) {
      var postData = '{"verb":"get", "serviceUrl":"third", "mockFile":"king.json"}',
          postOptions =  httpPostOptions("/admin/setMock", postData),
          expected = {
            "verb":"get",
            "serviceUrl":"third",
            "mockFile":"king.json",
            "httpStatus": 200
          };
      verifyResponseBody(postOptions, postData, expected);

      verifyResponseBody(httpReqOptions("/third"), null, {king: "greg"});

      // change route, and verify again
      postData = '{"verb":"get", "serviceUrl":"third", "mockFile":"ace.json"}';
      postOptions =  httpPostOptions("/admin/setMock", postData);
      expected = {
        "verb":"get",
        "serviceUrl":"third",
        "mockFile":"ace.json",
        "httpStatus": 200
      };
      verifyResponseBody(postOptions, postData, expected);

      verifyResponseBody(httpReqOptions("/third"), null, {ace: "greg"}, done);
    });

    it("returns the headers as specified in the config file", function(done) {
      var reqOptions = httpReqOptions("/firstheaders");
      verifyResponseHeaders(reqOptions, {"x-requested-by": "4c2df03a17a803c063f21aa86a36f6f55bdde1f85b89e49ee1b383f281d18c09c2ba30654090df3531cd2318e3c", "dummyheader": "dummyvalue", "content-type": "foobar"}, done);
    });
  });
});