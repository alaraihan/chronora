import Order from "../../models/orderSchema.js";
import Variant from "../../models/variantSchema.js";

// Renders the EJS page (NO DB LOGIC HERE)
export const renderAdminOrdersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const status = req.query.status || "";

    res.render("admin/orders", {
      title: "Order Management",
      currentPage: page,
      totalPages: 1,
      totalOrders: 0,
      search,
      status,
      page: "order"
    });

  } catch (error) {
    console.error("RENDER ORDERS PAGE ERROR:", error);
    res.status(500).send("Server error");
  }
};

export const getAdminOrdersData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const status = req.query.status?.trim() || "";
    const search = req.query.search?.trim() || "";

    let query = {};

    // Always fetch orders that match the status (if any)
    if (status) {
      query["products.itemStatus"] = status;
    }

    // Basic search on order fields (helps reduce data if many orders)
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { orderId: regex },
        { "address.fullName": regex },
        { "address.phone": regex }
      ];
    }

    // Fetch all potentially matching orders (no limit here)
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .populate("products.productId", "name images price")
      .populate("products.variantId", "colorName size stock images")
      .sort({ createdAt: -1 })
      .lean();

    // Start with all fetched orders
    let filteredOrders = orders.map(order => ({ ...order })); // deep-ish copy for safety

    // First: Apply status filter - keep only items with matching status
    if (status) {
      filteredOrders = filteredOrders.map(order => ({
        ...order,
        products: order.products.filter(p => p.itemStatus === status)
      })).filter(order => order.products.length > 0);
    }

    // Second: Apply search filter (including product name) on the current filtered list
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredOrders = filteredOrders.map(order => ({
        ...order,
        products: order.products.filter(p =>
          order.orderId.toLowerCase().includes(lowerSearch) ||
          (order.address?.fullName || "").toLowerCase().includes(lowerSearch) ||
          (order.address?.phone || "").includes(lowerSearch) ||
          (p.productId?.name || "").toLowerCase().includes(lowerSearch)
        )
      })).filter(order => order.products.length > 0);
    }

    // Flatten to line items
    let lineItems = [];
    filteredOrders.forEach(order => {
      order.products.forEach((prod, idx) => {
        lineItems.push({
          orderId: order.orderId,
          _id: order._id,
          createdAt: order.createdAt,
          address: order.address,
          products: [prod],
          itemIndex: idx
        });
      });
    });

    // Pagination
    const totalLineItems = lineItems.length;
    const totalPages = Math.ceil(totalLineItems / limit);
    const start = (page - 1) * limit;
    const paginatedItems = lineItems.slice(start, start + limit);

    res.json({
      success: true,
      orders: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages: totalPages || 1,
        totalOrders: totalLineItems,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("GET ORDERS DATA ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// All your other functions remain EXACTLY as they were
export const getAdminOrdersPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const totalOrders = await Order.countDocuments();

    res.render("admin/orders", {
      title: "Order Management",
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      search: "",
      status: "",
      page: "order"
    });

  } catch (error) {
    console.error("ORDERS PAGE ERROR:", error);
    res.status(500).send("Server Error");
  }
};

/* ================= SINGLE ORDER ITEM DETAIL ================= */
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.params;
    const index = parseInt(itemIndex);

    if (isNaN(index)) {
      return res.redirect("/admin/orders");
    }

    const order = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .populate({
        path: "products.productId",
        select: "name price images"
      })
      .populate({
        path: "products.variantId",
        select: "images colorName size stock"
      })
      .lean();

    if (!order || !order.products[index]) {
      return res.status(404).send("Item not found");
    }

    const item = order.products[index];
    item.orderId = order.orderId;
    item.totalAmount = order.totalAmount;
    item.paymentMethod = order.paymentMethod;
    item.paymentStatus = order.paymentStatus;
    item.createdAt = order.createdAt;
    item.address = order.address;

    res.render("admin/order-details", {
      order,
      item,
      itemIndex: index,
      title: `Item Detail - #${order.orderId}`,
      page: "order-detail"
    });
  } catch (error) {
    console.error("ORDER ITEM DETAIL ERROR:", error);
    res.redirect("/admin/orders");
  }
};

