import Wishlist from "../../models/wishlistSchema.js";
import Cart from "../../models/cartSchema.js"; 
import Product from "../../models/productSchema.js";
import getBestOfferForProduct from "../../utils/offerHelper.js"; 
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

    res.render("user/wishlist", {
      title: "My Wishlist",
      wishlist,
      active:'Wishlist',
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.redirect("/");
  }
};
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    const exists = await Wishlist.findOne({ userId, productId, variantId });
    if (exists) {
      return res.json({ success: false, message: "Already in your wishlist" });
    }

    const newItem = new Wishlist({
      userId,
      productId,
      variantId
    });

    await newItem.save();

    res.json({ success: true, message: "Added to wishlist ❤️" });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.json({ success: false, message: "Failed to add" });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    const result = await Wishlist.deleteOne({ userId, productId, variantId });

    if (result.deletedCount === 0) {
      return res.json({ success: false, message: "Not found in wishlist" });
    }

    res.json({ success: true, message: "Removed from wishlist" });
  } catch (error) {
    console.error("Remove wishlist error:", error);
    res.json({ success: false, message: "Failed to remove" });
  }
};


export const moveToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    const deleteResult = await Wishlist.deleteOne({ userId, productId, variantId });
    if (deleteResult.deletedCount === 0) {
      return res.json({ success: false, message: "Item not in wishlist" });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    const offerData = await getBestOfferForProduct(product);
    const price = offerData ? offerData.offerPrice : product.price;
    const originalPrice = product.price;

    let cartItem = await Cart.findOne({ userId, productId, variantId });

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

    res.json({ success: true, message: "Moved to cart 🛒" });
  } catch (error) {
    console.error("Move to cart error:", error);
    res.json({ success: false, message: "Failed to move to cart" });
  }
};