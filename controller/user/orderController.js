import Order from "../../models/orderSchema.js";
import Variant from "../../models/variantSchema.js";
import PDFDocument from "pdfkit";

export const getOrdersPage = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.redirect("/login");

    const orders = await Order.find({ userId })
      .populate({
        path: "products.productId",
        select: "name images"
      })
      .populate({
        path: "products.variantId",
        select: "images colorName size"
      })
      .sort({ createdAt: -1 })
      .lean();

    res.render("user/orders", { orders, active: 'Orders' });
  } catch (err) {
    console.error("getOrdersPage ERROR:", err);
    res.status(500).send("Server error");
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, variantId } = req.query;

    const order = await Order.findOne({ orderId })
      .populate("products.productId", "name images")
      .populate("products.variantId", "colorName images size")
      .lean();

    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.status(404).render('user/error', { message: 'Order not found or access denied' });
    }

    res.render("user/orderDetail", { 
      order,
      requestedProductId: productId || null,
      requestedVariantId: variantId || null,
      title: `Order ${order.orderId}`,
      active: 'Orders'
    });
  } catch (err) {
    console.error("getOrderDetails ERROR:", err);
    res.status(500).render('user/error', { message: 'Server error' });
  }
};

export const cancelOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex, reason } = req.body;
    const index = parseInt(itemIndex);

    if (isNaN(index) || !reason?.trim()) {
      return res.json({ success: false, message: "Invalid data" });
    }

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    const item = order.products[index];
    if (!item) return res.json({ success: false, message: "Item not found" });

    const allowed = ["Pending", "Confirmed", "Processing"];
    if (!allowed.includes(item.itemStatus)) {
      return res.json({ success: false, message: `Cannot cancel (${item.itemStatus})` });
    }

    item.itemStatus = "Cancelled";
    item.reason = reason.trim();
    item.itemTimeline ||= {};
    item.itemTimeline.cancelledAt = new Date();

    order.markModified('products');
    await order.save();

    res.json({ success: true, message: "Item cancelled successfully" });
  } catch (err) {
    console.error("cancelOrderItem ERROR:", err);
    res.json({ success: false, message: "Server error" });
  }
};

export const returnOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex, reason } = req.body;
    const index = parseInt(itemIndex);

    if (isNaN(index) || !reason?.trim()) {
      return res.json({ success: false, message: "Invalid data" });
    }

    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    const item = order.products[index];
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.itemStatus !== "Delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }

    item.itemStatus = "ReturnRequested";
    item.reason = reason.trim();
    item.itemTimeline ||= {};
    item.itemTimeline.returnRequestedAt = new Date();

    order.markModified('products');
    await order.save();

 

    res.json({ success: true, message: "Return request submitted" });
  } catch (err) {
    console.error("returnOrderItem ERROR:", err);
    res.json({ success: false, message: "Server error" });
  }
};
export const reviewOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex, rating, title = "", text } = req.body;

    const index = parseInt(itemIndex);
    const numRating = Number(rating);

    if (isNaN(index) || index < 0) {
      return res.json({ success: false, message: "Invalid item selection" });
    }

    if (!numRating || numRating < 1 || numRating > 5) {
      return res.json({ success: false, message: "Please select a rating from 1 to 5 stars" });
    }

    if (!text || text.trim().length < 5) {
      return res.json({ success: false, message: "Review must be at least 5 characters" });
    }

    const order = await Order.findById(orderId)
      .populate("products.productId")
      .populate("products.variantId");

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.json({ success: false, message: "Unauthorized access" });
    }

    const item = order.products[index];
    if (!item) {
      return res.json({ success: false, message: "Item not found in this order" });
    }

    if (item.itemStatus !== "Delivered") {
      return res.json({ 
        success: false, 
        message: `Cannot review item with status: ${item.itemStatus}. Only Delivered items can be reviewed.` 
      });
    }

    const alreadyReviewed = order.reviews?.some(r => 
      r.productId?.toString() === item.productId._id.toString() &&
      r.variantId?.toString() === item.variantId._id.toString()
    );

    if (alreadyReviewed) {
      return res.json({ success: false, message: "You have already reviewed this item" });
    }

    order.reviews.push({
      productId: item.productId._id,
      variantId: item.variantId._id,
      rating: numRating,
      title: title.trim() || null,
      text: text.trim(),
      reviewedAt: new Date(),
    });

    await order.save();

    res.json({ 
      success: true, 
      message: "Thank you! Your review has been submitted successfully." 
    });

  } catch (err) {
    console.error("reviewOrderItem ERROR:", err);
    res.json({ success: false, message: "Server error. Please try again later." });
  }
};
export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params; 

    const order = await Order.findOne({ orderId })
      .populate("products.productId", "name")
      .populate("products.variantId", "colorName images");

    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.status(404).send("Invoice not found or access denied");
    }

    res.render("user/invoice", { 
      order,
      title: `Invoice - ${order.orderId}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};