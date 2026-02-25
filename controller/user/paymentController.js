import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import logger from "../../helpers/logger.js";
import mongoose from "mongoose";
import Order from "../../models/orderSchema.js";
import Variant from "../../models/variantSchema.js";
import Cart from "../../models/cartSchema.js";
import Coupon from "../../models/couponSchema.js";
import { ORDER_STATUS, ITEM_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, MESSAGES } from "../../utils/constants.js";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required"
      });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `chronora_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    logger.info(`Razorpay order created: ${order.id}, amount: ${order.amount}`);

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    logger.error("Create Razorpay order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment"
    });
  }
};

export const verifyRazorpayPayment = (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details"
      });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    const isValid = razorpay_signature === expectedSign;

    if (isValid) {
      logger.info(`Razorpay payment verified: ${razorpay_payment_id}`);
      res.json({ success: true, message: MESSAGES.PAYMENT_VERIFIED });
    } else {
      logger.warn(`Razorpay payment verification failed for order: ${razorpay_order_id}`);

      const summary = req.session.checkoutSummary || {};
      req.session.checkoutFailure = {
        subtotal: summary.subtotal || 0,
        shipping: summary.shipping || 0,
        discount: summary.discount || 0,
        totalAmount: summary.totalAmount || 0,
        errorMessage: "Your payment verification failed. Please try again or use another method."
      };

      res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
  } catch (error) {
    logger.error("Razorpay payment verification error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

export const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: MESSAGES.NOT_FOUND });
    }

    if (order.paymentStatus !== PAYMENT_STATUS.FAILED && order.paymentStatus !== PAYMENT_STATUS.PENDING) {
      return res.status(400).json({ success: false, message: "Payment already completed or not eligible for retry" });
    }

    const options = {
      amount: Math.round(order.totalAmount * 100),
      currency: "INR",
      receipt: `retry_${order.orderId}`
    };

    const razorpayOrder = await razorpay.orders.create(options);
    logger.info(`Retry Razorpay order created: ${razorpayOrder.id} for Chronora order: ${orderId}`);

    res.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    logger.error("Retry payment error:", error);
    res.status(500).json({ success: false, message: "Failed to initiate retry payment" });
  }
};

export const verifyRetryPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign === razorpay_signature) {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // 1. Stock Reduction
      for (const item of order.products) {
        if (!item.variantId) continue;

        const updated = await Variant.findOneAndUpdate(
          { _id: item.variantId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );

        if (!updated) {
          await session.abortTransaction();
          session.endSession();
          logger.warn(`Retry payment failed for order ${orderId}: insufficient stock`);
          return res.status(409).json({
            success: false,
            message: MESSAGES.STOCK_OUT
          });
        }
      }

      // 2. Clear Cart
      await Cart.deleteMany({ userId: order.userId }, { session });

      // 3. Update Coupon Usage if applicable
      if (order.couponApplied) {
        const couponCode = order.couponApplied.trim().toUpperCase();
        await Coupon.findOneAndUpdate(
          { code: couponCode, "usedBy.user": { $ne: order.userId } },
          { $inc: { usedCount: 1 }, $push: { usedBy: { user: order.userId, count: 1 } } },
          { session }
        );

        await Coupon.findOneAndUpdate(
          { code: couponCode, "usedBy.user": order.userId },
          { $inc: { usedCount: 1, "usedBy.$.count": 1 } },
          { session }
        );
      }

      // 4. Update Order Status
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.status = ORDER_STATUS.CONFIRMED;
      order.paymentId = razorpay_payment_id;

      order.products.forEach(item => {
        if (item.itemStatus === ITEM_STATUS.PENDING) {
          item.itemStatus = ITEM_STATUS.CONFIRMED;
        }
      });

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();

      logger.info(`Retry payment verified for order: ${orderId}`);
      return res.json({ success: true, message: MESSAGES.PAYMENT_VERIFIED });
    }

    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: "Payment verification failed" });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    logger.error("Verify retry payment error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
