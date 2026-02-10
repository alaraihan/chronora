import logger from '../helpers/logger.js';

export const requestLogger = (req, res, next) => {
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
};
