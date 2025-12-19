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

    if (isNaN(index) || !rating || rating < 1 || rating > 5 || !text?.trim()) {
      return res.json({ success: false, message: "Invalid review data" });
    }

    const order = await Order.findById(orderId)
      .populate("products.productId")
      .populate("products.variantId");

    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    const item = order.products[index];
    if (!item || item.itemStatus !== "Delivered") {
      return res.json({ success: false, message: "Item not eligible for review" });
    }

    if (!order.reviews) order.reviews = [];

    const alreadyReviewed = order.reviews.some(r => 
      r.productId?.toString() === item.productId._id.toString() &&
      r.variantId?.toString() === item.variantId._id.toString()
    );

    if (alreadyReviewed) {
      return res.json({ success: false, message: "Already reviewed" });
    }

    order.reviews.push({
      productId: item.productId._id,
      variantId: item.variantId._id,
      rating: Number(rating),
      title: title.trim() || null,
      text: text.trim(),
      reviewedAt: new Date()
    });

    await order.save();
    res.json({ success: true, message: "Review submitted!" });
  } catch (err) {
    console.error("reviewOrderItem ERROR:", err);
    res.json({ success: false, message: "Server error" });
  }
};

export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, variantId } = req.query;

    const order = await Order.findOne({ orderId })
      .populate("products.productId", "name")
      .populate("products.variantId", "colorName");

    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).send("Unauthorized");
    }

    let itemsToInclude = order.products;
    if (productId && variantId) {
      itemsToInclude = order.products.filter(p => 
        p.productId?._id?.toString() === productId && 
        p.variantId?._id?.toString() === variantId
      );
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
    doc.pipe(res);

    doc.fontSize(25).text('INVOICE', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(12);
    doc.text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    let total = 0;
    itemsToInclude.forEach((item, i) => {
      const subtotal = item.price * item.quantity;
      total += subtotal;
      doc.text(`${i+1}. ${item.productId?.name || 'Product'} (${item.variantId?.colorName || 'Standard'}) × ${item.quantity} = ₹${subtotal.toLocaleString('en-IN')}`);
      doc.text(`   Status: ${item.itemStatus}`, { indent: 20 });
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.text(`Subtotal: ₹${total.toLocaleString('en-IN')}`);
    if (order.deliveryCharge > 0) doc.text(`Delivery: ₹${order.deliveryCharge.toLocaleString('en-IN')}`);
    if (order.discount > 0) doc.text(`Discount: -₹${order.discount.toLocaleString('en-IN')}`);
    doc.fontSize(16).text(`Total Paid: ₹${order.totalAmount.toLocaleString('en-IN')}`, { bold: true });

    doc.moveDown(2);
    doc.fontSize(10).text('Shipping Address:', { underline: true });
    doc.text(order.address.fullName);
    doc.text(order.address.address1);
    if (order.address.address2) doc.text(order.address.address2);
    doc.text(`${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
    doc.text(`Phone: ${order.address.phone}`);

    doc.end();
  } catch (err) {
    console.error("downloadInvoice ERROR:", err);
    res.status(500).send("Server error");
  }
};

