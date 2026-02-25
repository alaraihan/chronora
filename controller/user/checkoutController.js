import mongoose from "mongoose";
import Cart from "../../models/cartSchema.js";
import Variant from "../../models/variantSchema.js";
import Product from "../../models/productSchema.js";
import Address from "../../models/addressSchema.js";
import Order from "../../models/orderSchema.js";
import Coupon from "../../models/couponSchema.js";
import User from "../../models/userSchema.js";
import getBestOfferForProduct from "../../utils/offerHelper.js";
import logger from "../../helpers/logger.js";
import { ORDER_STATUS, ITEM_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, DISCOUNT_TYPE, MESSAGES } from "../../utils/constants.js";

function calculateTotals(items) {
  let subtotal = 0;

  for (const item of items) {
    const price = Number(item.price || 0);
    const qty = Number(item.quantity || 0);
    subtotal += price * qty;
  }

  const shipping = subtotal < 15000 ? 100 : 0;
  const grandTotal = subtotal + shipping;
  return { subtotal, shipping, grandTotal };
}

export const loadCheckout = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.find({ userId })
      .populate({
        path: "productId",
        populate: { path: "category" }
      })
      .populate("variantId")
      .lean();

    cart = await Promise.all(
      cart.map(async (item) => {
        if (item.productId) {
          const offerData = await getBestOfferForProduct(item.productId);
          item.productId.offerData = offerData;
          if (offerData) {
            item.price = offerData.offerPrice;
          }else{
            item.price=item.productId.price;
          }
        }
        return item;
      })
    );

    if (!cart || cart.length === 0) {
      logger.info(`User ${userId} attempted checkout with empty cart`);
      return res.redirect("/cart");
    }

    for (const item of cart) {
      if (
        !item.productId ||
        !item.variantId ||
        item.productId.isBlocked ||
        item.variantId.isBlocked ||
        item.variantId.stock < item.quantity
      ) {
        logger.warn(`User ${userId} has invalid cart item for checkout`);
        return res.status(409).json({
          success: false,
          message: "Some items in your cart are out of stock. Please update your cart."
        });
      }
    }

    const addresses = await Address.find({ user: userId })
      .sort({ isDefaultShipping: -1, createdAt: -1 })
      .lean();

    const userWithWallet = await User.findById(userId).select("name email wallet").lean();

    const { subtotal, shipping, grandTotal } = calculateTotals(cart);

    req.session.checkoutSummary = { subtotal, shipping, totalAmount: grandTotal, discount: 0 };

    res.render("user/checkout", {
      cartItems: cart,
      addresses,
      user: req.user,
      walletBalance: userWithWallet?.wallet || 0,
      subtotal,
      shipping,
      grandTotal,
      couponDiscount: 0
    });
    logger.info(`Checkout page loaded for user ${userId}`);
  } catch (error) {
    logger.error(`loadCheckout error for user ${req.user?._id}:`, error);
    res.redirect("/cart");
  }
};
export const applyCoupon = async (req, res) => {
  try {
    const userId = req.user._id;
    const enteredCode = req.body.couponCode?.trim().toUpperCase();

    if (!enteredCode) {
      return res.json({
        success: false,
        message: "Please type a coupon code"
      });
    }

    const cartItems = await Cart.find({ userId })
      .populate("productId")
      .populate("variantId")
      .lean();

    if (!cartItems || cartItems.length === 0) {
      return res.json({
        success: false,
        message: "Your cart is empty"
      });
    }

    const { subtotal } = calculateTotals(cartItems);

    const coupon = await Coupon.findOne({
      code: enteredCode,
      status: "Active"
    }).populate("usedBy.user");

    if (!coupon) {
      return res.json({ success: false, message: MESSAGES.COUPON_INVALID });
    }

    const today = new Date();
    if (coupon.startDate > today || coupon.expiryDate < today) {
      return res.json({ success: false, message: "This coupon is expired or not active yet" });
    }

    if (coupon.specificUsers.length > 0) {
      const userIdStr = userId.toString();
      const allowed = coupon.specificUsers.some(id => id.toString() === userIdStr);
      if (!allowed) {
        return res.json({ success: false, message: "This coupon is not valid for your account" });
      }
    }

    if (subtotal < coupon.minPurchase) {
      return res.json({
        success: false,
        message: MESSAGES.COUPON_MIN_PURCHASE(coupon.minPurchase)
      });
    }

    const userUsage = coupon.usedBy.find(u => u.user.toString() === userId.toString());
    const userCount = userUsage ? userUsage.count : 0;

    if (userCount >= coupon.perUserLimit) {
      return res.json({
        success: false,
        message: `You've already used this coupon ${coupon.perUserLimit} time(s). Limit reached.`
      });
    }

    if (coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit) {
      return res.json({
        success: false,
        message: MESSAGES.COUPON_LIMIT_REACHED
      });
    }

    let discount = 0;
    if (coupon.discountType === DISCOUNT_TYPE.PERCENTAGE) {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountLimit) {
        discount = Math.min(discount, coupon.maxDiscountLimit);
      }
    } else {
      discount = coupon.discountValue;
    }

    discount = Math.round(discount);

    // Update session summary
    if (req.session.checkoutSummary) {
      req.session.checkoutSummary.discount = discount;
      req.session.checkoutSummary.totalAmount = req.session.checkoutSummary.subtotal + req.session.checkoutSummary.shipping - discount;
    }

    logger.info(`Coupon ${coupon.code} applied by user ${userId}, discount ₹${discount}`);
    return res.json({
      success: true,
      discount,
      message: `Coupon "${coupon.code}" applied! ₹${discount} off`
    });
  } catch (error) {
    logger.error(`applyCoupon error for user ${req.user?._id}:`, error);
    return res.json({ success: false, message: "Error applying coupon. Try again." });
  }
};

