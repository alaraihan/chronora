import Coupon from "../../models/couponSchema.js";
import User from "../../models/userSchema.js";
import logger from "../../helpers/logger.js";
import { DISCOUNT_TYPE, MESSAGES } from "../../utils/constants.js";

export const getCouponsPage = async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .populate("specificUsers", "name email _id")
      .sort({ createdAt: -1 });

    const users = await User.find({}).select("name email _id");

    res.render("admin/coupons", {
      coupons: Array.isArray(coupons) ? coupons : [],
      users,
      title: "Coupon",
      page: "Coupons"
    });
  } catch (err) {
    logger.error("Error fetching coupons:", err);
    res.status(500).render("admin/coupons", {
      coupons: [],
      users: []
    });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscountLimit,
      perUserLimit,
      totalUsageLimit,
      startDate,
      expiryDate,
      status,
      specificUsers = []
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required."
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Coupon name is required."
      });
    }

    if (!discountType) {
      return res.status(400).json({
        success: false,
        message: "Discount type is required."
      });
    }

    if (discountValue === undefined || discountValue === null || discountValue === "") {
      return res.status(400).json({
        success: false,
        message: "Discount value is required."
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required."
      });
    }

    if (!expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Expiry date is required."
      });
    }

    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 3 || trimmedCode.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Coupon code must be between 3 and 50 characters long."
      });
    }

    const codeRegex = /^[A-Z0-9_]+$/;
    if (!codeRegex.test(trimmedCode)) {
      return res.status(400).json({
        success: false,
        message: "Coupon code can only contain uppercase letters, numbers, and underscores."
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Coupon name must be between 3 and 100 characters long."
      });
    }

    if (description && description.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 500 characters."
      });
    }

    const discountVal = parseFloat(discountValue);
    if (isNaN(discountVal)) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be a valid number."
      });
    }

    if (discountVal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0."
      });
    }

    if (discountVal > 999999.99) {
      return res.status(400).json({
        success: false,
        message: "Discount value cannot exceed 999,999.99."
      });
    }

    if (discountType === "percentage") {
      if (discountVal > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount cannot exceed 100%."
        });
      }

      if (!Number.isInteger(discountVal)) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount must be a whole number."
        });
      }
    }

    if (discountType === "fixed") {
      if (discountVal < 0.01) {
        return res.status(400).json({
          success: false,
          message: "Fixed discount must be at least 0.01."
        });
      }
    }

    let minPurchaseVal = 0;
    if (minPurchase !== undefined && minPurchase !== null && minPurchase !== "") {
      minPurchaseVal = parseFloat(minPurchase);
      if (isNaN(minPurchaseVal)) {
        return res.status(400).json({
          success: false,
          message: "Minimum purchase must be a valid number."
        });
      }

      if (minPurchaseVal < 0) {
        return res.status(400).json({
          success: false,
          message: "Minimum purchase cannot be negative."
        });
      }

      if (minPurchaseVal > 999999.99) {
        return res.status(400).json({
          success: false,
          message: "Minimum purchase cannot exceed 999,999.99."
        });
      }

      if (discountType === "fixed") {
        if (minPurchaseVal <= discountVal) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase amount (${minPurchaseVal.toFixed(2)}) must be greater than the fixed discount value (${discountVal.toFixed(2)}).`
          });
        }
      } else if (discountType === "percentage") {
        const maxPossibleDiscount = maxDiscountLimit && maxDiscountLimit !== ""
          ? parseFloat(maxDiscountLimit)
          : (minPurchaseVal * discountVal) / 100;

        if (minPurchaseVal <= maxPossibleDiscount) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase amount (${minPurchaseVal.toFixed(2)}) must be greater than the maximum possible discount (${maxPossibleDiscount.toFixed(2)}).`
          });
        }
      }
    }

    let maxLimit = null;
    if (maxDiscountLimit !== undefined && maxDiscountLimit !== null && maxDiscountLimit !== "") {
      maxLimit = parseFloat(maxDiscountLimit);
      if (isNaN(maxLimit)) {
        return res.status(400).json({
          success: false,
          message: "Max discount limit must be a valid number."
        });
      }

      if (maxLimit < 0) {
        return res.status(400).json({
          success: false,
          message: "Max discount limit cannot be negative."
        });
      }

      if (maxLimit > 999999.99) {
        return res.status(400).json({
          success: false,
          message: "Max discount limit cannot exceed 999,999.99."
        });
      }

      if (discountType === "percentage" && maxLimit < discountVal) {
        return res.status(400).json({
          success: false,
          message: "Max discount cap cannot be less than the percentage value."
        });
      }

      if (discountType === "fixed" && maxLimit < discountVal) {
        return res.status(400).json({
          success: false,
          message: "Max discount cap cannot be less than the fixed discount amount."
        });
      }

      if (minPurchaseVal > 0 && maxLimit >= minPurchaseVal) {
        return res.status(400).json({
          success: false,
          message: `Max discount limit (${maxLimit.toFixed(2)}) must be less than minimum purchase amount (${minPurchaseVal.toFixed(2)}).`
        });
      }
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);

    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date format."
      });
    }

    if (isNaN(expiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry date format."
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be in the past."
      });
    }

    if (expiry <= start) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be after the start date."
      });
    }

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (expiry > oneYearFromNow) {
      return res.status(400).json({
        success: false,
        message: "Expiry date cannot be more than 1 year from now."
      });
    }

    if (!perUserLimit || perUserLimit === "" || perUserLimit === null || perUserLimit === undefined) {
      return res.status(400).json({
        success: false,
        message: "Per user limit is required."
      });
    }

    const perUser = parseInt(perUserLimit);
    if (isNaN(perUser)) {
      return res.status(400).json({
        success: false,
        message: "Per user limit must be a valid number."
      });
    }

    if (perUser < 1) {
      return res.status(400).json({
        success: false,
        message: "Per user limit must be at least 1."
      });
    }

    if (perUser > 999) {
      return res.status(400).json({
        success: false,
        message: "Per user limit cannot exceed 999."
      });
    }

    let totalLimit = null;
    if (totalUsageLimit !== undefined && totalUsageLimit !== null && totalUsageLimit !== "") {
      totalLimit = parseInt(totalUsageLimit);
      if (isNaN(totalLimit)) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit must be a valid number."
        });
      }

      if (totalLimit < 1) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit must be at least 1."
        });
      }

      if (totalLimit > 999999) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit cannot exceed 999,999."
        });
      }
    }

    const validStatuses = ["Active", "Inactive", "Expired"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value."
      });
    }

    if (specificUsers && Array.isArray(specificUsers)) {
      if (specificUsers.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign coupon to more than 1000 users."
        });
      }

      if (specificUsers.length > 0) {
        const usersExist = await User.find({ _id: { $in: specificUsers } });
        if (usersExist.length !== specificUsers.length) {
          return res.status(400).json({
            success: false,
            message: "One or more selected users do not exist."
          });
        }
      }
    }

    const existingCoupon = await Coupon.findOne({ code: trimmedCode });
    if (existingCoupon) {
      return res.status(409).json({
        success: false,
        message: MESSAGES.COUPON_EXISTS
      });
    }

    await Coupon.create({
      code: trimmedCode,
      name: trimmedName,
      description: description?.trim() || "",
      discountType,
      discountValue: discountVal,
      minPurchase: minPurchaseVal,
      maxDiscountLimit: maxLimit,
      perUserLimit: perUser,
      totalUsageLimit: totalLimit,
      startDate: new Date(startDate),
      expiryDate: new Date(expiryDate),
      status: status || "Active",
      specificUsers: specificUsers || []
    });

    logger.info(`Coupon ${trimmedCode} created successfully.`);
    res.json({ success: true, message: MESSAGES.COUPON_CREATED });
  } catch (error) {
    logger.error("createCoupon error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while creating the coupon."
    });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscountLimit,
      perUserLimit,
      totalUsageLimit,
      startDate,
      expiryDate,
      status,
      specificUsers = []
    } = req.body;

    if (!couponId || couponId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID format."
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found."
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required."
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Coupon name is required."
      });
    }

    if (!discountType) {
      return res.status(400).json({
        success: false,
        message: "Discount type is required."
      });
    }

    if (discountValue === undefined || discountValue === null || discountValue === "") {
      return res.status(400).json({
        success: false,
        message: "Discount value is required."
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required."
      });
    }

    if (!expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Expiry date is required."
      });
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Coupon code must be between 3 and 50 characters long."
      });
    }

    const codeRegex = /^[A-Z0-9_]+$/;
    if (!codeRegex.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        message: "Coupon code can only contain uppercase letters, numbers, and underscores."
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Coupon name must be between 3 and 100 characters long."
      });
    }

    if (description && description.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 500 characters."
      });
    }

    const discountVal = parseFloat(discountValue);
    if (isNaN(discountVal)) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be a valid number."
      });
    }

    if (discountVal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0."
      });
    }

    if (discountVal > 999999.99) {
      return res.status(400).json({
        success: false,
        message: "Discount value cannot exceed 999,999.99."
      });
    }

    if (discountType === "percentage") {
      if (discountVal > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount cannot exceed 100%."
        });
      }

      if (!Number.isInteger(discountVal)) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount must be a whole number."
        });
      }
    }

    if (discountType === "fixed") {
      if (discountVal < 0.01) {
        return res.status(400).json({
          success: false,
          message: "Fixed discount must be at least 0.01."
        });
      }
    }

    let minPurchaseVal = 0;
    if (minPurchase !== undefined && minPurchase !== null && minPurchase !== "") {
      minPurchaseVal = parseFloat(minPurchase);
      if (isNaN(minPurchaseVal)) {
        return res.status(400).json({
          success: false,
          message: "Minimum purchase must be a valid number."
        });
      }

      if (minPurchaseVal < 0) {
        return res.status(400).json({
          success: false,
          message: "Minimum purchase cannot be negative."
        });
      }

      if (minPurchaseVal > 999999.99) {
        return res.status(400).json({
          success: false,
          message: "Minimum purchase cannot exceed 999,999.99."
        });
      }

      if (discountType === "fixed") {
        if (minPurchaseVal <= discountVal) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase amount (${minPurchaseVal.toFixed(2)}) must be greater than the fixed discount value (${discountVal.toFixed(2)}).`
          });
        }
      } else if (discountType === "percentage") {

        const maxPossibleDiscount = maxDiscountLimit && maxDiscountLimit !== ""
          ? parseFloat(maxDiscountLimit)
          : (minPurchaseVal * discountVal) / 100;

        if (minPurchaseVal <= maxPossibleDiscount) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase amount (${minPurchaseVal.toFixed(2)}) must be greater than the maximum possible discount (${maxPossibleDiscount.toFixed(2)}).`
          });
        }
      }
    }

    let maxLimit = null;
    if (maxDiscountLimit !== undefined && maxDiscountLimit !== null && maxDiscountLimit !== "") {
      maxLimit = parseFloat(maxDiscountLimit);
      if (isNaN(maxLimit)) {
        return res.status(400).json({
          success: false,
          message: "Max discount limit must be a valid number."
        });
      }

      if (maxLimit < 0) {
        return res.status(400).json({
          success: false,
          message: "Max discount limit cannot be negative."
        });
      }

      if (maxLimit > 999999.99) {
        return res.status(400).json({
          success: false,
          message: "Max discount limit cannot exceed 999,999.99."
        });
      }

      if (discountType === "percentage" && maxLimit < discountVal) {
        return res.status(400).json({
          success: false,
          message: "Max discount cap cannot be less than the percentage value."
        });
      }

      if (discountType === "fixed" && maxLimit < discountVal) {
        return res.status(400).json({
          success: false,
          message: "Max discount cap cannot be less than the fixed discount amount."
        });
      }

      if (minPurchaseVal > 0 && maxLimit >= minPurchaseVal) {
        return res.status(400).json({
          success: false,
          message: `Max discount limit (${maxLimit.toFixed(2)}) must be less than minimum purchase amount (${minPurchaseVal.toFixed(2)}).`
        });
      }
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);

    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date format."
      });
    }

    if (isNaN(expiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry date format."
      });
    }

    if (expiry <= start) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be after the start date."
      });
    }

    if (!perUserLimit || perUserLimit === "" || perUserLimit === null || perUserLimit === undefined) {
      return res.status(400).json({
        success: false,
        message: "Per user limit is required."
      });
    }

    const perUser = parseInt(perUserLimit);
    if (isNaN(perUser)) {
      return res.status(400).json({
        success: false,
        message: "Per user limit must be a valid number."
      });
    }

    if (perUser < 1) {
      return res.status(400).json({
        success: false,
        message: "Per user limit must be at least 1."
      });
    }

    if (perUser > 999) {
      return res.status(400).json({
        success: false,
        message: "Per user limit cannot exceed 999."
      });
    }

    let totalLimit = null;
    if (totalUsageLimit !== undefined && totalUsageLimit !== null && totalUsageLimit !== "") {
      totalLimit = parseInt(totalUsageLimit);
      if (isNaN(totalLimit)) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit must be a valid number."
        });
      }

      if (totalLimit < 1) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit must be at least 1."
        });
      }

      if (totalLimit > 999999) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit cannot exceed 999,999."
        });
      }
    }

    const validStatuses = ["Active", "Inactive", "Expired"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value."
      });
    }

    if (specificUsers && Array.isArray(specificUsers)) {
      if (specificUsers.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign coupon to more than 1000 users."
        });
      }

      if (specificUsers.length > 0) {
        const usersExist = await User.find({ _id: { $in: specificUsers } });
        if (usersExist.length !== specificUsers.length) {
          return res.status(400).json({
            success: false,
            message: "One or more selected users do not exist."
          });
        }
      }
    }

    const existingCoupon = await Coupon.findOne({
      code: cleanCode,
      _id: { $ne: couponId }
    });

    if (existingCoupon) {
      return res.status(409).json({
        success: false,
        message: MESSAGES.COUPON_EXISTS
      });
    }

    coupon.code = cleanCode;
    coupon.name = trimmedName;
    coupon.description = description?.trim() || "";
    coupon.discountType = discountType;
    coupon.discountValue = discountVal;
    coupon.minPurchase = minPurchaseVal;
    coupon.maxDiscountLimit = maxLimit;
    coupon.perUserLimit = perUser;
    coupon.totalUsageLimit = totalLimit;
    coupon.startDate = new Date(startDate);
    coupon.expiryDate = new Date(expiryDate);
    coupon.status = status || "Active";
    coupon.specificUsers = specificUsers || [];

    await coupon.save();
    logger.info(`Coupon ${cleanCode} updated successfully.`);

    return res.json({
      success: true,
      message: MESSAGES.COUPON_UPDATED
    });
  } catch (error) {
    logger.error("updateCoupon error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating the coupon."
    });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    if (!couponId || couponId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID format."
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found."
      });
    }



    await Coupon.findByIdAndDelete(couponId);
    logger.info(`Coupon ${coupon.code} deleted successfully.`);

    return res.json({
      success: true,
      message: "Coupon deleted successfully!"
    });
  } catch (error) {
    logger.error("deleteCoupon error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the coupon."
    });
  }
};