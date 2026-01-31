import Order from "../../models/orderSchema.js";
import Variant from "../../models/variantSchema.js";

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
    const status = (req.query.status || "").trim();
    const search = (req.query.search || "").trim();

    const query = {};
    if (status) {
      query["products.itemStatus"] = status;
    }

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .populate("products.productId", "name price images")
      .populate("products.variantId", "colorName size images")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const lineItems = [];

    for (const order of orders) {
      if (!order.products?.length) {continue;}

      for (let i = 0; i < order.products.length; i++) {
        const prod = order.products[i];

        if (status && prod.itemStatus !== status) {continue;}

        lineItems.push({
          _id: order._id.toString(),
          orderId: order.orderId,
          createdAt: order.createdAt,
          address: order.address || {},
          products: [prod],
          itemIndex: i,
          totalAmount: order.totalAmount || 0
        });
      }
    }

    let filtered = lineItems;
    if (search) {
      const term = search.toLowerCase();
      filtered = lineItems.filter(item => {
        const prod = item.products[0] || {};
        const p = prod.productId || {};
        return (
          item.orderId?.toLowerCase().includes(term) ||
          item.address?.fullName?.toLowerCase().includes(term) ||
          item.address?.phone?.includes(term) ||
          p.name?.toLowerCase().includes(term)
        );
      });
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    res.json({
      success: true,
      orders: paginated,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalOrders: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (err) {
    console.error("GET ADMIN ORDERS DATA CRASH:", err);
    res.status(500).json({
      success: false,
      message: "Server error - see console for details",
      error: err.message
    });
  }
};
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
        if (item.itemStatus !== "ReturnRequested") {
          const oldItemStatus = item.itemStatus;
          item.itemStatus = status;

          if (!item.itemTimeline) {item.itemTimeline = {};}
          const timelineMap = {
            "Confirmed": "confirmedAt",
            "Processing": "processedAt",
            "Shipped": "shippedAt",
            "Out for Delivery": "outForDeliveryAt",
            "Delivered": "deliveredAt",
            "Cancelled": "cancelledAt"
          };

          if (timelineMap[status]) {
            item.itemTimeline[timelineMap[status]] = new Date();
          }

          console.log(`Item ${index} updated: ${oldItemStatus} → ${status}`);
        }
      });

      order.markModified("products");
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
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const order = await Order.findById(orderId);
    if (!order) {return res.status(404).json({ success: false, message: "Order not found" });}

    const item = order.products[itemIndex];
    if (!item) {return res.status(400).json({ success: false, message: "Item not found" });}

    item.itemStatus = status;

    item.itemTimeline ||= {};
    const timelineMap = {
      Confirmed: "confirmedAt",
      Processing: "processedAt",
      Shipped: "shippedAt",
      "Out for Delivery": "outForDeliveryAt",
      Delivered: "deliveredAt",
      Cancelled: "cancelledAt",
      ReturnApproved: "returnApprovedAt",
      ReturnRejected: "returnRejectedAt"
    };
    if (timelineMap[status]) {item.itemTimeline[timelineMap[status]] = new Date();}

    order.markModified("products");
    await order.save();

    res.json({ success: true, message: "Item status updated successfully" });
  } catch (error) {
    console.error("UPDATE ITEM ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const approveItemReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.products[itemIndex] == null) {return res.status(400).json({ message: "Invalid" });}

    const item = order.products[itemIndex];
    item.itemStatus = "ReturnApproved";
    item.itemTimeline.returnApprovedAt = new Date();

    order.markModified("products");
    await order.save();

    res.json({ success: true, message: "Return approved" });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const rejectItemReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.products[itemIndex] == null) {return res.status(400).json({ message: "Invalid" });}

    const item = order.products[itemIndex];
    item.itemStatus = "Delivered";
    item.itemTimeline.returnRejectedAt = new Date();

    order.markModified("products");
    await order.save();

    res.json({ success: true, message: "Return rejected" });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

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
      page: "order"
    });

  } catch (error) {
    console.error("PRINT ORDER ERROR:", error);
    res.status(500).send("Server Error");
  }
};

export const markOrderAsReturned = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("products.variantId");
    if (!order) {return res.json({ success: false });}

    order.status = "Returned";

    for (const item of order.products) {
      if (item.itemStatus === "ReturnApproved") {
        if (item.variantId) {
          await Variant.findByIdAndUpdate(item.variantId._id || item.variantId, {
            $inc: { stock: item.quantity }
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
      date: new Date()
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

    order.markModified("products");
    await order.save();

    res.json({ success: true, message: "Item marked as returned and stock restored" });
  } catch (error) {
    console.error("MARK ITEM RETURNED ERROR:", error);
    res.json({ success: false, message: "Server error" });
  }
};