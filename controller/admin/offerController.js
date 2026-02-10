import Offer from "../../models/offerSchema.js";
import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";
import logger from "../../helpers/logger.js";

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

export const getOffersData = async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = {};
    if (type) {query.type = type;}
    if (status) {query.active = status === "active";}
    const offers = await Offer.find(query)
      .populate("productId","name")
      .populate("categoryId","name")
      .sort({ createdAt: -1 })
      .lean();
          logger.info(`Fetched ${offers.length} offers`, { type, status });
    res.json({ success: true, offers });
  } catch (error) {
    logger.error("GET OFFERS DATA ERROR:", error);
    res.status(500).json({ success: false });
  }
};

export const getOfferTargets = async (req, res) => {
  try {
    const { type } = req.query;
    let targets = [];
    if (type === "product") {
      targets = await Product.find({}).select("_id name").lean();
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

    if (!name || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
           logger.warn("Create offer failed: missing fields");
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const normalizedName = name.trim();

    const existing = await Offer.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (existing) {
            logger.warn(`Create offer failed: offer already exists (${normalizedName})`);
      return res.status(400).json({
        success: false,
        message: "Offer already exists!"
      });
    }

    const discount = Number(discountValue);
    if (discount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0"
      });
    }

    if (discountType === "percentage" && discount >= 90) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage cannot be 90% or more"
      });
    }

    let originalPrice;

    if (type === "product") {
      const product = await Product.findById(targetId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      originalPrice = product.price;
    }

    if (type === "category") {
      const category = await Category.findById(targetId);
      if (!category) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
      originalPrice = category.price;
    }

    if (discountType === "fixed" && discount >= originalPrice) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount cannot be equal to or greater than original price"
      });
    }

    const finalPrice =
      discountType === "percentage"
        ? originalPrice - (originalPrice * discount) / 100
        : originalPrice - discount;

    if (finalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount results in zero or negative price"
      });
    }

    const offerData = {
      name: normalizedName,
      type,
      discountType,
      discountValue: discount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      active: true
    };

    if (type === "product") {offerData.productId = targetId;}
    if (type === "category") {offerData.categoryId = targetId;}

    await Offer.create(offerData);
    logger.info("Offer created successfully", { id: offer._id, name: offer.name, type });

    res.status(201).json({
      success: true,
      message: "Offer created successfully"
    });

  } catch (error) {
    logger.error("CREATE OFFER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


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

    if (!name || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
            logger.warn("Update offer failed: missing fields");
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existingOffer = await Offer.findById(id);
    if (!existingOffer) {
            logger.warn(`Update offer failed: offer not found (${id})`);
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    const normalizedName = name.trim();

    const duplicate = await Offer.findOne({
      _id: { $ne: id },
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });

    if (duplicate) {
            logger.warn(`Update offer failed: duplicate name (${normalizedName})`);
      return res.status(400).json({
        success: false,
        message: "Another offer with this name already exists"
      });
    }

    const discount = Number(discountValue);
    if (discount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0"
      });
    }

    if (discountType === "percentage" && discount >= 90) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage cannot be 90% or more"
      });
    }

    let originalPrice;

    if (type === "product") {
      const product = await Product.findById(targetId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      originalPrice = product.price;
    }

    if (type === "category") {
      const category = await Category.findById(targetId);
      if (!category) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
      originalPrice = category.price;
    }

    if (discountType === "fixed" && discount >= originalPrice) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount cannot be equal to or greater than original price"
      });
    }

    const finalPrice =
      discountType === "percentage"
        ? originalPrice - (originalPrice * discount) / 100
        : originalPrice - discount;

    if (finalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount results in zero or negative price"
      });
    }

    const offerData = {
      name: normalizedName,
      type,
      discountType,
      discountValue: discount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      productId: null,
      categoryId: null
    };

    if (type === "product") {offerData.productId = targetId;}
    if (type === "category") {offerData.categoryId = targetId;}

    await Offer.findByIdAndUpdate(id, offerData, { new: true });
    logger.info("Offer updated successfully", { id, name: normalizedName, type });

    res.json({
      success: true,
      message: "Offer updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE OFFER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    await Offer.findByIdAndDelete(id);
        logger.info("Offer deleted successfully", { id });
    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    logger.error("DELETE OFFER ERROR:", error);
    res.status(500).json({ success: false });
  }
};
export const toggleOfferActive = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);

    if (!offer) {
            logger.warn(`Toggle offer failed: offer not found (${id})`);
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    offer.active = !offer.active;
    await offer.save();
    logger.info("Offer status toggled", { id, active: offer.active });

    res.json({
      success: true,
      message: "Status updated successfully",
      active: offer.active
    });
  } catch (error) {
    logger.error("TOGGLE STATUS ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};