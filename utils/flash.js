// utils/flash.js   ← this file must exist!

// Save a flash message in session
export const setFlash = (req, type, message) => {
  req.session.flash = { type, message };
  // type = "success" or "error"
  // message = "Category added!"
};

// Get the flash message and delete it (so it shows only once)
export const getFlash = (req) => {
  const flash = req.session.flash || null;
  delete req.session.flash;   // important: remove after reading
  return flash;
};

