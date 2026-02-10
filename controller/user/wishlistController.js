import Wishlist from "../../models/wishlistSchema.js";
import Cart from "../../models/cartSchema.js";
import Product from "../../models/productSchema.js";
import getBestOfferForProduct from "../../utils/offerHelper.js";
import logger from "../../helpers/logger.js";
export const loadWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    let wishlist = await Wishlist.find({ userId })
      .populate({
        path: "productId",
        populate: { path: "category" }
      })
      .populate("variantId")
      .sort({ addedAt: -1 })
      .lean();

    wishlist = await Promise.all(
      wishlist.map(async (item) => {
        if (item.productId) {
          const offerData = await getBestOfferForProduct(item.productId);
          item.productId.offerData = offerData;
        }
        return item;
      })
    );
    logger.info(`Wishlist loaded for user ${userId}`, { count: wishlist.length });

    res.render("user/wishlist", {
      title: "My Wishlist",
      wishlist,
      active:"Wishlist"
    });
  } catch (error) {
logger.error("Error loading wishlist", error);
    res.redirect("/");
  }
};
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    const exists = await Wishlist.findOne({ userId, productId, variantId });
    if (exists) {
      logger.warn(`Attempt to add existing wishlist item for user ${userId}`, { productId, variantId });
      return res.json({ success: false, message: "Already in your wishlist" });
    }

    const newItem = new Wishlist({
      userId,
      productId,
      variantId
    });

    await newItem.save();
logger.info(`Added to wishlist`, { userId, productId, variantId });
    res.json({ success: true, message: "Added to wishlist ❤️" });
  } catch (error) {
logger.error("Add to wishlist error", error);
    res.json({ success: false, message: "Failed to add" });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    const result = await Wishlist.deleteOne({ userId, productId, variantId });

    if (result.deletedCount === 0) {
      logger.warn(`Wishlist item not found for removal: user ${userId}`, { productId, variantId });
      return res.json({ success: false, message: "Not found in wishlist" });
    }
logger.info(`Removed from wishlist`, { userId, productId, variantId });
    res.json({ success: true, message: "Removed from wishlist" });
  } catch (error) {
logger.error("Remove wishlist error", error);
    res.json({ success: false, message: "Failed to remove" });
  }
};


export const moveToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    const deleteResult = await Wishlist.deleteOne({ userId, productId, variantId });
    if (deleteResult.deletedCount === 0) {
      logger.warn(`Attempted to move non-existent wishlist item to cart: user ${userId}`, { productId, variantId });
      return res.json({ success: false, message: "Item not in wishlist" });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      logger.warn(`Product not found during moveToCart: ${productId}`);
      return res.json({ success: false, message: "Product not found" });
    }

    const offerData = await getBestOfferForProduct(product);
    const price = offerData ? offerData.offerPrice : product.price;
    const originalPrice = product.price;

    const cartItem = await Cart.findOne({ userId, productId, variantId });

    if (cartItem) {
      cartItem.quantity += 1;
      cartItem.price = price;
      await cartItem.save();
    } else {
      const newCartItem = new Cart({
        userId,
        productId,
        variantId,
        quantity: 1,
        price,
        originalPrice
      });
      await newCartItem.save();
    }
logger.info(`Moved wishlist item to cart`, { userId, productId, variantId });

    res.json({ success: true, message: "Moved to cart 🛒" });
  } catch (error) {
logger.error("Move to cart error", error);
    res.json({ success: false, message: "Failed to move to cart" });
  }
};