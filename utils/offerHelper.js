import Offer from '../models/offerSchema.js';

const getBestOfferForProduct = async (product) => {
  const now = new Date();

  const categoryId = product.category?._id || product.category || product.categoryId;

  if (!categoryId) {
    const productOffer = await Offer.findOne({
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      type: 'product',
      productId: product._id
    }).lean();

    if (!productOffer) return null;

    const discountAmount = productOffer.discountType === 'percentage'
      ? (product.price * productOffer.discountValue) / 100
      : productOffer.discountValue;

    const offerPrice = Math.max(0, product.price - discountAmount);

    return {
      originalPrice: product.price,
      offerPrice,
      discountAmount,
      offer: productOffer
    };
  }

  const offers = await Offer.find({
    active: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { type: 'product', productId: product._id },
      { type: 'category', categoryId }
    ]
  }).lean();

  if (offers.length === 0) return null;

  let bestOffer = null;
  let bestDiscountAmount = 0;

  for (const offer of offers) {
    let discountAmount = 0;
    if (offer.discountType === 'percentage') {
      discountAmount = (product.price * offer.discountValue) / 100;
    } else {
      discountAmount = offer.discountValue;
    }

    const isBetter = discountAmount > bestDiscountAmount ||
      (discountAmount === bestDiscountAmount && offer.type === 'product' && bestOffer?.type !== 'product');

    if (isBetter) {
      bestDiscountAmount = discountAmount;
      bestOffer = offer;
    }
  }

  const offerPrice = Math.max(0, product.price - bestDiscountAmount);

  return {
    originalPrice: product.price,
    offerPrice,
    discountAmount: bestDiscountAmount,
    offer: bestOffer
  };
};

export default getBestOfferForProduct;