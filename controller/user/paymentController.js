import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import logger from "../../helpers/logger.js";
import Order from "../../models/orderSchema.js";
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
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign === razorpay_signature) {
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = PAYMENT_STATUS.PAID;
        order.status = ORDER_STATUS.CONFIRMED;
        order.paymentId = razorpay_payment_id;

        // Also update individual items if needed
        order.products.forEach(item => {
          if (item.itemStatus === ITEM_STATUS.PENDING) {
            item.itemStatus = ITEM_STATUS.CONFIRMED;
          }
        });

        await order.save();
        logger.info(`Retry payment verified for order: ${orderId}`);
        return res.json({ success: true, message: MESSAGES.PAYMENT_VERIFIED });
      }
    }

    res.status(400).json({ success: false, message: "Payment verification failed" });
  } catch (error) {
    logger.error("Verify retry payment error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
