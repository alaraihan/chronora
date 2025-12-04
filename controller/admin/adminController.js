import Admin from "../../models/adminSchema.js";
import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import { setFlash, getFlash } from "../../utils/flash.js";
const render = (req, res, view, options = {}) => {
  const flash = getFlash(req);
  return res.render(view, { flash, ...options });
};
const loadLogin = (req, res) => {
  if (req.session.admin) return res.redirect("/admin/dashboard");

  return render(req, res, "admin/adminLogin", {
    title: "Admin Login - Chronora",
    layout: "layouts/adminLayouts/auth",
    pageJs: "adminLogin",
    pageCss: "adminLogin",
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all fields" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    req.session.adminId = admin._id.toString();
    req.session.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.fullName || "Admin",
    };

    res.status(200).json({ success: true, message: "Welcome back, Admin!" });
  } catch (err) {
    console.error("Admin login error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error. Try again later." });
  }
};
const dashboard = (req, res) => {
  if (!req.session.admin) {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized Admin" });
  }

  return render(req, res, "admin/dashboard", {
    title: "Dashboard - Chronora Admin",
    page: "dashboard",
    admin: req.session.admin,
  });
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    res.clearCookie("sid");
    res.json({
      success: true,
      message: "Logged out successfully!",
    });
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
    req.session.flash = { type: "error", message: "Failed to load customers" };
    return res.redirect("/admin/dashboard");
  }
};

const toggleBlockCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    const msg = user.isBlocked
      ? "User blocked successfully"
      : "User unblocked successfully";

    res.json({
      success: true,
      message: msg,
      isBlocked: user.isBlocked,
    });
  } catch (error) {
    console.error("Toggle block error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export default {
  loadLogin,
  login,
  dashboard,
  logout,
  loadCustomers,
  toggleBlockCustomer,
};
