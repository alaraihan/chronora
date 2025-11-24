import User from "../../models/userSchema.js";
import { sendOtp, generateOtp } from "../../utils/mail.js";
import bcrypt from "bcrypt";
import { setFlash, getFlash } from "../../utils/flash.js";

const render = (req, res, view, options = {}) => {
  const flash = getFlash(req); 
  return res.render(view, { flash, ...options });
};

const pageNotfound = async (req, res) => {
  try {
    return render(req, res, "user/pageNotfound", {
      title: "Chronora - 404 Page",
    });
  } catch (error) {
    console.log("Page not found");
    res.status(404).send();
  }
};

const googleCallback = (req, res) => {
  try {
    console.log("Google login successful, User:", req.user);

    req.session.userId = req.user._id;
    req.session.user = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
    };

    setFlash(req, "success", "Login successful!");
    return res.redirect("/home");
  } catch (err) {
    console.error("googleCallback error:", err);
    setFlash(req, "error", "Google login failed. Try again.");
    return res.redirect("/login");
  }
};

const loadAboutpage = async (req, res) => {
  try {
    return render(req, res, "user/about", {
      title: "Chronora - About",
    });
  } catch (error) {
    console.log("About page not found");
    res.status(404).send(error);
  }
};

const loadContactpage = async (req, res) => {
  try {
    return render(req, res, "user/contact", {
      title: "Chronora - Contact",
    });
  } catch (error) {
    console.log("Contact page not found");
    res.status(404).send(error);
  }
};

const loadLandingpage = async (req, res) => {
  try {
    return render(req, res, "user/landing", {
      title: "Chronora - Landing",
    });
  } catch (error) {
    console.log("Landing page not found");
    res.status(500).send("server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    return render(req, res, "user/home", {
      user: req.session.user,
      title: "Chronora - Home",
    });
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("server error");
  }
};

export default {
  googleCallback,
  pageNotfound,
  loadAboutpage,
  loadContactpage,
  loadLandingpage,
  loadHomepage,
};
