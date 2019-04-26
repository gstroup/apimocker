/* global describe, it, before, after */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const http = require('http');
const _ = require('underscore');
const fs = require('fs');
const { join: pathJoin } = require('path');

const supertest = require('supertest');
const apiMocker = require('../lib/apimocker.js');

const stRequest = supertest('http://localhost:7879');

const createHttpReqOptions = (path, method) => ({
  hostname: 'localhost',
  port: 7879,
  method: method || 'GET',
  path
});

const createHttpPostOptions = (path, data) => _.extend(createHttpReqOptions(path, 'POST'), {
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
});

const MOCK_PORT = 7881;

const verifyResponseHeaders = (httpReqOptions, expected, done) => {
  const req = http.request(httpReqOptions, (res) => {
    res.setEncoding('utf8');
    res.on('data', () => {
      // console.log('Response headers: ' + JSON.stringify(res.headers));
      const expectedKeys = _.keys(expected);
      _.each(expectedKeys, (key) => {
        expect(res.headers[key]).to.equal(expected[key]);
      });
      done();
    });
  });
  req.end();
};

const verifyResponseBody = (httpReqOptions, postData, expected, done) => {
  const req = http.request(httpReqOptions, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      // console.log(chunk);
      expect(res.statusCode).to.be.lessThan(400);
      expect(JSON.parse(chunk)).to.deep.equal(expected);
      if (done) {
        done();
      }
    });
  });

  if (postData) {
    req.write(postData);
  }
  req.end();
};

const clearDirSync = (dirname) => {
  _.each(fs.readdirSync(dirname), (fname) => {
    fs.unlinkSync(pathJoin(dirname, fname));
  });
};

