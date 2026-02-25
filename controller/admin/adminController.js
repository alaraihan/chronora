import Admin from "../../models/adminSchema.js";
import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import Variant from "../../models/variantSchema.js";
import Product from "../../models/productSchema.js";
import bcrypt from "bcrypt";
import { setFlash, getFlash } from "../../utils/flash.js";
import logger from "../../helpers/logger.js";
import mongoose from "mongoose";
import HttpStatus from "../../utils/httpStatus.js";
const render = (req, res, view, options = {}) => {
  const flash = getFlash(req);
  return res.render(view, { flash, ...options });
};
const loadLogin = (req, res) => {
  if (req.session.admin) {
    logger.info(`Admin already logged in: ${req.session.admin.email}`);
    return res.redirect("/admin/dashboard");
  }

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
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Please fill all fields" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      logger.warn(`Invalid admin login attempt: ${email}`);
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: "Invalid email or password" });
    }

    req.session.adminId = admin._id.toString();
    req.session.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.fullName || "Admin"
    };
    logger.info(`Admin logged in successfully: ${admin.email}`);
    res.status(HttpStatus.OK).json({ success: true, message: "Welcome back, Admin!" });
  } catch (err) {
    logger.error("Admin login error", err);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Server error. Try again later." });
  }
};


export const getDashboardPage = async (req, res) => {
  try {
    res.render("admin/dashboard", {
      title: "Dashboard",
      page: "dashboard",


    });
  } catch (error) {
    logger.error("Dashboard page error", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Server Error");
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
        startDate.setHours(0, 0, 0, 0);
        break;

      case "7days":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
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
        endDate.setHours(23, 59, 59, 999);
        break;

      case "all":
      default:
        startDate = null;
        const earliestOrder = await Order.findOne().sort({ createdAt: 1 }).select('createdAt');
        startDate = earliestOrder ? earliestOrder.createdAt : new Date(0);
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
      { $match: dateFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    let dateRange = [];

    if (filter === "today") {
      for (let i = 0; i < 24; i++) {
        const hour = new Date(startDate);
        hour.setHours(i, 0, 0, 0);
        dateRange.push(hour);
      }
    } else if (filter === "7days") {
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dateRange.push(date);
      }
    } else if (filter === "month") {
      const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dateRange.push(date);
      }
    } else if (filter === "year") {
      for (let i = 0; i < 12; i++) {
        const month = new Date(startDate.getFullYear(), i, 1);
        dateRange.push(month);
      }
    } else if (filter === "custom") {
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        const hours = Math.ceil(diffTime / (1000 * 60 * 60));
        for (let i = 0; i <= hours; i++) {
          const hour = new Date(startDate);
          hour.setHours(startDate.getHours() + i, 0, 0, 0);
          if (hour <= endDate) {
            dateRange.push(hour);
          }
        }
      } else if (diffDays <= 31) {
        for (let i = 0; i <= diffDays; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          if (date <= endDate) {
            dateRange.push(date);
          }
        }
      } else if (diffDays <= 365) {
        const weeks = Math.ceil(diffDays / 7);
        for (let i = 0; i <= weeks; i++) {
          const week = new Date(startDate);
          week.setDate(week.getDate() + (i * 7));
          if (week <= endDate) {
            dateRange.push(week);
          }
        }
      } else {
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth());
        for (let i = 0; i <= months; i++) {
          const month = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
          if (month <= endDate) {
            dateRange.push(month);
          }
        }
      }
    } else {
      const earliestOrder = await Order.findOne().sort({ createdAt: 1 }).select('createdAt');
      const earliestDate = earliestOrder ? earliestOrder.createdAt : new Date();
      const totalMonths = (new Date().getFullYear() - earliestDate.getFullYear()) * 12 +
        (new Date().getMonth() - earliestDate.getMonth());

      for (let i = 0; i <= totalMonths; i++) {
        const month = new Date(earliestDate.getFullYear(), earliestDate.getMonth() + i, 1);
        dateRange.push(month);
      }
    }

    const salesChartData = await Promise.all(
      dateRange.map(async (date, index) => {
        let nextDate;

        if (filter === "today" || (filter === "custom" && dateRange.length > 24)) {
          nextDate = new Date(date);
          nextDate.setHours(date.getHours() + 1);
        } else if (filter === "year" || (filter === "custom" && dateRange.length <= 12)) {
          nextDate = new Date(date);
          nextDate.setMonth(date.getMonth() + 1);
        } else if (filter === "custom" && dateRange.length <= 52) {
          nextDate = new Date(date);
          nextDate.setDate(date.getDate() + 7);
        } else {
          nextDate = new Date(date);
          nextDate.setDate(date.getDate() + 1);
        }

        const dailyRevenue = await Order.aggregate([
          {
            $match: {
              ...dateFilter,
              createdAt: { $gte: date, $lt: nextDate }
            }
          },
          { $unwind: "$products" },
          { $match: { "products.itemStatus": "Delivered" } },
          {
            $group: {
              _id: null,
              revenue: {
                $sum: { $multiply: ["$products.quantity", "$products.price"] }
              },
              orders: { $sum: 1 }
            }
          }
        ]);

        let dateLabel;
        if (filter === "today" || (filter === "custom" && dateRange.length > 24)) {
          dateLabel = date.toLocaleTimeString("en-IN", { hour: '2-digit', hour12: true });
        } else if (filter === "year" || (filter === "custom" && dateRange.length <= 12)) {
          dateLabel = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        } else if (filter === "custom" && dateRange.length <= 52) {
          const weekEnd = new Date(date);
          weekEnd.setDate(date.getDate() + 6);
          dateLabel = `${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${weekEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
        } else {
          dateLabel = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        }

        return {
          date: dateLabel,
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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
      customer.orderCount = await Order.countDocuments({ userId: customer._id });
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
      return res.status(HttpStatus.NOT_FOUND).json({
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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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