export const addAddressCheck = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      name,
      phone,
      street,
      city,
      state,
      zip,
      isDefaultShipping
    } = req.body;

    if (!name || !phone || !street || !city || !state || !zip) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (!/^\d{10}$/.test(String(phone).trim())) {
      return res.status(400).json({
        success: false,
        message: "Mobile must be 10 digits"
      });
    }

    if (!/^\d{6}$/.test(String(zip).trim())) {
      return res.status(400).json({
        success: false,
        message: "ZIP code must be 6 digits"
      });
    }

    if (isDefaultShipping === "on" || isDefaultShipping === true) {
      await Address.updateMany({ user: userId }, { isDefaultShipping: false });
    }

    const newAddress = new Address({
      user: userId,
      name: name.trim(),
      phone: String(phone).trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: String(zip).trim(),
      country: "India",
      isDefaultShipping: isDefaultShipping === "on" || isDefaultShipping === true
    });

    await newAddress.save();

    const addresses = await Address.find({ user: userId })
      .sort({ isDefaultShipping: -1, createdAt: -1 })
      .lean();
    logger.info(`New address added during checkout by user ${userId}`);
    res.json({
      success: true,
      message: "Address added successfully!",
      addresses
    });

  } catch (err) {
    logger.error(`addAddressCheck error for user ${req.user?._id}:`, err);
    res.status(500).json({
      success: false,
      message: "Server error, try again"
    });
  }
};
export const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user?._id;
    if (!userId) { return res.status(401).json({ success: false, message: "Not authenticated" }); }

    const {
      selectedAddress,
      paymentMethod,
      discount = 0,
      appliedCoupon,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      paymentStatus = null
    } = req.body;

    let cartItems = await Cart.find({ userId })
      .populate("productId")
      .populate("variantId")
      .lean();

    if (!cartItems || cartItems.length === 0) {
      req.session.checkoutFailure = {
        subtotal: 0,
        shipping: 0,
        discount: 0,
        totalAmount: 0,
        errorMessage: "Your cart is empty."
      };
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    cartItems = await Promise.all(cartItems.map(async (item) => {
      if (item.productId) {
        const offerData = await getBestOfferForProduct(item.productId);
        item.productId.offerData = offerData;
        if (offerData) { item.price = offerData.offerPrice; }
      }
      return item;
    }));

    const { subtotal, shipping, grandTotal } = calculateTotals(cartItems);
    const finalAmount = grandTotal - Number(discount);

    if (finalAmount <= 0) {
      req.session.checkoutFailure = {
        subtotal,
        shipping,
        discount: Number(discount),
        totalAmount: finalAmount,
        errorMessage: "Invalid order amount."
      };
      return res.status(400).json({ success: false, message: "Invalid order amount" });
    }
    if (paymentMethod === PAYMENT_METHOD.COD && finalAmount > 1000) {
      req.session.checkoutFailure = {
        subtotal,
        shipping,
        discount: Number(discount),
        totalAmount: finalAmount,
        errorMessage: "COD not allowed above ₹1000."
      };
      return res.status(400).json({ success: false, message: "COD not allowed above ₹1000" });
    }

    const orderedItems = cartItems.map(ci => {
      const originalPrice = Number(ci.productId?.price || ci.variantId?.price || 0);
      let finalPrice = Number(ci.price || originalPrice);
      if (ci.productId?.offerData?.offerPrice) { finalPrice = Number(ci.productId.offerData.offerPrice); }

      return {
        productId: ci.productId._id,
        variantId: ci.variantId?._id || null,
        quantity: Number(ci.quantity || 1),
        price: finalPrice,
        originalPrice,
        itemStatus: ITEM_STATUS.PENDING,
        offerData: ci.productId?.offerData || null
      };
    });

    session.startTransaction();

    const updatedVariants = [];
    if (paymentStatus !== PAYMENT_STATUS.FAILED) {
      for (const item of orderedItems) {
        if (!item.variantId) { continue; }

        const updated = await Variant.findOneAndUpdate(
          { _id: item.variantId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );

        if (!updated) {
          for (const v of updatedVariants) {
            await Variant.findByIdAndUpdate(v._id, { $inc: { stock: v.quantity } }, { session });
          }
          await session.abortTransaction();
          logger.warn(`Order failed for user ${userId}: insufficient stock`);
          req.session.checkoutFailure = {
            subtotal,
            shipping,
            discount: Number(discount),
            totalAmount: finalAmount,
            errorMessage: MESSAGES.STOCK_OUT
          };
          return res.status(409).json({
            success: false,
            message: MESSAGES.STOCK_OUT
          });
        }
        updatedVariants.push({ _id: item.variantId, quantity: item.quantity });
      }
    }

    let walletTransactionId = null;
    if (paymentMethod === PAYMENT_METHOD.WALLET) {
      const user = await User.findById(userId).select("wallet walletTransactions").session(session);
      if (!user) { throw new Error("User not found"); }
      if ((user.wallet || 0) < finalAmount) {
        await session.abortTransaction();
        req.session.checkoutFailure = {
          subtotal,
          shipping,
          discount: Number(discount),
          totalAmount: finalAmount,
          errorMessage: `${MESSAGES.INSUFFICIENT_WALLET} Available: ₹${(user.wallet || 0).toLocaleString("en-IN")}`
        };
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Available: ₹${(user.wallet || 0).toLocaleString("en-IN")}, Required: ₹${finalAmount.toLocaleString("en-IN")}`
        });
      }

      const tempTransaction = {
        _id: new mongoose.Types.ObjectId(),
        amount: finalAmount,
        type: "debit",
        description: `TEMP_ORDER_${Date.now()}`,
        date: new Date()
      };
      walletTransactionId = tempTransaction._id;

      user.wallet -= finalAmount;
      user.walletTransactions.push(tempTransaction);
      await user.save({ session });
    }

    if (paymentMethod === PAYMENT_METHOD.RAZORPAY && paymentStatus !== PAYMENT_STATUS.FAILED) {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Payment details are missing" });
      }

      const crypto = await import("crypto");
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Payment verification failed" });
      }
    }

    let addressSnapshot = null;
    if (selectedAddress && typeof selectedAddress === "string" && selectedAddress.match(/^[0-9a-fA-F]{24}$/)) {
      const addr = await Address.findById(selectedAddress).lean().session(session);
      if (addr) { addressSnapshot = { fullName: addr.name, phone: addr.phone, address1: addr.street, city: addr.city, state: addr.state, pincode: addr.zip, country: addr.country || "India" }; }
    }
    if (!addressSnapshot) { addressSnapshot = { fullName: "—", phone: "—", address1: "—", city: "—", state: "—", pincode: "—", country: "India" }; }

    const appliedCouponCode = (appliedCoupon || req.body.couponCode || "").trim().toUpperCase() || null;
    const orderDoc = new Order({
      userId,
      products: orderedItems,
      orderDate: new Date(),
      status: paymentStatus === PAYMENT_STATUS.FAILED ? ORDER_STATUS.PENDING : ([PAYMENT_METHOD.RAZORPAY, PAYMENT_METHOD.WALLET].includes(paymentMethod) ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING),
      paymentStatus: paymentStatus === PAYMENT_STATUS.FAILED ? PAYMENT_STATUS.FAILED : ([PAYMENT_METHOD.RAZORPAY, PAYMENT_METHOD.WALLET].includes(paymentMethod) ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING),
      paymentMethod,
      address: addressSnapshot,
      addressId: typeof selectedAddress === "string" ? selectedAddress : null,
      paymentId: razorpay_payment_id || null,
      totalAmount: finalAmount,
      deliveryCharge: shipping,
      discount: Number(discount),
      couponApplied: appliedCouponCode
    });

    await orderDoc.save({ session });

    if (appliedCouponCode && paymentStatus !== PAYMENT_STATUS.FAILED) {
      await Coupon.findOneAndUpdate(
        { code: appliedCouponCode, "usedBy.user": { $ne: userId } },
        { $inc: { usedCount: 1 }, $push: { usedBy: { user: userId, count: 1 } } },
        { session }
      );

      await Coupon.findOneAndUpdate(
        { code: appliedCouponCode, "usedBy.user": userId },
        { $inc: { usedCount: 1, "usedBy.$.count": 1 } },
        { session }
      );
    }

    if (paymentStatus !== PAYMENT_STATUS.FAILED) {
      await Cart.deleteMany({ userId }, { session });
    } else {
      // If payment failed, but order was created, store order ID for retry
      req.session.checkoutFailure = {
        subtotal,
        shipping,
        discount: Number(discount),
        totalAmount: finalAmount,
        errorMessage: paymentStatus === PAYMENT_STATUS.FAILED ? "Razorpay payment failed or was pending." : "Order placed but payment status is unverified.",
        orderRecId: orderDoc._id // Pass the DB ID for retry
      };
    }

    await session.commitTransaction();
    session.endSession();
    logger.info(`Order placed successfully by user ${userId}, orderId ${orderDoc._id}`);

    return res.json({
      success: true,
      redirect: `/checkout/success?orderId=${orderDoc._id}`
    });

  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    logger.error(`placeOrder error for user ${req.user?._id}:`, err);

    req.session.checkoutFailure = {
      subtotal: req.session.checkoutSummary?.subtotal || 0,
      shipping: req.session.checkoutSummary?.shipping || 0,
      discount: req.session.checkoutSummary?.discount || 0,
      totalAmount: req.session.checkoutSummary?.totalAmount || 0,
      errorMessage: err.message || "Failed to place order. Please try again."
    };

    return res.status(500).json({ success: false, message: err.message || "Failed to place order. Please try again." });
  }
};

export const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();

    const coupons = await Coupon.find({
      status: "Active",
      startDate: { $lte: today },
      expiryDate: { $gte: today },
      $or: [
        { specificUsers: { $size: 0 } },
        { specificUsers: userId }
      ]
    })
      .select("code name description discountType discountValue minPurchase maxDiscountLimit perUserLimit totalUsageLimit usedCount usedBy expiryDate")
      .lean();

    const availableCoupons = coupons.filter(coupon => {

      if (coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit) {
        return false;
      }
      const userUsage = coupon.usedBy.find(u => u.user.toString() === userId.toString());
      const userCount = userUsage ? userUsage.count : 0;

      if (userCount >= coupon.perUserLimit) {
        return false;
      }

      return true;
    });

    res.json({
      success: true,
      coupons: availableCoupons
    });

  } catch (error) {
    logger.error(`getAvailableCoupons error for user ${req.user?._id}:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons"
    });
  }
};
export const successPage = async (req, res) => {
  try {
    const orderId = req.query.orderId || (req.session && req.session.lastOrderId);
    let order = null;

    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId)
      order = await Order.findById(orderId)
        .populate("products.productId", "name")
        .populate("products.variantId", "images colorName size")
        .lean();
    }

    res.render("user/order-success", {
      orderId: order ? (order.orderId || order._id) : (orderId || "—"),
      orderTotal: order ? order.totalAmount : null,
      order
    });

    logger.info(`Order success page loaded for orderId ${orderId}`);
  } catch (e) {
    logger.error("successPage error:", e);
    res.render("user/order-success", {
      orderId: "—",
      orderTotal: null,
      order: null
    });
  }
};

export const failurePage = async (req, res) => {
  try {
    const sessionData = req.session.checkoutFailure || {};

    const {
      subtotal = 0,
      shipping = 0,
      discount = 0,
      totalAmount = 0,
      errorMessage = "Your payment was declined or cancelled. No amount was deducted.",
      orderRecId = null
    } = sessionData;

    delete req.session.checkoutFailure;

    res.render("user/order-failure", {
      subtotal,
      shipping,
      discount,
      totalAmount,
      errorMessage,
      orderRecId,
      active: ""
    });
    logger.info("Order failure page loaded");
  } catch (e) {
    logger.error("failurePage error:", e);
    res.render("user/order-failure", {
      subtotal: 0,
      shipping: 0,
      discount: 0,
      totalAmount: 0,
      errorMessage: "Something went wrong with your payment. Please try again."
    });
  }
};