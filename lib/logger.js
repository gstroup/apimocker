const chalk = require('chalk');
const pkg = require('../package.json');

const prefix = `[${pkg.name}]`;
const colors = {
  info: chalk.gray,
  warn: chalk.keyword('orange'),
  error: chalk.red,
  success: chalk.green
};

// eslint-disable-next-line no-console
const log = (color, ...msg) => console.log(color(prefix), ...msg);

const logger = {
  info: (...msg) => log(colors.info, ...msg),
  warn: (...msg) => log(colors.warn, ...msg),
  error: (...msg) => log(colors.error, ...msg)
};

const createLogger = ({ quiet }) => new Proxy(logger, {
  // Silence logger methods by stubbing them out.
  get: (target, prop) => (quiet ? () => {} : target[prop])
});

const createMiddleware = ({ quiet }) => (req, res, next) => {
  if (!quiet) {
    const start = Date.now();
    res.on('finish', () => {
      const method = req.method.toUpperCase();
      const url = req.originalUrl;
      const status = res.statusCode;
      const mockFile = res.locals.mockFile || '';
      const responseTime = Date.now() - start;

      if (res.statusCode >= 400) {
        logger.error(
          `${chalk.bold(method)} ${url} ⏎ ${colors.error(status)} ${mockFile} - ${responseTime}ms`
        );
      } else {
        logger.info(
          `${chalk.bold(method)} ${url} ⏎ ${colors.success(status)} ${mockFile} - ${responseTime}ms`
        );
      }
    });
  }
  next();
};

module.exports = {
  createLogger,
  createMiddleware
};
