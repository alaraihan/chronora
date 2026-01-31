import Offer from "../models/offerSchema.js";

export const getProductPrice = async (product, variant = null) => {
  if (!product) {return { price: 0, originalPrice: 0, offerApplied: false, discountPercentage: 0 };}

  const originalPrice = Number(variant?.price || product.price || 0);
  let finalPrice = originalPrice;
  let appliedOffer = null;
  const now = new Date();

  const productOffer = (await Offer.find({
    type: "product",
    productId: product._id,
    active: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ discountValue: -1 }).lean())[0] || null;

  let categoryOffer = null;
  if (!productOffer && product.category) {
    categoryOffer = (await Offer.find({
      type: "category",
      categoryId: product.category._id || product.category,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ discountValue: -1 }).lean())[0] || null;
  }

  appliedOffer = productOffer || categoryOffer;

  if (appliedOffer) {
    if (appliedOffer.discountType === "percentage") {
      finalPrice = Math.max(originalPrice - Math.round((originalPrice * appliedOffer.discountValue) / 100), 0);
    } else if (appliedOffer.discountType === "fixed") {
      finalPrice = Math.max(originalPrice - appliedOffer.discountValue, 0);
    }
  }

  const discountPercentage = appliedOffer
    ? appliedOffer.discountType === "percentage"
      ? appliedOffer.discountValue
      : Math.round((appliedOffer.discountValue / originalPrice) * 100)
    : 0;

  return {
    originalPrice,
    finalPrice,
    offerApplied: !!appliedOffer,
    discountPercentage,
    offer: appliedOffer || null
  };
};