describe('Functional tests using an http client to test "end-to-end": ', () => {
  describe('apimocker server:', () => {
    let mocker;
    let testEndpoint;

    before((done) => {
      const options = {
        quiet: true,
        mockDirectory: './samplemocks/',
        proxyURL: `http://localhost:${MOCK_PORT}`
      };
      mocker = apiMocker.createServer(options).setConfigFile('test/test-config.json');
      mocker.start(null);

      testEndpoint = http
        .createServer((req, res) => {
          if (req.url === '/non-mocked') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: 'real' }));
          } else {
            res.writeHead(404);
            res.end();
          }
        })
        .listen(MOCK_PORT, done);
    });

    after((done) => {
      mocker.stop(done);
      testEndpoint.close();
    });

    describe('basic requests: ', () => {
      it('returns correct data for basic get request', (done) => {
        const reqOptions = createHttpReqOptions('/first');
        verifyResponseBody(reqOptions, null, { king: 'greg' }, done);
      });

      it('Returns correct body data', (done) => {
        const reqOptions = createHttpReqOptions('/raw');
        verifyResponseBody(reqOptions, null, { text: 'Good Job!' }, done);
      });

      it('Returns correct body data from message', (done) => {
        const reqOptions = createHttpReqOptions('/raw/template/ATestHashToReturn');
        verifyResponseBody(reqOptions, null, { text: 'ATestHashToReturn' }, done);
      });

      it('returns correct data for basic post request', (done) => {
        const reqOptions = createHttpReqOptions('/nested/ace');
        reqOptions.method = 'POST';
        verifyResponseBody(reqOptions, null, { ace: 'greg' }, done);
      });

      it('returns correct data for post to path with mockFile varying on verb', (done) => {
        const reqOptions = createHttpReqOptions('/royals');
        reqOptions.method = 'POST';
        verifyResponseBody(reqOptions, null, { king: 'greg' }, done);
      });

      it('returns correct data for get to path with mockFile varying on verb', (done) => {
        const reqOptions = createHttpReqOptions('/royals');
        verifyResponseBody(reqOptions, null, { ace: 'greg' }, done);
      });

      it('Returns data in template from the route', (done) => {
        const reqOptions = createHttpReqOptions('/template/john/4');
        verifyResponseBody(reqOptions, null, { name: 'john', number: 4 }, done);
      });

      it('returns correct data for get to templateSwitch substituting GET params into mockFile ', (done) => {
        const reqOptions = createHttpReqOptions(
          '/templateSwitchGetParams?appID=123456789&appName=myAppName&userName=MyName&userAge=21'
        );
        const expected = {
          appID: 123456789,
          appName: 'myAppName',
          userName: 'MyName',
          userAge: 21
        };
        verifyResponseBody(reqOptions, null, expected, done);
      });

      it('returns correct data for post to templateSwitch substituting POST data parsed using jsonPath into mockFile', (done) => {
        const postData = '{ "data": { "appID": 123456789, "appName": "myAppName", "user": { "userName": "MyName", "userAge": 21 } } }';
        const postOptions = createHttpPostOptions('/templateSwitchPostJsonPath', postData);
        const expected = {
          appID: 123456789,
          appName: 'myAppName',
          userName: 'MyName',
          userAge: 21
        };
        verifyResponseBody(postOptions, postData, expected, done);
      });

      it('returns correct data for an alternate path', (done) => {
        const reqOptions = createHttpReqOptions('/1st');
        verifyResponseBody(reqOptions, null, { king: 'greg' }, done);
      });
    });

    describe('content type: ', () => {
      it('returns a custom content type', (done) => {
        const reqOptions = createHttpReqOptions('/first');
        verifyResponseHeaders(reqOptions, { 'content-type': 'foobar' }, done);
      });

      it('returns correct content-type for json response, with nested path', (done) => {
        const reqOptions = createHttpReqOptions('/nested/ace');
        verifyResponseHeaders(
          reqOptions,
          { 'content-type': 'application/json; charset=UTF-8' },
          done
        );
      });

      it('returns correct content-type for xml response', (done) => {
        const reqOptions = createHttpReqOptions('/var/123');
        verifyResponseHeaders(reqOptions, { 'content-type': 'application/xml' }, done);
      });
    });

    describe('switch on request param: ', () => {
      it('returns correct file for switch param in json request', (done) => {
        const postData = '{"customerId": 1234}';
        const postOptions = createHttpPostOptions('/nested/ace', postData);
        const expected = {
          ace: 'greg',
          note: 'request contained customerId = 1234'
        };
        verifyResponseBody(postOptions, postData, expected, done);
      });

      it('returns base file when no match for switch param in json request', (done) => {
        const postData = '{"customerId": 124}';
        const postOptions = createHttpPostOptions('/nested/ace', postData);
        const expected = {
          ace: 'greg'
        };
        verifyResponseBody(postOptions, postData, expected, done);
      });

      it('returns base file when no switch param passed in json request', (done) => {
        const postData = '{"phonenumber": 124}';
        const postOptions = createHttpPostOptions('/nested/ace', postData);
        const expected = {
          ace: 'greg'
        };
        verifyResponseBody(postOptions, postData, expected, done);
      });

      it('returns correct file for switch param in query string', (done) => {
        const reqOptions = createHttpReqOptions('/nested/ace?customerId=1234');
        const expected = {
          ace: 'greg',
          note: 'request contained customerId = 1234'
        };
        verifyResponseBody(reqOptions, null, expected, done);
      });

      it('returns correct httpStatus when switches match', (done) => {
        stRequest
          .post('/login')
          .set('Content-Type', 'application/json')
          .send('{"userId": "user1", "password": "good"}')
          .expect(200, done);
      });

      it('returns correct httpStatus when switch does not match, with contentType set', (done) => {
        stRequest
          .post('/login')
          .set('Content-Type', 'application/json')
          .send('{"userId": "user1", "password": "bad"}')
          .expect(401, done);
      });

      it('returns correct httpStatus when switch does not match', (done) => {
        stRequest
          .post('/login')
          .send('{"userId": "user1", "password": "bad"}')
          .expect(401, done);
      });

      it('returns 404 when switch does not match and no httpStatus was set', (done) => {
        stRequest
          .post('/verify')
          .send('{"foo": "bar"}')
          .expect(404, done);
      });
    });

    describe('jsonPath switch response', () => {
      it('returns proper single object from mockFile', (done) => {
        const reqOptions = createHttpReqOptions('/users/1');
        verifyResponseBody(reqOptions, null, { name: 'Han Solo', role: 'pilot', id: 1 }, done);
      });
      it('returns proper array of results', (done) => {
        const reqOptions = createHttpReqOptions('/users/role/droid');
        const expected = [
          {
            name: 'C3P0',
            role: 'droid',
            id: 3
          },
          {
            name: 'R2D2',
            role: 'droid',
            id: 4
          }
        ];
        verifyResponseBody(reqOptions, null, expected, done);
      });
    });

    describe('http status: ', () => {
      it('returns 404 for incorrect path', (done) => {
        stRequest
          .get('/badurl')
          .expect(404)
          .end(() => {
            // console.log('got a 404 as expected');
            done();
          });
      });

      it('returns httpStatus of 200 if not set', (done) => {
        stRequest.get('/first').expect(200, done);
      });

      it('returns httpStatus specified in config file, when contentType is passed in', (done) => {
        stRequest.put('/protected').expect(403, done);
      });

      it('returns httpStatus 204 specified in config file', (done) => {
        stRequest.delete('/second').expect(204, done);
      });

      it('returns httpStatus 404 if no mockFile is set for a web service', (done) => {
        stRequest.get('/noMockFile').expect(404, done);
      });

      it('returns specified httpStatus even if mockFile is set incorrectly and no contentType is configured', (done) => {
        stRequest.get('/missingMockFile').expect(203, done);
      });
    });

    describe('http headers: ', () => {
      it('returns the headers as specified in the config file', (done) => {
        const reqOptions = createHttpReqOptions('/firstheaders');
        verifyResponseHeaders(
          reqOptions,
          {
            'x-requested-by':
              '4c2df03a17a803c063f21aa86a36f6f55bdde1f85b89e49ee1b383f281d18c09c2ba30654090df3531cd2318e3c',
            dummyheader: 'dummyvalue',
            'content-type': 'foobar'
          },
          done
        );
      });

      it('allows domains specified in config file', (done) => {
        const reqOptions = createHttpReqOptions('/first');
        verifyResponseHeaders(reqOptions, { 'access-control-allow-origin': 'abc' }, done);
      });

      it('allows headers as specified in config file', (done) => {
        const reqOptions = createHttpReqOptions('/first');
        verifyResponseHeaders(
          reqOptions,
          { 'access-control-allow-headers': 'Content-Type,my-custom-header' },
          done
        );
      });

      it('sets Access-Control-Allow-Credentials header if corsCredentials option is set', (done) => {
        const reqOptions = createHttpReqOptions('/first');
        verifyResponseHeaders(reqOptions, { 'access-control-allow-credentials': 'true' }, done);
      });
    });

    describe('proxy: ', () => {
      it('forwards get request to non-mocked endpoint', (done) => {
        stRequest.get('/non-mocked').expect(200, { data: 'real' }, done);
      });

      it('forwards post request to non-mocked endpoint', (done) => {
        stRequest
          .post('/non-mocked')
          .set('Content-Type', 'application/json')
          .send({ foo: 'bar' })
          .expect(200, { data: 'real' }, done);
      });
    });

    describe('admin functions for on-the-fly configuration', () => {
      // function reloadConfigFile(mocker, done) {
      //   mocker.setConfigFile("test/test-config.json");
      //   var req, reqOptions = createHttpReqOptions();
      //   reqOptions.path = "/admin/reload";
      //   req = http.request(reqOptions, function(res) {
      //     res.setEncoding('utf8');
      //     res.on('data', function () {
      //       expect(res.statusCode).to.equal(200);
      //       if (done) {
      //         done();
      //       }
      //     });
      //   });
      //   req.end();
      // }

      it('returns correct mock file after admin/setMock was called', (done) => {
        const postData = { verb: 'get', serviceUrl: 'third', mockFile: 'king.json' };

        // const postOptions = createHttpPostOptions('/admin/setMock', postData);
        // const expected = {
        //   verb: 'get',
        //   serviceUrl: 'third',
        //   mockFile: 'king.json',
        //   httpStatus: 200,
        // };
        // verifyResponseBody(postOptions, postData, expected);
        // verifyResponseBody(createHttpReqOptions('/third'), null, {king: 'greg'}, done);

        stRequest
          .post('/admin/setMock')
          .set('Content-Type', 'application/json')
          .send(postData)
          .expect(200, () => {
            stRequest.get('/third').expect(200, { king: 'greg' }, done);
          });
      });

      it('returns correct mock file with http status code after admin/setMock was called', (done) => {
        const postData = {
          verb: 'post',
          serviceUrl: 'third',
          mockFile: 'king.json',
          httpStatus: 201
        };
        // const postOptions = createHttpPostOptions('/admin/setMock', postData);
        // const expected = {
        //   verb: 'post',
        //   serviceUrl: 'third',
        //   mockFile: 'king.json',
        //   httpStatus: 201,
        // };

        stRequest
          .post('/admin/setMock')
          .set('Content-Type', 'application/json')
          .send(postData)
          .expect(200, () => {
            stRequest.post('/third').expect(201, { king: 'greg' }, done);
          });
      });

      // it('returns 404 for incorrect path after reload was called', function(done) {
      //   verifyResponseBody(postOptions, postData, expected);
      //   verifyResponseBody(createHttpReqOptions('/third'), null, {king: 'greg'});
      //   reloadConfigFile(mocker);
      //   verifyResponseStatus(createHttpReqOptions('/third'), null, 404, done);
      // });

      // TODO: Fix this test... it fails intermittently, due to timing problems.
      it.skip('returns correct mock file after admin/setMock was called twice', (done) => {
        // verifyResponseBody(postOptions, postData, expected);

        // verifyResponseBody(createHttpReqOptions('/third'), null, {king: 'greg'});

        // // change route, and verify again
        // verifyResponseBody(postOptions, postData, expected);
        // verifyResponseBody(createHttpReqOptions('/third'), null, {ace: 'greg'}, done);

        stRequest
          .post('/admin/setMock')
          .set('Content-Type', 'application/json')
          // .send(postData)
          .expect(200, () => {
            stRequest.get('/third').expect(200, { kingyy: 'greg' }, () => {
              stRequest
                .post('/admin/setMock')
                .set('Content-Type', 'application/json')
                .send({ verb: 'get', serviceUrl: 'third', mockFile: 'king.json' })
                .expect(200, () => {
                  stRequest.get('/third').expect(200, { ace: 'greg' }, done);
                });
            });
          });
      });
    });
  });

  describe('with custom basepath: ', () => {
    let mocker;
    before((done) => {
      const options = {
        quiet: true,
        mockDirectory: './samplemocks/',
        proxyURL: `http://localhost:${MOCK_PORT}`,
        basepath: '/apimocker'
      };
      mocker = apiMocker.createServer(options).setConfigFile('test/test-config.json');
      mocker.start(null, done);
    });

    it('uses custom basepath if specified', (done) => {
      stRequest.get('/apimocker/nested/ace').expect(200, { ace: 'greg' }, done);
    });

    after((done) => {
      mocker.stop(done);
    });
  });
});

