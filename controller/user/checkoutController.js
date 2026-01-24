import mongoose from "mongoose";
import Cart from "../../models/cartSchema.js";
import Variant from "../../models/variantSchema.js";
import Product from '../../models/productSchema.js';
import Address from "../../models/addressSchema.js";
import Order from '../../models/orderSchema.js'
import Coupon from "../../models/couponSchema.js";
import User from "../../models/userSchema.js";
import getBestOfferForProduct from "../../utils/offerHelper.js";

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
          }
        }
        return item;
      })
    );

    if (!cart || cart.length === 0) {
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
        return res.status(409).json({
          success: false,
          message: "Some items in your cart are out of stock. Please update your cart."
        });
      }
    }

    const addresses = await Address.find({ user: userId })
      .sort({ isDefaultShipping: -1, createdAt: -1 })
      .lean();

    const userWithWallet = await User.findById(userId).select('name email wallet').lean();

    const { subtotal, shipping, grandTotal } = calculateTotals(cart);

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

  } catch (error) {
    console.error("Checkout load error:", error);
    res.redirect("/cart");
  }
};
export const applyCoupon = async(req, res) => {
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
    }).populate('usedBy.user'); 

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon code" });
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
        message: `Minimum purchase of ₹${coupon.minPurchase} required (current: ₹${subtotal})`
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
        message: "This coupon has reached its usage limit" 
      });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountLimit) {
        discount = Math.min(discount, coupon.maxDiscountLimit);
      }
    } else {
      discount = coupon.discountValue;
    }
    
    discount = Math.round(discount);
    
    return res.json({
      success: true,
      discount,
      message: `Coupon "${coupon.code}" applied! ₹${discount} off`
    });
  } catch(error) {
    console.error("Apply coupon error:", error);
    return res.json({ success: false, message: "Error applying coupon. Try again." });
  }
}

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

    if (isDefaultShipping === 'on' || isDefaultShipping === true) {
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
      isDefaultShipping: isDefaultShipping === 'on' || isDefaultShipping === true
    });

    await newAddress.save();

    const addresses = await Address.find({ user: userId })
      .sort({ isDefaultShipping: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      message: "Address added successfully!",
      addresses
    });

  } catch (err) {
    console.error("Add address error:", err);
    res.status(500).json({
      success: false,
      message: "Server error, try again"
    });
  }
};

