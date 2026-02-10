import Razorpay from "razorpay";
import Order from "../../models/orderSchema.js";
import User from "../../models/userSchema.js";
import Variant from "../../models/variantSchema.js";
import dotenv from "dotenv";
import logger from "../../helpers/logger.js";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export const processRefund = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.body;
    const index = parseInt(itemIndex);
    logger.info("Refund requested", { orderId, itemIndex: index });

    const order = await Order.findById(orderId)
      .populate("userId", "wallet")
      .populate("products.productId")
      .populate("products.variantId");

    if (!order) {      logger.warn("Order not found in processRefund", { orderId });

    return res.json({ success: false, message: "Order not found" });}

    const item = order.products[index];
    if (!item) {
            logger.warn("Item not found in order during refund", { orderId, itemIndex: index });
return res.json({ success: false, message: "Item not found in order" });}

    if (item.itemStatus !== "ReturnApproved") {
            logger.warn("Refund attempted for item not ReturnApproved", { orderId, itemIndex: index, itemStatus: item.itemStatus });

      return res.json({
        success: false,
        message: "Refund can only be processed when status is 'Return Approved'"
      });
    }

    if (item.itemTimeline?.returnedAt) {
            logger.warn("Refund already processed for item", { orderId, itemIndex: index });
      return res.json({
        success: false,
        message: "Refund has already been processed for this item"
      });
    }

    const itemsTotalBeforeDiscount = order.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const couponDiscount = order.discount || 0;

    const itemSubtotal = item.price * item.quantity;
    const itemShareOfDiscount = itemsTotalBeforeDiscount > 0
      ? (itemSubtotal / itemsTotalBeforeDiscount) * couponDiscount
      : 0;

    const refundableAmount = itemSubtotal - itemShareOfDiscount;

    if (refundableAmount <= 0) {
            logger.info("Refund amount zero (fully covered by coupon)", { orderId, itemIndex: index });
      return res.json({
        success: false,
        message: "Refundable amount is zero (fully covered by coupon)"
      });
    }

    let refundMessage = `₹${refundableAmount.toFixed(2)} refunded`;
    let razorpayRefundId = null;

    if (order.paymentMethod === "razorpay" && order.paymentId) {
      try {
        const refundAmountMoney = Math.round(refundableAmount * 100);
        const refund = await razorpay.payments.refund(order.paymentId, {
          amount: refundAmountMoney,
          speed: "optimum",
          notes: {
            order_id: order.orderId,
            item: `${item.productId.name} x ${item.quantity}`,
            reason: item.reason || "Return approved"
          }
        });
        razorpayRefundId = refund.id;
        refundMessage += " via Razorpay";
                logger.info("Razorpay refund successful", { orderId, itemIndex: index, refundId: razorpayRefundId });

      } catch (err) {
        logger.error("Razorpay refund failed", { orderId, itemIndex: index, error: err });
        refundMessage += " — Razorpay failed, credited to wallet instead";
      }
    } else {
      refundMessage += " (credited to wallet)";
            logger.info("Refund credited to wallet (non-Razorpay)", { orderId, itemIndex: index });
    }

    await User.updateOne(
      { _id: order.userId._id },
      {
        $inc: { wallet: refundableAmount },
        $push: {
          walletTransactions: {
            amount: refundableAmount,
            type: "credit",
            description: `Refund for returned item - Order #${order.orderId} (${order.paymentMethod.toUpperCase()})`,
            date: new Date()
          }
        }
      }
    );

    refundMessage += " + credited to Chronora Wallet";

    if (item.variantId?._id || item.variantId) {
      await Variant.findByIdAndUpdate(
        item.variantId._id || item.variantId,
        { $inc: { stock: item.quantity } }
      );
            logger.info("Stock restored for returned variant", { variantId: item.variantId, quantity: item.quantity });

    }

    item.itemStatus = "Returned";
    item.itemTimeline.returnedAt = new Date();

    const allReturned = order.products.every(p => ["Cancelled", "Returned"].includes(p.itemStatus));
    if (allReturned) {
      order.status = "Returned";
      order.paymentStatus = "Refunded";
    } else if (order.products.some(p => p.itemStatus === "Returned")) {
      order.status = "Partially Returned";
      order.paymentStatus = "Partially Refunded";
    }

    await order.save();
    logger.info("Order updated after refund", { orderId, itemIndex: index, newStatus: item.itemStatus });
    return res.json({
      success: true,
      message: refundMessage,
      refundableAmount: refundableAmount.toFixed(2)
    });

  } catch (error) {
    logger.error("Refund processing error", { error });
    return res.json({
      success: false,
      message: "Refund failed: " + (error.message || "Unknown error")
    });
  }
};