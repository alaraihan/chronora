import Offer from "../models/offerSchema.js";

const getBestOfferForProduct = async (product) => {
  const now = new Date();
  const price = product.price;

  const categoryId =
    product.category?._id || product.category || product.categoryId;

  const offers = await Offer.find({
    active: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { type: "product", productId: product._id },
      ...(categoryId ? [{ type: "category", categoryId }] : [])
    ]
  }).lean();

  if (!offers.length) {return null;}

  let bestOffer = null;
  let bestPrice = price;

  for (const offer of offers) {
    let discountedPrice;

    if (offer.discountType === "percentage") {
      if (offer.discountValue >= 90) {continue;}

      discountedPrice = price - (price * offer.discountValue) / 100;
    } else {
      if (offer.discountValue >= price) {continue;}

      discountedPrice = price - offer.discountValue;
    }

    if (discountedPrice <= 0) {continue;}

    if (discountedPrice < bestPrice) {
      bestPrice = discountedPrice;
      bestOffer = offer;
    }
  }

  if (!bestOffer) {return null;}

  return {
    originalPrice: price,
    offerPrice: Math.round(bestPrice),
    discountAmount: Math.round(price - bestPrice),
    offer: bestOffer
  };
};

export default getBestOfferForProduct;
