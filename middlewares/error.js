export const errorMd = (err, req, res, next) => {
  console.error(err.stack);

  const status = err.status || 500;

  if (status === 404) {
    res.status(404).render('user/pageNotfound', {
      title: 'Page Not Found',
      url: req.originalUrl,
    });
  } else {
    res.status(status).render('error', {
      title: 'Something went wrong!',
      message: err.message || 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err : {},
    });
  }
};
