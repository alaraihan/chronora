export const layouts=(req, res, next) => {
  if (req.path.startsWith('/admin') && req.path !== '/admin/login') {
    res.locals.layout = 'layouts/adminLayouts/main';
  } else if (!req.path.startsWith('/admin')) {
    res.locals.layout = 'layouts/userLayouts/main';
  } else {
    res.locals.layout = false;
  }
  next();
};