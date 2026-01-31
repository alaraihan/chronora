export const attachOffersMiddleware = async (req, res, next) => {
  try {
    if (!res.locals.product && (!res.locals.products || !Array.isArray(res.locals.products))) {
      return next();
    }

    const currentDate = new Date();

    const allOffers = await Offer.find({
      active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    }).lean();

    if (res.locals.product) {
      const product = res.locals.product;

      const applicableOffers = allOffers.filter(offer =>
        offer.productId?.toString() === product._id.toString() ||
        offer.categoryId?.toString() === product.category?._id?.toString()
      );

      let bestOffer = null;
      let finalPrice = product.price;
      let discountAmount = 0;

      if (applicableOffers.length > 0) {
        for (const offer of applicableOffers) {
          let currentDiscount = 0;

          if (offer.discountType === "percentage") {
            currentDiscount = (product.price * offer.discountValue) / 100;
          } else {
            currentDiscount = offer.discountValue;
          }

          if (currentDiscount > discountAmount) {
            discountAmount = currentDiscount;
            bestOffer = offer;
          }
        }

        finalPrice = Math.max(product.price - discountAmount, 0);
      }

      res.locals.product = {
        ...product,
        originalPrice: product.price,
        finalPrice: finalPrice,
        discount: discountAmount,
        discountPercentage: product.price > 0 ?
          Math.round((discountAmount / product.price) * 100) : 0,
        hasOffer: discountAmount > 0,
        bestOffer: bestOffer,
        applicableOffers: applicableOffers
      };
    }

    if (res.locals.products && Array.isArray(res.locals.products)) {
      res.locals.products = res.locals.products.map(product => {
        const applicableOffers = allOffers.filter(offer =>
          offer.productId?.toString() === product._id.toString() ||
          offer.categoryId?.toString() === product.category?._id?.toString()
        );

        let bestOffer = null;
        let finalPrice = product.price;
        let discountAmount = 0;

        if (applicableOffers.length > 0) {
          for (const offer of applicableOffers) {
            let currentDiscount = 0;

            if (offer.discountType === "percentage") {
              currentDiscount = (product.price * offer.discountValue) / 100;
            } else {
              currentDiscount = offer.discountValue;
            }

            if (currentDiscount > discountAmount) {
              discountAmount = currentDiscount;
              bestOffer = offer;
            }
          }

          finalPrice = Math.max(product.price - discountAmount, 0);
        }

        return {
          ...product,
          originalPrice: product.price,
          finalPrice: finalPrice,
          discount: discountAmount,
          discountPercentage: product.price > 0 ?
            Math.round((discountAmount / product.price) * 100) : 0,
          hasOffer: discountAmount > 0,
          bestOffer: bestOffer,
          applicableOffers: applicableOffers
        };
      });
    }

    next();
  } catch (error) {
    console.error("ATTACH OFFERS MIDDLEWARE ERROR:", error);
    next();
  }
};