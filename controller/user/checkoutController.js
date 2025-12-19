import mongoose from "mongoose";
import Cart from "../../models/cartSchema.js";
import Variant from "../../models/variantSchema.js";
import Product from '../../models/productSchema.js';
import Address from "../../models/addressSchema.js";
import Order from '../../models/orderSchema.js'

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

    const cart = await Cart.find({ userId })
      .populate("productId")
      .populate("variantId")
      .lean();

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

    const { subtotal, shipping, grandTotal } = calculateTotals(cart);

    res.render("user/checkout", {
      cartItems: cart,
      addresses,
      user: req.user,
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
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const cartItems = await Cart.find({ userId })
      .populate("productId")
      .populate("variantId")
      .lean();

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    let addressSnapshot = null;
    const selectedAddress = req.body.selectedAddress;
    if (selectedAddress) {
      if (typeof selectedAddress === "string" && selectedAddress.match(/^[0-9a-fA-F]{24}$/)) {
        const addr = await Address.findById(selectedAddress).lean();
        if (addr) {
          addressSnapshot = {
            fullName: addr.name || addr.fullName || "",
            phone: addr.phone || "",
            address1: addr.street || addr.address1 || "",
            address2: addr.address2 || "",
            city: addr.city || "",
            state: addr.state || "",
            pincode: addr.zip || addr.pincode || "",
            country: addr.country || "India",
            addressType: addr.isDefaultShipping ? "Home" : "Other",
          };
        }
      } else if (typeof selectedAddress === "object") {
        addressSnapshot = {
          fullName: selectedAddress.fullName || selectedAddress.name || "",
          phone: selectedAddress.phone || "",
          address1: selectedAddress.address1 || selectedAddress.street || "",
          address2: selectedAddress.address2 || "",
          city: selectedAddress.city || "",
          state: selectedAddress.state || "",
          pincode: selectedAddress.pincode || selectedAddress.zip || "",
          country: selectedAddress.country || "India",
          addressType: selectedAddress.addressType || "Home",
        };
      }
    }

    if (!addressSnapshot && req.body.shippingAddress) {
      const s = req.body.shippingAddress;
      addressSnapshot = {
        fullName: s.fullName || s.name || "",
        phone: s.phone || "",
        address1: s.address1 || s.street || "",
        address2: s.address2 || "",
        city: s.city || "",
        state: s.state || "",
        pincode: s.pincode || s.zip || "",
        country: s.country || "India",
        addressType: s.addressType || "Home",
      };
    }

    if (!addressSnapshot) {
      return res.status(400).json({ success: false, message: "Shipping address required" });
    }

    const orderedItems = cartItems.map(ci => {
  const price = Number(ci.price || 0); 
  const originalPrice = Number(ci.originalPrice || 0);  
  const qty = Number(ci.quantity || 1);

  return {
    productId: ci.productId._id,
    variantId: ci.variantId?._id || null,
    quantity: qty,
    price,                  
    originalPrice,            
    itemStatus: "Pending",
    itemTimeline: {},
  };
});

    const { subtotal, shipping, grandTotal } = calculateTotals(cartItems);
    const discount = Number(req.body.discount || 0) || 0;
    const finalAmount = Number(grandTotal || 0) - discount;

    const orderDoc = new Order({
      userId,
      products: orderedItems,
      orderDate: new Date(),
      status: "Pending",
      address: addressSnapshot,
      addressId: typeof selectedAddress === "string" && selectedAddress.match(/^[0-9a-fA-F]{24}$/) ? selectedAddress : null,
      paymentMethod: req.body.paymentMethod || "cod",
      paymentStatus: req.body.paymentStatus || "Pending",
      paymentId: req.body.paymentId || null,
      totalAmount: finalAmount,
      deliveryCharge: Number(shipping || 0),
      discount,
      products:orderedItems,
      expectedDelivery: req.body.expectedDelivery || null,
    });

    await orderDoc.save();

    for (const it of orderedItems) {
      try {
        if (it.variantId) {
          await Variant.findByIdAndUpdate(it.variantId, { $inc: { stock: -it.quantity } }).exec();
        } else if (it.productId) {
          await Product.findByIdAndUpdate(it.productId, { $inc: { stock: -it.quantity } }).exec();
        }
      } catch (e) {
      }
    }

    await Cart.deleteMany({ userId });

    return res.json({ success: true, redirect: `/checkout/success?orderId=${orderDoc._id}` });

  } catch (err) {
    console.error("placeOrder simple error:", err);
    return res.status(500).json({ success: false, message: "Server error placing order" });
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