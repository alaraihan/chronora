import Cart from "../../models/cartSchema.js";
import Variant from "../../models/variantSchema.js";

const toNumber = (v) => Number(v || 0);

function calcTotals(items) {
  let subtotal = 0;
  let payable = 0;
  let canCheckout = true;

  for (const item of items) {
    const product = item.productId || {};
    const variant = item.variantId || {};

    const price = toNumber(variant.price) || toNumber(product.price);
    const qty = toNumber(item.quantity);
    const stock = toNumber(variant.stock);

    const line = price * qty;
    subtotal += line;

    const available = !product.isBlocked && !variant.isBlocked && stock >= qty;

    if (available) payable += line;
    else canCheckout = false;
  }

  return { subtotal, payable, canCheckout };
}
export const loadCart = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/login");
    }

    const userId = req.user._id;

    const items = await Cart.find({ userId })
      .populate("productId", "name price isBlocked")
      .populate("variantId", "color price stock images isBlocked")
      .lean();

    const validItems = items.filter(i => i.productId && i.variantId);

    const totals = calcTotals(validItems);

    const shipping = totals.subtotal < 15000 ? 100 : 0;
    const grandTotal = totals.subtotal + shipping;

    const hasStockIssue = !totals.canCheckout;

    res.render("user/cart", {
      cartItems: validItems,
      cartSubtotal: totals.subtotal,
      shippingCost: shipping,
      payableTotal: totals.payable > 0 ? grandTotal : 0,
      canCheckout: totals.canCheckout && validItems.length > 0,
      stockIssue: hasStockIssue 
    });

  } catch (err) {
    console.error("Cart load error:", err);
    res.redirect("/");
  }
};



export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity: q } = req.body;
    const userId = req.user && req.user._id;
    const quantity = Math.max(1, parseInt(q || "1", 10));

    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (!productId) return res.status(400).json({ success: false, message: "Missing productId" });
    if (!variantId) return res.status(400).json({ success: false, message: "Missing variantId" });

    const variant = await Variant.findById(variantId).lean();
    if (!variant) {
      return res.json({ success: false, message: "Variant not found" });
    }

    const stock = toNumber(variant.stock);
    if (stock < quantity) {
      return res.json({ success: false, message: "Requested quantity not available" });
    }

    const filter = { userId, productId, variantId };
    const update = { $inc: { quantity } };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    await Cart.findOneAndUpdate(filter, update, options);

    const items = await Cart.find({ userId }).populate("productId").populate("variantId").lean();
    const totals = calcTotals ? calcTotals(items) : { subtotal: 0, payable: 0, canCheckout: true };

    console.log("POST /cart/add", { user: userId.toString(), productId, variantId, quantity, ts: new Date().toISOString() });

    return res.json({
      success: true,
      message: "Added to cart",
      cartSubtotal: totals.subtotal,
      payableTotal: totals.payable,
      total: totals.payable,
      canCheckout: totals.canCheckout,
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    return res.status(500).json({ success: false, message: "Server error adding to cart" });
  }
};

export const updateQuantity = async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user._id;
    const cartId = req.params.id;

    const item = await Cart.findOne({ _id: cartId, userId }).populate("productId").populate("variantId");

    if (!item) {
      return res.json({ success: false, message: "Item missing" });
    }

    const variant = item.variantId || {};

    if (action === "increment") {
      if (toNumber(item.quantity) + 1 > toNumber(variant.stock)) {
        return res.json({ success: false, message: "Not enough stock" });
      }
      item.quantity = toNumber(item.quantity) + 1;
    } else if (action === "decrement") {
      if (toNumber(item.quantity) <= 1) {
        await item.deleteOne();
      } else {
        item.quantity = toNumber(item.quantity) - 1;
      }
    }

    if (item.quantity) await item.save();

    const items = await Cart.find({ userId }).populate("productId").populate("variantId").lean();
    const totals = calcTotals(items);

    const price = toNumber(variant.price) || toNumber(item.productId?.price);
    const lineTotal = price * (toNumber(item.quantity) || 0);

    res.json({
      success: true,
      quantity: item.quantity || 0,
      lineTotal,
      cartSubtotal: totals.subtotal,
      payableTotal: totals.payable,
      total: totals.payable,
      canCheckout: totals.canCheckout,
      removed: item.quantity ? false : true,
      stock: toNumber(variant.stock) || 0,
    });
  } catch (err) {
    console.error("Qty update error:", err);
    res.status(500).json({ success: false });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    await Cart.findByIdAndDelete(req.params.id);

    const userId = req.user._id;
    const items = await Cart.find({ userId }).populate("productId").populate("variantId").lean();
    const totals = calcTotals(items);

    res.json({
      success: true,
      cartSubtotal: totals.subtotal,
      payableTotal: totals.payable,
      total: totals.payable,
      canCheckout: totals.canCheckout,
    });
  } catch (err) {
    console.error("Remove cart item error:", err);
    res.json({ success: false });
  }
};
