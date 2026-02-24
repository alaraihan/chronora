import logger from '../helpers/logger.js';
import HttpStatus from '../utils/httpStatus.js';

export const errorLogger = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
};