/* ================= UPDATE OVERALL ORDER STATUS ================= */
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    console.log("UPDATE OVERALL ORDER STATUS:", { orderId, status });

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const itemValidStatuses = ["Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
    
    if (itemValidStatuses.includes(status)) {
      order.products.forEach((item, index) => {
        if (item.itemStatus !== 'ReturnRequested') {
          const oldItemStatus = item.itemStatus;
          item.itemStatus = status;
          
          if (!item.itemTimeline) item.itemTimeline = {};
          const timelineMap = {
            'Confirmed': 'confirmedAt',
            'Processing': 'processedAt',
            'Shipped': 'shippedAt',
            'Out for Delivery': 'outForDeliveryAt',
            'Delivered': 'deliveredAt',
            'Cancelled': 'cancelledAt'
          };
          
          if (timelineMap[status]) {
            item.itemTimeline[timelineMap[status]] = new Date();
          }
          
          console.log(`Item ${index} updated: ${oldItemStatus} → ${status}`);
        }
      });
      
      order.markModified('products');
    }

    const oldStatus = order.status;
    order.status = status;

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: `Order status manually updated: ${oldStatus} → ${status}`,
      previousStatus: oldStatus,
      changedBy: "Admin",
      date: new Date(),
      note: `All items (except return requested) also updated to ${status}`
    });

    await order.save();

    res.json({
      success: true,
      message: `Order and items updated to ${status}`,
      status: status
    });

  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateItemStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex, status } = req.body;

    if (itemIndex == null || !status) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.products[itemIndex];
    if (!item) return res.status(400).json({ success: false, message: 'Item not found' });

    item.itemStatus = status;

    item.itemTimeline ||= {};
    const timelineMap = {
      Confirmed: 'confirmedAt',
      Processing: 'processedAt',
      Shipped: 'shippedAt',
      'Out for Delivery': 'outForDeliveryAt',
      Delivered: 'deliveredAt',
      Cancelled: 'cancelledAt',
      ReturnApproved: 'returnApprovedAt',
      ReturnRejected: 'returnRejectedAt',
    };
    if (timelineMap[status]) item.itemTimeline[timelineMap[status]] = new Date();

    order.markModified('products');
    await order.save();

    res.json({ success: true, message: 'Item status updated successfully' });
  } catch (error) {
    console.error('UPDATE ITEM ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveItemReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.products[itemIndex] == null) return res.status(400).json({ message: 'Invalid' });

    const item = order.products[itemIndex];
    item.itemStatus = 'ReturnApproved';
    item.itemTimeline.returnApprovedAt = new Date();

    order.markModified('products');
    await order.save();

    res.json({ success: true, message: 'Return approved' });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};

export const rejectItemReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.products[itemIndex] == null) return res.status(400).json({ message: 'Invalid' });

    const item = order.products[itemIndex];
    item.itemStatus = 'Delivered';
    item.itemTimeline.returnRejectedAt = new Date();

    order.markModified('products');
    await order.save();

    res.json({ success: true, message: 'Return rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};

/* ================= PRINT ORDER ================= */
export const printOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .populate("products.productId", "name price images")
      .populate("products.variantId", "colorName")
      .lean();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("admin/order-print", {
      order,
      title: `Invoice #${order.orderId}`,
      page: "order",
    });

  } catch (error) {
    console.error("PRINT ORDER ERROR:", error);
    res.status(500).send("Server Error");
  }
};

export const markOrderAsReturned = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("products.variantId");
    if (!order) return res.json({ success: false });

    order.status = "Returned";

    for (const item of order.products) {
      if (item.itemStatus === "ReturnApproved") {
        if (item.variantId) {
          await Variant.findByIdAndUpdate(item.variantId._id || item.variantId, {
            $inc: { stock: item.quantity },
          });
        }
        item.itemStatus = "Returned";
        item.itemTimeline ||= {};
        item.itemTimeline.returnedAt = new Date();
      }
    }

    order.statusHistory.push({
      status: "Returned",
      reason: "Products received",
      changedBy: "Admin",
      date: new Date(),
    });

    await order.save();

    res.json({ success: true, message: "Order marked as returned" });
  } catch (error) {
    console.error("MARK RETURNED ERROR:", error);
    res.json({ success: false });
  }
};

export const markItemAsReturned = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex } = req.body;
    const index = parseInt(itemIndex);

    const order = await Order.findById(orderId).populate("products.variantId");
    if (!order || order.products[index] == null) {
      return res.json({ success: false, message: "Invalid order or item" });
    }

    const item = order.products[index];
    if (item.itemStatus !== "ReturnApproved") {
      return res.json({ success: false, message: "Item must be Return Approved first" });
    }

    if (item.variantId) {
      await Variant.findByIdAndUpdate(item.variantId._id || item.variantId, {
        $inc: { stock: item.quantity }
      });
    }

    item.itemStatus = "Returned";
    item.itemTimeline ||= {};
    item.itemTimeline.returnedAt = new Date();

    order.markModified('products');
    await order.save();

    res.json({ success: true, message: "Item marked as returned and stock restored" });
  } catch (error) {
    console.error("MARK ITEM RETURNED ERROR:", error);
    res.json({ success: false, message: "Server error" });
  }
};