import Cart from "../../models/cartSchema.js";
import Variant from "../../models/variantSchema.js";
import Product from "../../models/productSchema.js";  
import getBestOfferForProduct from '../../utils/offerHelper.js';

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

    const available = item.productId && !item.productId.isBlocked && 
                      item.variantId && !item.variantId.isBlocked && 
                      stock >= qty;

    if (available) payable += line;
    else canCheckout = false;
  }

  return { subtotal, payable, canCheckout };  
}

export const loadCart = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");

    const items = await Cart.find({ userId: req.user._id })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    const totals = calcTotals(items);

    const shipping = totals.subtotal < 15000 ? 100 : 0;

    res.render("user/cart", {
      cartItems: items,
      cartSubtotal: totals.subtotal,
      shippingCost: shipping,
      payableTotal: totals.payable + shipping,  
      canCheckout: totals.canCheckout && items.length > 0,
      stockIssue: !totals.canCheckout
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity: q } = req.body;
    const userId = req.user._id;
    const quantity = Math.max(1, parseInt(q || "1", 10));

    if (!productId || !variantId) return res.json({ success: false, message: "Missing IDs" });

    const product = await Product.findById(productId).populate('category').lean();
    if (!product) return res.json({ success: false, message: "Product not found" });

    const variant = await Variant.findById(variantId).lean();
    if (!variant) return res.json({ success: false, message: "Variant not found" });

    if (variant.stock < quantity) return res.json({ success: false, message: "Not enough stock" });

    const offerData = await getBestOfferForProduct(product);
    const finalPrice = offerData ? offerData.offerPrice : product.price;

    const filter = { userId, productId, variantId };

    const update = {
      $set: {
        price: finalPrice,
        originalPrice: product.price
      },
      $inc: { quantity }
    };

    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    await Cart.findOneAndUpdate(filter, update, options);

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
      canCheckout: totals.canCheckout
    });
  } catch (err) {
    console.error("Add to cart error:", err);
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
      return res.json({ success: false, message: "Item not found" });
    }

    const product = await Product.findById(cartItem.productId).populate('category').lean();
    if (!product) return res.json({ success: false });

    const variant = await Variant.findById(cartItem.variantId).lean();
    if (!variant) return res.json({ success: false });

    const offerData = await getBestOfferForProduct(product);
    const currentPrice = offerData ? offerData.offerPrice : product.price;

    if (action === 'increment' && cartItem.quantity < variant.stock) {
      cartItem.quantity += 1;
    } else if (action === 'decrement' && cartItem.quantity > 1) {
      cartItem.quantity -= 1;
    }

    cartItem.price = currentPrice;

    await cartItem.save();

    const lineTotal = currentPrice * cartItem.quantity;

    const items = await Cart.find({ userId })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    const totals = calcTotals(items);

    res.json({
      success: true,
      quantity: cartItem.quantity,
      lineTotal,
      stock: variant.stock,
      canCheckout: totals.canCheckout
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user._id;

    const cartItem = await Cart.findById(itemId);
    if (!cartItem || cartItem.userId.toString() !== userId.toString()) {
      return res.json({ success: false, message: "Item not found" });
    }

    await Cart.findByIdAndDelete(itemId);

    const items = await Cart.find({ userId })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "colorName stock images isBlocked")
      .lean();

    const totals = calcTotals(items);

    res.json({
      success: true,
      cartSubtotal: totals.subtotal,
      payableTotal: totals.payable,
      canCheckout: totals.canCheckout
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
};