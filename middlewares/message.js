export const message=(req, res, next) => {
  const sessionMessage = req.session?.message || null;
  const sessionSuccess = typeof req.session?.success !== "undefined" ? req.session.success : null;
  const queryMessage = req.query?.message || null;
  const querySuccess = req.query?.success ? true : null;
  const finalMessage = sessionMessage || queryMessage || (querySuccess ? req.query.success : null) || null;
  const finalSuccess = (sessionSuccess !== null ? sessionSuccess : (querySuccess !== null ? true : false)) || false;
  res.locals.message = finalMessage;
  res.locals.success = finalSuccess;
  if (req.session) {
    delete req.session.message;
    delete req.session.success;
  }

  next();
};