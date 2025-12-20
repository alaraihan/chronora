import Offer from "../../models/offerSchema.js";
import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";

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

export const getOffersData = async (req, res) => {
  try {
    const { type, status } = req.query;  

    let query = {};
    if (type) query.type = type;
    if (status) query.active = status === 'active';  

    const offers = await Offer.find(query)
      .populate("productId", "name")
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, offers });
  } catch (error) {
    console.error("GET OFFERS DATA ERROR:", error);
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

    res.json({ success: true, targets });
  } catch (error) {
    console.error("GET TARGETS ERROR:", error);
    res.status(500).json({ success: false });
  }
};

export const createOffer = async (req, res) => {
  try {
    const { name, type, targetId, discountType, discountValue, startDate, endDate } = req.body;

    if (!name || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    let offerPrice=Number(discountValue)
if (discountType === "percentage" && offerPrice>= 90) {
  return res.status(400).json({
    success: false,
    message: "Discount percentage cannot be 90% or more"
  });
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

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, targetId, discountType, discountValue, startDate, endDate } = req.body;

    if (!name || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
 
    let offerPrice=Number(discountValue)
if (discountType === "percentage" && offerPrice>= 90) {
  return res.status(400).json({
    success: false,
    message: "Discount percentage cannot be 90% or more"
  });
}
    const offerData = {
      name: name.trim(),
      type,
      discountType,
      discountValue: Number(discountValue),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    offerData.productId = null;
    offerData.categoryId = null;

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
export const toggleOfferActive = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    offer.active = !offer.active;
    await offer.save();

    res.json({ 
      success: true, 
      message: "Status updated successfully",
      active: offer.active 
    });
  } catch (error) {
    console.error("TOGGLE STATUS ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};