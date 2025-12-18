import Offer from "../../models/offerSchema.js";
import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";

// Render page
export const loadOfferPage = async (req, res) => {
  try {
    res.render("admin/offer", {
      title: "Offers Management",
      page: "offer",
    });
  } catch (error) {
    console.error("LOAD OFFER PAGE ERROR:", error);
    res.status(500).send("Server error");
  }
};

// Get offers for table
export const getOffersData = async (req, res) => {
  try {
    const { type } = req.query;

    let query = { active: true };
    if (type) query.type = type;

    const offers = await Offer.find(query)
      .populate("productId", "name")    // Safe populate
      .populate("categoryId", "name")   // Safe populate
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, offers });
  } catch (error) {
    console.error("GET OFFERS DATA ERROR:", error);
    res.status(500).json({ success: false });
  }
};

// Load products or categories for dropdown
export const getOfferTargets = async (req, res) => {
  try {
    const { type } = req.query;
    let targets = [];

    if (type === "product") {
      targets = await Product.find({}).select("_id name").lean();
    } else if (type === "category") {
      targets = await Category.find({}).select("_id name").lean();
    }

    res.json({ success: true, targets });
  } catch (error) {
    console.error("GET TARGETS ERROR:", error);
    res.status(500).json({ success: false });
  }
};

// Create new offer
export const createOffer = async (req, res) => {
  try {
    const { name, type, targetId, discountType, discountValue, startDate, endDate } = req.body;

    if (!name || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const offerData = {
      name: name.trim(),
      type,
      discountType,
      discountValue: Number(discountValue),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      active: true,
    };

    // Set correct ID based on type
    if (type === "product") {
      offerData.productId = targetId;
    } else if (type === "category") {
      offerData.categoryId = targetId;
    }

    const offer = await Offer.create(offerData);

    res.json({ success: true, message: "Offer created successfully" });
  } catch (error) {
    console.error("CREATE OFFER ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update offer
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, targetId, discountType, discountValue, startDate, endDate } = req.body;

    if (!name || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const offerData = {
      name: name.trim(),
      type,
      discountType,
      discountValue: Number(discountValue),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    // Reset both IDs first
    offerData.productId = null;
    offerData.categoryId = null;

    // Set the correct one
    if (type === "product") {
      offerData.productId = targetId;
    } else if (type === "category") {
      offerData.categoryId = targetId;
    }

    await Offer.findByIdAndUpdate(id, offerData);

    res.json({ success: true, message: "Offer updated successfully" });
  } catch (error) {
    console.error("UPDATE OFFER ERROR:", error);
    res.status(500).json({ success: false });
  }
};

// Delete offer
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    await Offer.findByIdAndDelete(id);
    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    console.error("DELETE OFFER ERROR:", error);
    res.status(500).json({ success: false });
  }
};