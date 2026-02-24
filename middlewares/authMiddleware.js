import User from "../models/userSchema.js";
import Admin from "../models/adminSchema.js";
import HttpStatus from "../utils/httpStatus.js";

export const setUser = (req, res, next) => {
  res.locals.user = req.session?.userId || null;
  next();
};

export const checkLogin = (req, res, next) => {
  if (req.session?.userId) {
    return res.redirect("/");
  }
  next();
};

export const isLoggedIn = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return handleUnauthorized(req, res);
    }

    const user = await User.findById(req.session.userId)
      .select("_id isBlocked");

    if (!user || user.isBlocked) {
      req.session.destroy(() => { });
      return handleUnauthorized(req, res);
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    console.error("isLoggedIn error:", error);
    handleUnauthorized(req, res);
  }
};

const handleUnauthorized = (req, res) => {
  if (req.xhr || req.headers.accept?.includes("json")) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: "Please login first"
    });
  }

  return res.redirect("/login");
};


export const isAdmin = async (req, res, next) => {
  try {
    const adminId = req.session?.adminId;
    if (!adminId) {
      return res.redirect("/admin/login");
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      req.session.adminId = null;
      return res.redirect("/admin/login");
    }

    req.admin = admin;
    res.locals.currentAdmin = admin;
    next();
  } catch (error) {
    console.log("isAdmin Error:", error);
    res.redirect("/admin/login");
  }
};

export const checkBlockedUser = async (req, res, next) => {
  const publicPaths = [
    "/login",
    "/register",
    "/logout",
    "/css",
    "/js",
    "/images",
    "/favicon.ico",
    "/admin"
  ];

  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  if (!req.session?.userId) {
    return next();
  }

  try {
    const user = await User.findById(req.session.userId).select("isBlocked");

    if (!user || user.isBlocked) {
      req.session.destroy();
      return res.status(HttpStatus.FORBIDDEN).render("user/pageNotfound", {
        user: null,
        title: "Not found"
      });
    }

    next();
  } catch (error) {
    console.error("checkBlockedUser error:", error);
    next();
  }
};
