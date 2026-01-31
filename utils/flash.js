
export const setFlash = (req, type, message) => {
  req.session.flash = { type, message };

};

export const getFlash = (req) => {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
};

