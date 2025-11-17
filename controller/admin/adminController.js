import Admin from "../../models/adminSchema.js";
import bcrypt from "bcrypt";

const loadLogin = (req, res) => {
  if (req.session.admin) return res.redirect("/admin/dashboard");

  res.render("admin/adminLogin", {
    message: null,
    title: "Admin Login - Chronora",
    layout: false
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("admin/adminLogin", {
        message: "Please fill email and password",
        title: "Admin Login - Chronora",
        layout: false

      });
    }

    // normalize the email BEFORE querying
    const emailNormalized = email.trim().toLowerCase();

    const admin = await Admin.findOne({ email: emailNormalized });

    // Safe debug info (do NOT log full hash in production)
    console.log("Login attempt for:", emailNormalized, "admin found:", !!admin);

    if (!admin) {
      return res.render("admin/adminLogin", {
        message: "Invalid email or password",
        title: "Admin Login - Chronora",
layout: false
      });
    }

    // ensure password field exists before comparing
    if (!admin.password) {
      console.error("Admin record found but password field is missing");
      return res.render("admin/adminLogin", {
        message: "Server error. Please try again.",
        title: "Admin Login - Chronora",
        layout: false
      });
    }

    // compare using the document's password (NOT the model)
    const match = await bcrypt.compare(password, admin.password);

    if (!match) {
      return res.render("admin/adminLogin", {
        message: "Invalid email or password",
        title: "Admin Login - Chronora",
        layout: false
      });
    }

    req.session.admin = {
      id: admin._id,
      email: admin.email,
      name: admin.fullName || "Admin"
    };

    return res.redirect("/admin/dashboard");

  } catch (err) {
    console.error("Admin login error:", err);
    return res.render("admin/adminLogin", {
      message: "Server error. Please try again.",
      title: "Admin Login - Chronora",
      layout: false
    });
  }
};


const dashboard = (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");

  res.render("admin/dashboard", {
    admin: req.session.admin,
    title: "Dashboard - Chronora Admin",
  });
};

const logout = (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");

};

export default { loadLogin, login, dashboard, logout };