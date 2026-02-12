import Admin from "../../models/adminSchema.js";
import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import Product from "../../models/productSchema.js";
import bcrypt from "bcrypt";
import { setFlash, getFlash } from "../../utils/flash.js";
import logger from "../../helpers/logger.js";
const render = (req, res, view, options = {}) => {
  const flash = getFlash(req);
  return res.render(view, { flash, ...options });
};
const loadLogin = (req, res) => {
  if (req.session.admin) {
    logger.info(`Admin already logged in: ${req.session.admin.email}`);
    return res.redirect("/admin/dashboard");}

  return render(req, res, "admin/adminLogin", {
    title: "Admin Login - Chronora",
    layout: "layouts/adminLayouts/auth",
    pageJs: "adminLogin",
    pageCss: "adminLogin"
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warn("Admin login attempt with missing fields");
      return res
        .status(400)
        .json({ success: false, message: "Please fill all fields" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      logger.warn(`Invalid admin login attempt: ${email}`);
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    req.session.adminId = admin._id.toString();
    req.session.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.fullName || "Admin"
    };
logger.info(`Admin logged in successfully: ${admin.email}`);
    res.status(200).json({ success: true, message: "Welcome back, Admin!" });
  } catch (err) {
logger.error("Admin login error", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error. Try again later." });
  }
};


export const getDashboardPage = async (req, res) => {
  try {
    res.render("admin/dashboard", {
      title: "Dashboard",
      page: "dashboard"
    });
  } catch (error) {
logger.error("Dashboard page error", error);
    res.status(500).send("Server Error");
  }
};

export const getDashboardData = async (req, res) => {
  try {
   const { filter, fromDate, toDate } = req.query;

let startDate = null;
let endDate = new Date();

switch (filter) {
  case "today":
    startDate = new Date();
    startDate.setHours(0,0,0,0);
    break;

  case "7days":
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    break;

  case "month":
    startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    break;

  case "year":
    startDate = new Date(new Date().getFullYear(), 0, 1);
    break;

  case "custom":
    startDate = new Date(fromDate);
    endDate = new Date(toDate);
    endDate.setHours(23,59,59,999);
    break;

  case "all":
  default:
    startDate = null;
}
const dateFilter = startDate
  ? { createdAt: { $gte: startDate, $lte: endDate } }
  : {};


const totalOrders = await Order.countDocuments(dateFilter);
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    
    const revenueResult = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: "$products" },
      { $match: { "products.itemStatus": "Delivered" } },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$products.quantity", "$products.price"] } }
        }
      }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    const recentOrders = await Order.find(dateFilter)
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderId userId totalAmount status createdAt paymentMethod");

    const statusDistribution = await Order.aggregate([
     
     { $group: { _id: "$status", count: { $sum: 1 } } }

    ]);
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last7Days.push(date);
    }

    const salesChartData = await Promise.all(
      last7Days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dailyRevenue = await Order.aggregate([
          {
            $match:{
              dateFilter,
              createdAt: { $gte: date, $lt: nextDay }
            }
          },
          { $unwind: "$products" },
          { $match: { "products.itemStatus": "Delivered" } },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $multiply: ["$products.quantity", "$products.price"] } },
              orders: { $sum: 1 }
            }
          }
        ]);

        return {
          date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          revenue: dailyRevenue.length > 0 ? dailyRevenue[0].revenue : 0,
          orders: dailyRevenue.length > 0 ? dailyRevenue[0].orders : 0
        };
      })
    );

    const topProducts = await Order.aggregate([
      { $unwind: "$products" },
      { $match: { "products.itemStatus": "Delivered" } },
      {
        $group: {
          _id: "$products.productId",
          totalSold: { $sum: "$products.quantity" },
          revenue: { $sum: { $multiply: ["$products.quantity", "$products.price"] } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name: "$productInfo.name",
          totalSold: 1,
          revenue: 1,
          orderCount: 1
        }
      }
    ]);

    const paymentDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" }
        }
      }
    ]);

    res.json({
      success: true,
      overview: {
        totalOrders,
        totalUsers,
        totalProducts,
        totalRevenue,
        
      },
      recentOrders: recentOrders.map(order => ({
        orderId: order.orderId,
        customer: order.userId?.email || "Guest",
        amount: order.totalAmount,
        status: order.status,
        date: order.createdAt,
        paymentMethod: order.paymentMethod
      })),
      statusDistribution,
      salesChartData,
      topProducts,
      paymentDistribution,
    });

  } catch (error) {
logger.error("Dashboard data error", error);
    res.status(500).json({
      success: false,
      message: "Error loading dashboard data"
    });
  }
};
const logout = (req, res) => {
  delete req.session.adminId;
  delete req.session.admin;
  logger.info("Admin logged out successfully");
  res.json({
    success: true,
    message: "Logged out successfully!"
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
          { email: { $regex: search, $options: "i" } }
        ]
      }
      : {};

    const totalCustomers = await User.countDocuments(filter);
    const customers = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    for (const customer of customers) {
      customer.orderCount = await Order.countDocuments({userId: customer._id});
    }
    logger.info(`Loaded customers page ${page}`, { count: customers.length, search });

    return render(req, res, "admin/customers", {
      title: "Customers - Chronora Admin",
      layout: "layouts/adminLayouts/main",
      page: "customers",
      customers,
      search,
      currentPage: page,
      totalPages: Math.ceil(totalCustomers / limit),
      totalCustomers
    });
  } catch (error) {
logger.error("Load customers error", error);
    req.session.flash = { type: "error", message: "Failed to load customers" };
    return res.redirect("/admin/dashboard");
  }
};
const toggleBlockCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      logger.warn(`Attempted to block/unblock non-existent user: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
user.isBlocked = !user.isBlocked;
      await user.save();
    const msg = user.isBlocked
      ? "User blocked successfully"
      : "User unblocked successfully";

    logger.info(`${msg} for user ${user.email}`);

    res.json({
      success: true,
      message: msg,
      isBlocked: user.isBlocked
    });

  } catch (error) {
    logger.error("Toggle block error", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


export default {
  loadLogin,
  login,
  logout,
  loadCustomers,
  toggleBlockCustomer
};