describe('apimocker with custom middleware: ', () => {
  let customMiddleware;
  let mocker;

  before((done) => {
    customMiddleware = (req, res, next) => {
      res.header('foo', 'bar');
      next();
    };
    mocker = apiMocker
      .createServer({ quiet: true, mockDirectory: './samplemocks/' })
      .setConfigFile('test/test-config.json');
    mocker.middlewares.unshift(customMiddleware);
    mocker.start(null, done);
  });

  it('uses custom middleware if added by user', (done) => {
    const reqOptions = createHttpReqOptions('/first');
    verifyResponseHeaders(reqOptions, { foo: 'bar' }, done);
  });

  after((done) => {
    mocker.stop(done);
  });
});

describe('apimocker with file upload: ', () => {
  let mocker;
  before((done) => {
    const config = {
      quiet: true,
      mockDirectory: './uploads/',
      uploadRoot: './uploads/'
    };

    mocker = apiMocker.createServer(config).setConfigFile('test/test-config.json');
    mocker.start(null, done);
  });

  after((done) => {
    mocker.stop(done);
    clearDirSync('./uploads/');
  });

  it('single file upload', (done) => {
    const expected = { king: 'greg' };

    stRequest
      .post('/upload?name=king')
      .attach('sampleFile', 'samplemocks/king.json')
      .expect(200)
      .end((err, res) => {
        expect(err).to.be.null;
        expect(res.body).to.deep.equal(expected);
        if (done) {
          done();
        }
      });
  });

  it('multi file upload', (done) => {
    stRequest
      .post('/upload/many')
      .attach('sampleFile', 'samplemocks/sorry.json')
      .attach('sampleFile', 'samplemocks/users.json')
      .attach('sampleFile', 'samplemocks/ace.json')
      .expect(200)
      .end((err) => {
        expect(err).to.be.null;
        expect(fs.existsSync('uploads/sorry.json')).to.be.true;
        expect(fs.existsSync('uploads/users.json')).to.be.true;
        expect(fs.existsSync('uploads/ace.json')).to.be.true;
        if (done) {
          done();
        }
      });
  });
});

describe('apimocker body filtering: ', () => {
  let mocker;
  before((done) => {
    const config = {
      quiet: true,
      allowAvoidPreFlight: true,
      mockDirectory: './samplemocks/'
    };

    mocker = apiMocker.createServer(config).setConfigFile('test/test-config.json');
    mocker.start(null, done);
  });

  after((done) => {
    mocker.stop(done);
  });

  it('matches a raw body', (done) => {
    const postData = '{ "text": "Raw body filter test" }';
    const expected = { king: 'greg' };
    verifyResponseBody(createHttpPostOptions('/body/filter', postData), postData, expected, done);
  });

  it('matches a hashed body', (done) => {
    const postData = '{ "text": "Hashed body filtering test" }';
    const expected = { king: 'greg' };
    verifyResponseBody(createHttpPostOptions('/body/filter', postData), postData, expected, done);
  });

  it('fails to match unspecified body', (done) => {
    stRequest
      .post('/body/filter')
      .send('{ "text": "Missing body filtering test" }')
      .expect(404, done);
  });
});
