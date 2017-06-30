/* global describe, it, before, after */
var chai = require('chai'),
	apiMocker = require('../lib/apimocker.js'),
	expect = chai.expect,
	http = require('http'),
	_ = require('underscore'),
	supertest = require('supertest'),
	stRequest = supertest('http://localhost:7879'),
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
	mocker,
	testEndpoint,
	MOCK_PORT = 7881;

function verifyResponseHeaders(httpReqOptions, expected, done) {
	var req = http.request(httpReqOptions, function(res) {
		res.setEncoding('utf8');
		res.on('data', function () {
			// console.log('Response headers: ' + JSON.stringify(res.headers));
			var expectedKeys = _.keys(expected);
			_.each(expectedKeys, function(key) {
				expect(res.headers[key]).to.equal(expected[key]);
			});
			done();
		});
	});
	req.end();
}

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

describe('Functional tests using an http client to test "end-to-end": ', function() {

	describe('apimocker server:', function() {
		before(function startMockerForFuncTests(done) {
			var options = {
				quiet: true,
				proxyURL: 'http://localhost:' + MOCK_PORT
			};
			mocker = apiMocker.createServer(options).setConfigFile('test/test-config.json');
			mocker.start(null, done);
		});

		before(function (done) {
			testEndpoint = http.createServer(function (req, res) {
				if (req.url === '/non-mocked') {
					res.writeHead(200, {'Content-Type': 'application/json'});
					res.end(JSON.stringify({data: 'real'}));
				} else {
					res.writeHead(404);
					res.end();
				}
			}).listen(MOCK_PORT, done);
		});

		after(function (done) {
			mocker.stop(done);
		});

		describe('basic requests: ', function() {
			it('returns correct data for basic get request', function(done) {
				var reqOptions = httpReqOptions('/first');
				verifyResponseBody(reqOptions, null, {'king': 'greg'}, done);
			});

			it('returns correct data for basic post request', function(done) {
				var reqOptions = httpReqOptions('/nested/ace');
				reqOptions.method = 'POST';
				verifyResponseBody(reqOptions, null, {'ace': 'greg'}, done);
			});

			it('returns correct data for post to path with mockFile varying on verb', function(done) {
				var reqOptions = httpReqOptions('/royals');
				reqOptions.method = 'POST';
				verifyResponseBody(reqOptions, null, {'king': 'greg'}, done);
			});

			it('returns correct data for get to path with mockFile varying on verb', function(done) {
				var reqOptions = httpReqOptions('/royals');
				verifyResponseBody(reqOptions, null, {'ace': 'greg'}, done);
			});

			it('Returns data in template from the route', function(done){
				var reqOptions = httpReqOptions('/template/john/4');
				verifyResponseBody(reqOptions, null, {'name':'john', 'number':4}, done);
			});

			it('returns correct data for get to templateSwitch substituting GET params into mockFile ', function(done) {
				var reqOptions = httpReqOptions('/templateSwitchGetParams?appID=123456789&appName=myAppName&userName=MyName&userAge=21');
				var expected = {'appID': 123456789,
												'appName': 'myAppName',
												'userName': 'MyName',
												'userAge': 21
											};
				verifyResponseBody(reqOptions, null, expected, done);
			});


			it('returns correct data for post to templateSwitch substituting POST data parsed using jsonPath into mockFile', function(done) {
				var postData = '{ "data": { "appID": 123456789, "appName": "myAppName", "user": { "userName": "MyName", "userAge": 21 } } }',
					postOptions =	httpPostOptions('/templateSwitchPostJsonPath', postData),
					expected = {'appID': 123456789,
												'appName': 'myAppName',
												'userName': 'MyName',
												'userAge': 21
											};
				verifyResponseBody(postOptions, postData, expected, done);
			});

			it('returns correct data for an alternate path', function (done) {
				var reqOptions = httpReqOptions('/1st');
				verifyResponseBody(reqOptions, null, {'king': 'greg'}, done);
			});
		});

		describe('content type: ', function() {
			it('returns a custom content type', function(done) {
				var reqOptions = httpReqOptions('/first');
				verifyResponseHeaders(reqOptions, {'content-type': 'foobar'}, done);
			});

			it('returns correct content-type for json response, with nested path', function(done) {
				var reqOptions = httpReqOptions('/nested/ace');
				verifyResponseHeaders(reqOptions, {'content-type': 'application/json'}, done);
			});

			it('returns correct content-type for xml response', function(done) {
				var reqOptions = httpReqOptions('/var/123');
				verifyResponseHeaders(reqOptions, {'content-type': 'application/xml'}, done);
			});
		});

		describe('switch on request param: ', function() {
			it('returns correct file for switch param in json request', function(done) {
				var postData = '{"customerId": 1234}',
					postOptions =	httpPostOptions('/nested/ace', postData),
					expected = {
						'ace': 'greg',
						'note': 'request contained customerId = 1234'
					};
				verifyResponseBody(postOptions, postData, expected, done);
			});

			it('returns base file when no match for switch param in json request', function(done) {
				var postData = '{"customerId": 124}',
					postOptions =	httpPostOptions('/nested/ace', postData),
					expected = {
						'ace': 'greg'
					};
				verifyResponseBody(postOptions, postData, expected, done);
			});

			it('returns base file when no switch param passed in json request', function(done) {
				var postData = '{"phonenumber": 124}',
					postOptions =	httpPostOptions('/nested/ace', postData),
					expected = {
						'ace': 'greg'
					};
				verifyResponseBody(postOptions, postData, expected, done);
			});

			it('returns correct file for switch param in query string', function(done) {
				var reqOptions =	httpReqOptions('/nested/ace?customerId=1234'),
					expected = {
						'ace': 'greg',
						'note': 'request contained customerId = 1234'
					};
				verifyResponseBody(reqOptions, null, expected, done);
			});

			it('returns correct httpStatus when switches match', function(done) {
				stRequest.post('/login')
				.set('Content-Type', 'application/json')
					.send('{"userId": "user1", "password": "good"}')
					.expect(200, done);
			});

			it('returns correct httpStatus when switch does not match, with contentType set', function(done) {
				stRequest.post('/login')
					.set('Content-Type', 'application/json')
					.send('{"userId": "user1", "password": "bad"}')
					.expect(401, done);
			});

			it('returns correct httpStatus when switch does not match', function(done) {
				stRequest.post('/login')
					.send('{"userId": "user1", "password": "bad"}')
					.expect(401, done);
			});

			it('returns 404 when switch does not match and no httpStatus was set', function(done) {
				stRequest.post('/verify')
					.send('{"foo": "bar"}')
					.expect(404, done);
			});
		});

		describe('http status: ', function() {
			it('returns 404 for incorrect path', function(done) {
				stRequest.get('/badurl')
					.expect(404)
					.end(function(err) {
						// console.log('got a 404 as expected');
						done();
					});
			});

			it('returns httpStatus of 200 if not set', function(done) {
				stRequest.get('/first').expect(200, done);
			});

			it('returns httpStatus specified in config file, when contentType is passed in', function(done) {
				stRequest.put('/protected').expect(403, done);
			});

			it('returns httpStatus 204 specified in config file', function(done) {
				stRequest.delete('/second')
					.expect(204, done);
			});

			it('returns httpStatus 404 if no mockFile is set for a web service', function(done) {
				stRequest.get('/noMockFile').expect(404, done);
			});

			it('returns specified httpStatus even if mockFile is set incorrectly and no contentType is configured', function(done) {
				stRequest.get('/missingMockFile').expect(203, done);
			});
		});

		describe('http headers: ', function() {
			it('returns the headers as specified in the config file', function(done) {
				var reqOptions = httpReqOptions('/firstheaders');
				verifyResponseHeaders(reqOptions, {'x-requested-by': '4c2df03a17a803c063f21aa86a36f6f55bdde1f85b89e49ee1b383f281d18c09c2ba30654090df3531cd2318e3c', 'dummyheader': 'dummyvalue', 'content-type': 'foobar'}, done);
			});

			it('allows domains specified in config file', function(done) {
				var reqOptions = httpReqOptions('/first');
				verifyResponseHeaders(reqOptions, {'access-control-allow-origin': 'abc'}, done);
			});

			it('allows headers as specified in config file', function(done) {
				var reqOptions = httpReqOptions('/first');
				verifyResponseHeaders(reqOptions, {'access-control-allow-headers': 'Content-Type,my-custom-header'}, done);
			});

			it('sets Access-Control-Allow-Credentials header if corsCredentials option is set', function(done) {
				var reqOptions = httpReqOptions('/first');
				verifyResponseHeaders(reqOptions, {'access-control-allow-credentials': 'true'}, done);
			});
		});

		describe('proxy: ', function () {
			it('forwards get request to non-mocked endpoint', function (done) {
				stRequest.get('/non-mocked')
					.expect(200, {data: 'real'}, done);
			});

			it('forwards post request to non-mocked endpoint', function (done) {
				stRequest.post('/non-mocked')
					.set('Content-Type', 'application/json')
					.send({foo: 'bar'})
					.expect(200, {data: 'real'}, done);
			});
		});

		describe('admin functions for on-the-fly configuration', function() {

		// function reloadConfigFile(mocker, done) {
		//	 mocker.setConfigFile("test/test-config.json");
		//	 var req, reqOptions = httpReqOptions();
		//	 reqOptions.path = "/admin/reload";
		//	 req = http.request(reqOptions, function(res) {
		//		 res.setEncoding('utf8');
		//		 res.on('data', function () {
		//			 expect(res.statusCode).to.equal(200);
		//			 if (done) {
		//				 done();
		//			 }
		//		 });
		//	 });
		//	 req.end();
		// }

			it('returns correct mock file after admin/setMock was called', function(done) {
				var postData = {'verb':'get', 'serviceUrl':'third', 'mockFile':'king.json'},
					postOptions =	httpPostOptions('/admin/setMock', postData),
					expected = {
						'verb':'get',
						'serviceUrl':'third',
						'mockFile':'king.json',
						'httpStatus': 200
					};

				// verifyResponseBody(postOptions, postData, expected);
				// verifyResponseBody(httpReqOptions('/third'), null, {king: 'greg'}, done);

				stRequest.post('/admin/setMock')
					.set('Content-Type', 'application/json')
					.send(postData)
					.expect(200, function() {
						stRequest.get('/third')
							.expect(200, {king: 'greg'}, done);
					});
			});

			it('returns correct mock file with http status code after admin/setMock was called', function(done) {
				var postData = {'verb':'post', 'serviceUrl':'third', 'mockFile':'king.json', 'httpStatus': 201},
					postOptions =	httpPostOptions('/admin/setMock', postData),
					expected = {
						'verb':'post',
						'serviceUrl':'third',
						'mockFile':'king.json',
						'httpStatus': 201
					};

				stRequest.post('/admin/setMock')
					.set('Content-Type', 'application/json')
					.send(postData)
					.expect(200, function() {
						stRequest.post('/third')
							.expect(201, {king: 'greg'}, done);
					});
			});

			// it('returns 404 for incorrect path after reload was called', function(done) {
			//	 verifyResponseBody(postOptions, postData, expected);
			//	 verifyResponseBody(httpReqOptions('/third'), null, {king: 'greg'});
			//	 reloadConfigFile(mocker);
			//	 verifyResponseStatus(httpReqOptions('/third'), null, 404, done);
			// });

			// TODO: Fix this test... it fails intermittently, due to timing problems.
			xit('returns correct mock file after admin/setMock was called twice', function(done) {
				// verifyResponseBody(postOptions, postData, expected);

				// verifyResponseBody(httpReqOptions('/third'), null, {king: 'greg'});

				// // change route, and verify again
				// verifyResponseBody(postOptions, postData, expected);
				// verifyResponseBody(httpReqOptions('/third'), null, {ace: 'greg'}, done);

				stRequest.post('/admin/setMock')
					.set('Content-Type', 'application/json')
					.send(postData)
					.expect(200, function() {
						stRequest.get('/third')
							.expect(200, {kingyy: 'greg'}, function() {
								stRequest.post('/admin/setMock')
									.set('Content-Type', 'application/json')
									.send({'verb':'get', 'serviceUrl':'third', 'mockFile':'king.json'})
									.expect(200, function() {
										stRequest.get('/third')
											.expect(200, {ace: 'greg'}, done);
									});
							});
					});

			});
		});

	});

	describe('with custom basepath: ', function() {
		before(function (done) {
			var options = {
				quiet: true,
				proxyURL: 'http://localhost:' + MOCK_PORT,
				basepath: '/apimocker'
			};
			mocker = apiMocker.createServer(options).setConfigFile('test/test-config.json');
			mocker.start(null, done);
		});

		it('uses custom basepath if specified', function(done) {
			stRequest.get('/apimocker/nested/ace')
				.expect(200, {'ace': 'greg'}, done);
		});

		after(function(done) {
			mocker.stop(done);
		});
	});

});

describe('apimocker with custom middleware: ', function () {
	var apiMocker = require('../lib/apimocker.js'),
		customMiddleware;
	before(function(done) {
		customMiddleware = function(req, res, next) {
			res.header('foo', 'bar');
			next();
		};
		var mocker = apiMocker.createServer({quiet: true}).setConfigFile('test/test-config.json');
		mocker.middlewares.unshift(customMiddleware);
		mocker.start(null, done);
	});

	it('uses custom middleware if added by user', function(done) {
		var reqOptions = httpReqOptions('/first');
		verifyResponseHeaders(reqOptions, {'foo': 'bar'}, done);
	});

	after(function(done) {
		mocker.stop(done);
	});	
});