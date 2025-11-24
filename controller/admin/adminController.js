import Admin from "../../models/adminSchema.js";
import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import sendResponse from "../../utils/response.js";  

const render = (req, res, view, options = {}) => {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return res.render(view, { flash, ...options });
};

const loadLogin = (req, res) => {
  if (req.session.admin) return res.redirect("/admin/dashboard");

  return render(req, res, "admin/adminLogin", {
    title: "Admin Login - Chronora",
    layout: "layouts/adminLayouts/auth",
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendResponse(req, res, "error", "Please fill email and password", {}, "/admin/login");
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return sendResponse(req, res, "error", "Invalid email or password", {}, "/admin/login");
    }

    req.session.adminId = admin._id.toString();
    req.session.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.fullName || "Admin",
    };

    return sendResponse(req, res, "success", "Welcome back, Admin!", {}, "/admin/dashboard");

  } catch (err) {
    console.error("Admin login error:", err);
    return sendResponse(req, res, "error", "Server error. Try again later.", {}, "/admin/login");
  }
};

const dashboard = (req, res) => {
  if (!req.session.admin) {
    return sendResponse(req, res, "error", "Please log in first", {}, "/admin/login");
  }

  return render(req, res, "admin/dashboard", {
    title: "Dashboard - Chronora Admin",
    layout: "layouts/adminLayouts/main",
    page: "dashboard",
    admin: req.session.admin,
  });
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.clearCookie("sid");
    return sendResponse(req, res, "success", "Logged out successfully!", {}, "/admin/login");
  });
};


const loadCustomers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = Number(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { fullName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const totalCustomers = await User.countDocuments(filter);
    const customers = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    return render(req, res, "admin/customers", {
      title: "Customers - Chronora Admin",
      layout: "layouts/adminLayouts/main",
      page: "customers",
      customers,
      search,
      currentPage: page,
      totalPages: Math.ceil(totalCustomers / limit),
      totalCustomers,
    });
  } catch (error) {
    console.error("Load customers error:", error);
    return sendResponse(req, res, "error", "Failed to load customers", {}, "/admin/dashboard");
  }
};


const toggleBlockCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendResponse(req, res, "error", "User not found");
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    const msg = user.isBlocked ? "User blocked successfully" : "User unblocked successfully";

    return sendResponse(req, res, "success", msg, {
      isBlocked: user.isBlocked
    });

  } catch (error) {
    console.error("Toggle block error:", error);
    return sendResponse(req, res, "error", "Server error");
  }
};

const loadLoginWithLogoutMessage = (req, res) => {
  if (req.query.logout === "success") {
    req.session.flash = { type: "success", message: "Logged out successfully!" };
  }
  return loadLogin(req, res);
};

export default {
  loadLogin,
  login,
  dashboard,
  logout,
  loadCustomers,
  toggleBlockCustomer,
  loadLoginWithLogoutMessage,
};