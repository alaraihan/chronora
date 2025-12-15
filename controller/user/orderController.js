import Order from "../../models/orderSchema.js";
import Product from "../../models/productSchema.js";
import Variant from "../../models/variantSchema.js";
import PDFDocument from "pdfkit";

export const getOrdersPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.redirect("/login");

    const orders = await Order.find({ userId })
      .populate({
        path: "products.productId",
        select: "name",
      })
      .populate({
        path: "products.variantId",
        select: "images colorName",
      })
      .sort({ createdAt: -1 })
      .lean();

  
    orders.forEach(order => {
      console.log(`Order ${order.orderId}: Status = ${order.status}`);
    });

    res.render("user/orders", { orders, active: 'Orders' });
  } catch (err) {
    console.error("getOrdersPage:", err);
    res.status(500).send("Server error");
  }
};

export const cancelOrder = async (req, res) => {
  try {
    console.log("=== CANCEL ORDER REQUEST ===");
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("User:", req.user._id);

    const { orderId } = req.params; 
    const { reason } = req.body;

    if (!reason) {
      console.log("ERROR: No reason provided");
      return res.status(400).json({
        success: false,
        message: "Cancel reason required",
      });
    }

    let order = await Order.findOne({ orderId });
    
    if (!order) {
      order = await Order.findById(orderId);
      console.log("Tried finding by _id:", order ? "Found" : "Not found");
    }

    if (!order) {
      console.log("ERROR: Order not found with ID:", orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log("ORDER FOUND:");
    console.log("- Custom orderId:", order.orderId);
    console.log("- MongoDB _id:", order._id);
    console.log("- Current status:", order.status);
    console.log("- User ID in order:", order.userId);
    console.log("- Request user ID:", req.user._id);

    if (order.userId.toString() !== req.user._id.toString()) {
      console.log("ERROR: User doesn't own this order");
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const allowedStatuses = ["Pending", "Confirmed"];
    if (!allowedStatuses.includes(order.status)) {
      console.log(`ERROR: Order in ${order.status} cannot be cancelled`);
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.status} status`,
      });
    }

    
    order.status = "Cancelled";
    order.cancelReason = reason;
    order.products.forEach(item => {
      item.itemStatus = "Cancelled";
      item.reason = reason;
      item.itemTimeline.cancelledAt = new Date();
    });

    order.statusHistory.push({
      status: "Cancelled",
      reason,
      date: new Date()
    });

    const savedOrder = await order.save();
  

    const verifyOrder = await Order.findOne({ orderId: savedOrder.orderId });
 

    if (savedOrder.paymentStatus === "Paid") {
      savedOrder.paymentStatus = "Refunded";
      await savedOrder.save();
      console.log("Payment status updated to Refunded");
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order: {
        orderId: savedOrder.orderId,
        status: savedOrder.status,
        cancelReason: savedOrder.cancelReason,
        cancelledAt: new Date()
      }
    });

  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);
    console.error("Error stack:", error.stack);
    
    if (error.name === 'ValidationError') {
      console.error("Validation errors:", error.errors);
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while cancelling order",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log("Getting order details for:", orderId);
    console.log("User requesting:", req.user._id);

    const order = await Order.findOne({ orderId })
      .populate("products.productId", "name images")
      .populate("products.variantId", "colorName images")
      .lean();

    if (!order) {
      console.log("Order not found:", orderId);
      return res.status(404).render('error', {
        message: 'Order not found'
      });
    }

    console.log("Order found. User ID in order:", order.userId);
    console.log("Order status:", order.status);

    if (order.userId.toString() !== req.user._id.toString()) {
      console.log("Access denied for user:", req.user._id);
      return res.status(403).render('error', {
        message: 'Access denied'
      });
    }

    order._debug = {
      status: order.status,
      cancelReason: order.cancelReason,
      timestamp: new Date().toISOString()
    };

    res.render("user/orderDetail", { 
      order,
      title: `Order ${order.orderId}`
    });

  } catch (err) {
    console.error("getOrderDetails ERROR:", err);
    res.status(500).send("Server error");
  }
};

export const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, refundMethod } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Return reason required",
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    order.status = "ReturnRequested";
    order.returnReason = reason;
    order.refundMethod = refundMethod;
    order.returnRequestedAt = new Date();

    order.products.forEach(item => {
      if (item.itemStatus === "Delivered") {
        item.itemStatus = "ReturnRequested";
        item.reason = reason;
        item.itemTimeline.returnRequestedAt = new Date();
      }
    });

    order.statusHistory.push({
      status: "ReturnRequested",
      reason,
      date: new Date(),
    });

    await order.save();

    return res.json({
      success: true,
      message: "Return request sent to admin for approval",
      order: {
        orderId: order.orderId,
        status: order.status,
      },
    });

  } catch (error) {
    console.error("returnOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const submitOrderReview = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, title, text } = req.body;

    if (!rating || !text) {
      return res.status(400).json({
        success: false,
        message: "Rating and review text are required",
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.review && order.review.rating) {
      return res.status(400).json({
        success: false,
        message: "Review already submitted for this order",
      });
    }

    order.review = {
      rating: Number(rating),
      title,
      text,
      reviewedAt: new Date(),
    };

    await order.save();

    return res.json({
      success: true,
      message: "Review submitted successfully",
    });

  } catch (error) {
    console.error("Submit Review Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while submitting review",
    });
  }
};


export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("Download invoice for:", orderId);

    const order = await Order.findOne({ orderId })
      .populate("products.productId", "name")
      .populate("products.variantId", "colorName");

    if (!order) {
      console.log("Order not found for invoice:", orderId);
      return res.status(404).send("Order not found");
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      console.log("Unauthorized invoice access by:", req.user._id);
      return res.status(403).send("Unauthorized access");
    }

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice-${order.orderId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(20).text("INVOICE", { align: "center" });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Order ID: ${order.orderId}`);
    doc.text(`Status: ${order.status}`);
    if (order.cancelReason) {
      doc.text(`Cancel Reason: ${order.cancelReason}`);
    }
    doc.text(`Date: ${order.createdAt.toLocaleDateString()}`);
    doc.text(`Total: ₹${order.totalAmount.toFixed(2)}`);
    
    doc.moveDown();
    doc.text("Items:");
    
    order.products.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.productId?.name || "Product"} - ${item.variantId?.colorName || "Variant"} × ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`);
    });

    doc.end();
    
  } catch (err) {
    console.error("downloadInvoice ERROR:", err);
    res.status(500).send("Server error");
  }
};