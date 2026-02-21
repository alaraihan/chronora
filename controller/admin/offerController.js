import Offer from "../../models/offerSchema.js";
import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";
import logger from "../../helpers/logger.js";

/* ================= LOAD PAGE ================= */

export const loadOfferPage = async (req, res) => {
  try {
    res.render("admin/offer", {
      title: "Offers Management",
      page: "offer"
    });
    logger.info("Offer page loaded successfully");
  } catch (error) {
    logger.error("LOAD OFFER PAGE ERROR:", error);
    res.status(500).send("Server error");
  }
};

/* ================= GET OFFERS ================= */

export const getOffersData = async (req, res) => {
  try {
    const { type, status } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.active = status === "active";

    const offers = await Offer.find(query)
      .populate("productId", "name price")
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`Fetched ${offers.length} offers`, { type, status });

    res.json({ success: true, offers });
  } catch (error) {
    logger.error("GET OFFERS DATA ERROR:", error);
    res.status(500).json({ success: false });
  }
};

/* ================= GET TARGETS ================= */

export const getOfferTargets = async (req, res) => {
  try {
    const { type } = req.query;

    let targets = [];

    if (type === "product") {
      targets = await Product.find({}).select("_id name price").lean();
    } else if (type === "category") {
      targets = await Category.find({}).select("_id name").lean();
    }

    logger.info(`Fetched ${targets.length} targets for type: ${type}`);

    res.json({ success: true, targets });
  } catch (error) {
    logger.error("GET TARGETS ERROR:", error);
    res.status(500).json({ success: false });
  }
};

/* ================= CREATE OFFER ================= */

export const createOffer = async (req, res) => {
  try {
    const {
      name,
      type,
      targetId,
      discountType,
      discountValue,
      startDate,
      endDate
    } = req.body;

    /* ===== BASIC FIELD VALIDATION ===== */

    if (!name || !type || !targetId || !discountType || discountValue === undefined || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (!["product", "category"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer type"
      });
    }

    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount type"
      });
    }

    const normalizedName = name.trim();

    const existing = await Offer.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Offer already exists!"
      });
    }

    /* ===== DISCOUNT VALIDATION ===== */

    const discount = parseFloat(discountValue);

    if (isNaN(discount)) {
      return res.status(400).json({
        success: false,
        message: "Discount must be a valid number"
      });
    }

    if (discount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount must be greater than 0"
      });
    }

    /* ===== DATE VALIDATION ===== */

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format"
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

    /* ===== GET ORIGINAL PRICE ===== */

    let originalPrice = 0;

    if (type === "product") {
      const product = await Product.findById(targetId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      originalPrice = Number(product.price);
    }

    if (type === "category") {
      const productsInCategory = await Product.find({ category: targetId });
      if (!productsInCategory.length) {
        return res.status(404).json({
          success: false,
          message: "No products found in this category"
        });
      }
      originalPrice = Math.min(...productsInCategory.map(p => Number(p.price)));
    }

    if (!originalPrice || originalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid original price"
      });
    }

    /* ===== DISCOUNT LOGIC ===== */

    if (discountType === "percentage") {
      if (discount > 89) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount must be between 1 and 89"
        });
      }
    }

    if (discountType === "fixed") {
      if (discount >= originalPrice) {
        return res.status(400).json({
          success: false,
          message: "Fixed discount must be less than original price"
        });
      }
    }

    const finalPrice =
      discountType === "percentage"
        ? originalPrice - (originalPrice * discount) / 100
        : originalPrice - discount;

    if (finalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount results in invalid final price"
      });
    }

    /* ===== SAVE OFFER ===== */

    const offerData = {
      name: normalizedName,
      type,
      discountType,
      discountValue: discount,
      startDate: start,
      endDate: end,
      active: start <= now && end >= now
    };

    if (type === "product") offerData.productId = targetId;
    if (type === "category") offerData.categoryId = targetId;

    await Offer.create(offerData);

    logger.info("Offer created successfully");

    res.status(201).json({
      success: true,
      message: "Offer created successfully"
    });

  } catch (error) {
    logger.error("CREATE OFFER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= UPDATE OFFER ================= */

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      type,
      targetId,
      discountType,
      discountValue,
      startDate,
      endDate
    } = req.body;

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    const discount = parseFloat(discountValue);

    if (isNaN(discount) || discount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount value"
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

    let originalPrice = 0;

    if (type === "product") {
      const product = await Product.findById(targetId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      originalPrice = Number(product.price);
    }

    if (discountType === "percentage" && discount > 89) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 1 and 89"
      });
    }

    if (discountType === "fixed" && discount >= originalPrice) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount must be less than original price"
      });
    }

    await Offer.findByIdAndUpdate(id, {
      name: name.trim(),
      type,
      discountType,
      discountValue: discount,
      startDate: start,
      endDate: end,
      productId: type === "product" ? targetId : null,
      categoryId: type === "category" ? targetId : null
    });

    logger.info("Offer updated successfully", { id });

    res.json({
      success: true,
      message: "Offer updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE OFFER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= DELETE OFFER ================= */

export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    await Offer.findByIdAndDelete(id);

    logger.info("Offer deleted successfully", { id });

    res.json({
      success: true,
      message: "Offer deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE OFFER ERROR:", error);
    res.status(500).json({ success: false });
  }
};

/* ================= TOGGLE STATUS ================= */

export const toggleOfferActive = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    offer.active = !offer.active;
    await offer.save();

    res.json({
      success: true,
      active: offer.active,
      message: "Status updated successfully"
    });

  } catch (error) {
    logger.error("TOGGLE STATUS ERROR:", error);
    res.status(500).json({ success: false });
  }
};