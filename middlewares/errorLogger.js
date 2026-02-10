import logger from '../helpers/logger.js';

export const errorLogger = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
};
