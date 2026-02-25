import Cart from "../../models/cartSchema.js";
import Variant from "../../models/variantSchema.js";
import Product from "../../models/productSchema.js";
import getBestOfferForProduct from "../../utils/offerHelper.js";
import { message } from "../../middlewares/message.js";
import logger from "../../helpers/logger.js"; 

const toNumber = (v) => Number(v || 0);

function calcTotals(items) {
  let subtotal = 0;
  let payable = 0;
  let canCheckout = true;

  for (const item of items) {
    const qty = toNumber(item.quantity);
    const price = toNumber(item.price);
    const stock = toNumber(item.variantId?.stock);

    const line = price * qty;
    subtotal += line;

    const available =
      item.productId &&
      !item.productId.isBlocked &&
      item.variantId &&
      !item.variantId.isBlocked &&
      stock >= qty;

    if (available) {
      payable += line;
    } else {
      canCheckout = false;
    }
  }

  return { subtotal, payable, canCheckout };
}

export const loadCart = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");

    let items = await Cart.find({ userId: req.user._id })
      .populate({ path: "productId", populate: { path: "category" } })
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    items = await Promise.all(
      items.map(async (item) => {
        if (item.productId) {
          const offerData = await getBestOfferForProduct(item.productId);
          item.productId.offerData = offerData;

          if (offerData) {
            item.price = offerData.offerPrice;
            item.originalPrice = item.productId.price;
          }else{
             item.price = item.productId.price;   
}
          }
        return item;
      })
    );

    const totals = calcTotals(items);
    const shipping = totals.subtotal < 15000 ? 100 : 0;

    res.render("user/cart", {
      cartItems: items,
      cartSubtotal: totals.subtotal,
      shippingCost: shipping,
      payableTotal: totals.payable + shipping,
      canCheckout: totals.canCheckout && items.length > 0,
      stockIssue: !totals.canCheckout,
    });

    logger.info(`Cart loaded for user: ${req.user._id}`);
  } catch (err) {
    logger.error(`loadCart error for user ${req.user?._id}:`, err);
    res.redirect("/");
  }
};
export const checkCartItem = async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ quantity: 0 });
    }
    
    const { productId, variantId } = req.query;
    const cartItem = await Cart.findOne({ 
      userId: req.user._id, 
      productId, 
      variantId 
    });
    
    res.json({ quantity: cartItem?.quantity || 0 });
  } catch (err) {
    logger.error("checkCartItem error:", err);
    res.json({ quantity: 0 });
  }
};
export const addToCart = async (req, res) => {
  try {
       if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login or signup to add items to cart"
      });
    }
    
    const { productId, variantId, quantity: q } = req.body;
    const userId = req.user._id;
    const quantity = Math.max(1, parseInt(q || "1", 10));
   
   
    if (!productId || !variantId) {
      logger.warn(`addToCart failed: Missing IDs, user: ${userId}`);
      return res.json({ success: false, message: "Missing IDs" });
    }

    const product = await Product.findById(productId).populate("category").lean();
    if (!product) {
      logger.warn(`addToCart failed: Product not found, ID: ${productId}`);
      return res.json({ success: false, message: "Product not found" });
    }

    const variant = await Variant.findById(variantId).lean();
    if (!variant) {
      logger.warn(`addToCart failed: Variant not found, ID: ${variantId}`);
      return res.json({ success: false, message: "Variant not found" });
    }

    if (variant.stock < quantity) {
      logger.warn(`addToCart failed: Not enough stock for variant ${variantId}`);
      return res.json({ success: false, message: "Not enough stock" });
    }
    

    const offerData = await getBestOfferForProduct(product);
    const finalPrice = offerData ? offerData.offerPrice : product.price;

    const filter = { userId, productId, variantId };
    const update = { $set: { price: finalPrice, originalPrice: product.price }, $inc: { quantity } };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    await Cart.findOneAndUpdate(filter, update, options);
    logger.info(`Added to cart: product ${productId}, variant ${variantId}, user ${userId}`);

    const items = await Cart.find({ userId })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    const totals = calcTotals(items);
    
    res.json({
      success: true,
      message: "Added to cart",
      cartSubtotal: totals.subtotal,
      payableTotal: totals.payable,
      canCheckout: totals.canCheckout,
    });
  } catch (err) {
    logger.error(`addToCart error for user ${req.user?._id}:`, err);
    res.json({ success: false, message: "Server error" });
  }
};

export const updateQuantity = async (req, res) => {
  try {
    const itemId = req.params.id;
    const { action } = req.body;
    const userId = req.user._id;

    const cartItem = await Cart.findById(itemId);
    if (!cartItem || cartItem.userId.toString() !== userId.toString()) {
      logger.warn(`updateQuantity failed: Item not found or unauthorized, item: ${itemId}`);
      return res.json({ success: false, message: "Item not found" });
    }

    const product = await Product.findById(cartItem.productId).populate("category").lean();
    const variant = await Variant.findById(cartItem.variantId).lean();
    if (!product || !variant) return res.json({ success: false });

    const offerData = await getBestOfferForProduct(product);
    const currentPrice = offerData ? offerData.offerPrice : product.price;

    if (action === "increment") {
  if (cartItem.quantity >= variant.stock) {
    return res.json({
      success: false,
      message: "Stock finished",
      stock: variant.stock
    });
  }
  cartItem.quantity += 1;
}

if (action === "decrement") {
  if (cartItem.quantity > 1) {
    cartItem.quantity -= 1;
  }
}


    cartItem.price = currentPrice;
    await cartItem.save();

    const lineTotal = currentPrice * cartItem.quantity;
    const items = await Cart.find({ userId })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    const totals = calcTotals(items);
    logger.info(`Cart item quantity updated: item ${itemId}, user ${userId}, new qty: ${cartItem.quantity}`);

    res.json({
      success: true,
      quantity: cartItem.quantity,
      lineTotal,
      stock: variant.stock,
      canCheckout: totals.canCheckout,
    });
  } catch (err) {
    logger.error(`updateQuantity error for user ${req.user?._id}:`, err);
    res.json({ success: false });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user._id;

    const cartItem = await Cart.findById(itemId);
    if (!cartItem || cartItem.userId.toString() !== userId.toString()) {
      logger.warn(`removeFromCart failed: Item not found or unauthorized, item: ${itemId}`);
      return res.json({ success: false, message: "Item not found" });
    }

    await Cart.findByIdAndDelete(itemId);
    logger.info(`Cart item removed: ${itemId}, user ${userId}`);

    const items = await Cart.find({ userId })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    const totals = calcTotals(items);
    res.json({
      success: true,
      cartSubtotal: totals.subtotal,
      payableTotal: totals.payable,
      canCheckout: totals.canCheckout,
    });
  } catch (err) {
    logger.error(`removeFromCart error for user ${req.user?._id}:`, err);
    res.json({ success: false });
  }
};