export const placeOrder = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const {
      selectedAddress,
      paymentMethod,
      discount = 0,
      appliedCoupon,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    let cartItems = await Cart.find({ userId })
      .populate("productId")
      .populate("variantId")
      .lean();

    cartItems = await Promise.all(
      cartItems.map(async (item) => {
        if (item.productId) {
          const offerData = await getBestOfferForProduct(item.productId);
          item.productId.offerData = offerData;
          if (offerData) {
            item.price = offerData.offerPrice;
          }
        }
        return item;
      })
    );

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const { subtotal, shipping, grandTotal } = calculateTotals(cartItems);
    const finalAmount = grandTotal - Number(discount);

    if (finalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order amount" });
    }
     if(paymentMethod==='cod' && finalAmount>1000){
      return res.status(400).json({success:false,message:"Orders above 1000 is not allowed for cod"})
     }
     
    let walletTransactionId = null; 

    if (paymentMethod === "wallet") {
      const user = await User.findById(userId).select('wallet walletTransactions');

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if ((user.wallet || 0) < finalAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Available: ₹${(user.wallet || 0).toLocaleString('en-IN')}, Required: ₹${finalAmount.toLocaleString('en-IN')}`
        });
      }

      const tempTransaction = {
        _id: new mongoose.Types.ObjectId(),
        amount: finalAmount,
        type: "debit",
        description: `TEMP_ORDER_${Date.now()}`,
        date: new Date(),
      };

      walletTransactionId = tempTransaction._id;

      user.wallet -= finalAmount;
      user.walletTransactions.push(tempTransaction);

      await user.save();
    }
    else if (paymentMethod === "razorpay") {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Payment details are missing",
        });
      }
      
      const crypto = await import("crypto");
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed – Invalid signature",
        });
      }
    } 
    else if (!["cod", "wallet"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }

    let addressSnapshot = null;

    if (selectedAddress) {
      if (typeof selectedAddress === "string" && selectedAddress.match(/^[0-9a-fA-F]{24}$/)) {
        const addr = await Address.findById(selectedAddress).lean();
        if (addr) {
          addressSnapshot = {
            fullName: addr.name || "",
            phone: addr.phone || "",
            address1: addr.street || "",
            address2: addr.address2 || "",
            city: addr.city || "",
            state: addr.state || "",
            pincode: addr.zip || "",
            country: addr.country || "India",
            addressType: addr.isDefaultShipping ? "Home" : "Other",
          };
        }
      } else if (typeof selectedAddress === "object") {
        addressSnapshot = {
          fullName: selectedAddress.name || selectedAddress.fullName || "",
          phone: selectedAddress.phone || "",
          address1: selectedAddress.street || selectedAddress.address1 || "",
          address2: selectedAddress.address2 || "",
          city: selectedAddress.city || "",
          state: selectedAddress.state || "",
          pincode: selectedAddress.zip || selectedAddress.pincode || "",
          country: selectedAddress.country || "India",
          addressType: selectedAddress.addressType || "Home",
        };
      }
    }

    if (!addressSnapshot && req.body.shippingAddress) {
      const s = req.body.shippingAddress;
      addressSnapshot = {
        fullName: s.name || s.fullName || "",
        phone: s.phone || "",
        address1: s.street || s.address1 || "",
        address2: s.address2 || "",
        city: s.city || "",
        state: s.state || "",
        pincode: s.zip || s.pincode || "",
        country: s.country || "India",
        addressType: s.addressType || "Home",
      };
    }

    if (!addressSnapshot) {
      return res.status(400).json({ success: false, message: "Shipping address required" });
    }

   const orderedItems = cartItems.map((ci) => {
  const originalPrice = Number(ci.productId?.price || ci.variantId?.price || 0);
  let finalPrice = Number(ci.price || originalPrice); 
  if (ci.productId?.offerData?.offerPrice) {
    finalPrice = Number(ci.productId.offerData.offerPrice);
  }

  return {
    productId: ci.productId._id,
    variantId: ci.variantId?._id || null,
    quantity: Number(ci.quantity || 1),
    price: finalPrice,                   
    originalPrice: originalPrice,         
    itemStatus: "Pending",
    offerData: ci.productId?.offerData || null,
  };
});

    const appliedCouponCode = (appliedCoupon || req.body.couponCode || "").trim().toUpperCase() || null;

    const orderDoc = new Order({
      userId,
      products: orderedItems,
      orderDate: new Date(),
      status: ["razorpay", "wallet"].includes(paymentMethod) ? "Confirmed" : "Pending",
      paymentStatus: ["razorpay", "wallet"].includes(paymentMethod) ? "Paid" : "Pending",
      paymentMethod: paymentMethod,
      address: addressSnapshot,
      addressId:
        typeof selectedAddress === "string" && selectedAddress.match(/^[0-9a-fA-F]{24}$/)
          ? selectedAddress
          : null,
      paymentId: razorpay_payment_id || null,
      totalAmount: finalAmount,
      deliveryCharge: shipping,
      discount: Number(discount),
      couponApplied: appliedCouponCode,
      expectedDelivery: req.body.expectedDelivery || null,
    });

    await orderDoc.save();

    if (paymentMethod === "wallet" && walletTransactionId) {
      await User.updateOne(
        {
          _id: userId,
          "walletTransactions._id": walletTransactionId
        },
        {
          $set: {
            "walletTransactions.$.description": `Order payment - Order #${orderDoc._id}`
          }
        }
      );
    }

    for (const item of orderedItems) {
      if (!item.variantId) continue;

      const updatedVariant = await Variant.findOneAndUpdate(
        { _id: item.variantId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedVariant) {
        if (paymentMethod === "wallet" && walletTransactionId) {
          await User.findByIdAndUpdate(userId, {
            $inc: { wallet: finalAmount },
            $pull: { walletTransactions: { _id: walletTransactionId } } 
          });
        }

        await Order.findByIdAndDelete(orderDoc._id);

        return res.status(409).json({
          success: false,
          message: "One or more items are out of stock. Order cancelled." + 
                   (paymentMethod === "wallet" ? " Wallet amount refunded." : "")
        });
      }
    }

    await Cart.deleteMany({ userId });

   if (appliedCouponCode) {
  await Coupon.findOneAndUpdate(
    { 
      code: appliedCouponCode,
      'usedBy.user': { $ne: userId } 
    },
    { 
      $inc: { usedCount: 1 },
      $push: { 
        usedBy: { 
          user: userId, 
          count: 1 
        } 
      }
    }
  );

  await Coupon.findOneAndUpdate(
    { 
      code: appliedCouponCode,
      'usedBy.user': userId 
    },
    { 
      $inc: { 
        usedCount: 1,
        'usedBy.$.count': 1 
      }
    }
  );
}

    return res.json({
      success: true,
      redirect: `/checkout/success?orderId=${orderDoc._id}`,
    });

  } catch (err) {
    console.error("placeOrder error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to place order. Please try again.",
    });
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
    .select('code name description discountType discountValue minPurchase maxDiscountLimit perUserLimit totalUsageLimit usedCount usedBy expiryDate')
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
    console.error("Get available coupons error:", error);
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
      order = await Order.findById(orderId).lean();
    }
    res.render("user/order-success", {
      orderId: order ? (order.orderId || order._id) : (orderId || "—"),
      orderTotal: order ? order.totalAmount : null,
      order,
    });
  } catch (e) {
    console.error("successPage error:", e);
    res.render("user/order-success", { orderId: "—", orderTotal: null, order: null });
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
      errorMessage = "Your payment was declined or cancelled. No amount was deducted."
    } = sessionData;

    delete req.session.checkoutFailure;

    res.render("user/order-failure", {
      subtotal,
      shipping,
      discount,
      totalAmount,
      errorMessage,
    });
  } catch (e) {
    console.error("failurePage error:", e);
    res.render("user/order-failure", {
      subtotal: 0,
      shipping: 0,
      discount: 0,
      totalAmount: 0,
      errorMessage: "Something went wrong with your payment. Please try again.",
    });
  }
};