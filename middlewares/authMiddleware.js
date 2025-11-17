// middlewares/authMiddleware.js
import User from "../models/userSchema.js";
import Admin from "../models/adminSchema.js";

export const setUser = (req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
};

export const isUser = (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");

  User.findById(req.session.user)
    .then(data => {
      if (data && !data.isBlocked) next();
      else res.redirect("/login");
    })
    .catch(err => {
      console.error("isUser error:", err);
      res.status(500).send("Internal server error");
    });
};

export const isAdmin = (req, res, next) => {
  if (!req.session.admin) return res.redirect("/admin/login");

  Admin.findById(req.session.admin)
    .then(data => {
      if (data) next();
      else res.redirect("/admin/login");
    })
    .catch(err => {
      console.error("isAdmin error:", err);
      res.status(500).send("Internal server error");
    });
};
