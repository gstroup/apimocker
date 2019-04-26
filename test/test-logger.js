/* eslint-disable no-unused-expressions, no-console */
const { expect } = require('chai');
const sinon = require('sinon');
const { createLogger, createMiddleware } = require('../lib/logger.js');

describe('unit tests: logger : ', () => {
  beforeEach(() => {
    sinon.spy(console, 'log');
  });

  afterEach(() => {
    console.log.restore();
  });

  describe('createLogger', () => {
    it('logs to the console', () => {
      const logger = createLogger({ quiet: false });
      const msg = 'Boba Fett';
      logger.info(msg);
      logger.warn(msg);
      logger.error(msg);
      expect(console.log.calledThrice).to.be.true;
      expect(console.log.args[0][1]).to.equal(msg);
    });

    it('does not log when quiet', () => {
      const logger = createLogger({ quiet: true });
      const msg = 'Greedo';
      logger.info(msg);
      logger.warn(msg);
      logger.error(msg);
      expect(console.log.called).to.be.false;
    });
  });

  describe('createMiddleware', () => {
    const req = {
      method: 'POST',
      originalUrl: 'some/mock/route'
    };

    const res = {
      on: (name, cb) => cb(),
      statusCode: 400,
      locals: {
        mockFile: 'foo.json'
      }
    };

    it('logs details of mock request and response', () => {
      const next = sinon.spy();
      const middleware = createMiddleware({ quiet: false });

      middleware(req, res, next);

      const [, msg] = console.log.args[0];
      expect(console.log.called).to.be.true;
      expect(next.called).to.be.true;
      expect(msg).to.include(req.method);
      expect(msg).to.include(req.originalUrl);
      expect(msg).to.include(res.statusCode);
      expect(msg).to.include(res.locals.mockFile);
      expect(msg).to.match(/\d+ms/);
    });

    it('does not log when quiet', () => {
      const next = sinon.spy();
      const middleware = createMiddleware({ quiet: true });

      middleware(req, res, next);

      expect(console.log.called).to.be.false;
      expect(next.called).to.be.true;
    });
  });
});
