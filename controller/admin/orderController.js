import Order from "../../models/orderSchema.js";
import Variant from '../../models/variantSchema.js';

export const getAdminOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const status = req.query.status || '';
    const search = req.query.search || '';
    const query = {};
    
    if (status) {
      const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Confirmed', 
        'processing': 'Processing',
        'shipped': 'Shipped',
        'out for delivery': 'Out for Delivery',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'returned': 'Returned'
      };
      query.status = statusMap[status.toLowerCase()] || status;
    }
    
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'address.fullName': { $regex: search, $options: 'i' } },
        { 'address.phone': { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);
    
    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const buildPaginationUrl = (pageNum) => {
      let url = `/admin/orders?page=${pageNum}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (status) url += `&status=${encodeURIComponent(status)}`;
      return url;
    };
    
    res.render("admin/orders", {
      orders,
      title: "Order Management",
      currentPage: page,
      totalPages,
      totalOrders,
      search,
      status,
      hasFilters: search || status,
      buildPaginationUrl,
      page: "order"
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server Error");
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate({
        path: 'products.productId',
        select: 'name price images'
      })
      .populate({
        path: 'products.variantId',
        select: 'images colorName'
      })
      .lean();
    
    if (!order) {
      return res.redirect('/admin/orders');
    }
    
    console.log('Order Status:', order.status);
    
    const timeline = order.statusHistory || [];
    
    const allStatuses = [
      'Pending', 'Confirmed', 'Processing', 'Shipped', 
      'Out for Delivery', 'Delivered'
    ];
    
    const currentStatusIndex = allStatuses.indexOf(order.status);
    
    let nextStatuses = [];
    if (currentStatusIndex >= 0 && currentStatusIndex < 5) {
      nextStatuses = allStatuses.slice(currentStatusIndex + 1);
    }
    
    const hasCancelRequest = order.status === 'CancelRequested' || order.status === 'Cancel Requested';
    const hasReturnRequest = order.status === 'ReturnRequested' || order.status === 'Return Requested';
    
    res.render("admin/order-details", {
      order,
      timeline,
      nextStatuses,
      hasCancelRequest,  
      hasReturnRequest,  
      title: `Order #${order.orderId} Details`,
      page: "order-detail"
    });
    
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.redirect('/admin/orders');
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, reason } = req.body;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    const validStatuses = [
      'Pending', 'Confirmed', 'Processing', 'Shipped', 
      'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.json({ success: false, message: 'Invalid status' });
    }
    
    const currentIndex = validStatuses.indexOf(order.status);
    const newIndex = validStatuses.indexOf(status);
    
    if (status !== 'Cancelled' && status !== 'Returned') {
      if (newIndex <= currentIndex) {
        return res.json({ 
          success: false, 
          message: 'Cannot move back to previous status' 
        });
      }
    }
    
    const oldStatus = order.status;
    order.status = status;
    
    order.products.forEach(item => {
      item.itemStatus = status;
      
      const timelineField = status.toLowerCase().replace(/ /g, '') + 'At';
      if (!item.itemTimeline) item.itemTimeline = {};
      item.itemTimeline[timelineField] = new Date();
    });
    
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: status,
      reason: reason || '',
      changedBy: 'Admin',
      date: new Date(),
      previousStatus: oldStatus
    });
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Order status updated successfully',
      order: order.toObject()
    });
    
  } catch (error) {
    console.error("Error updating status:", error);
    res.json({ success: false, message: 'Error updating status' });
  }
};

export const updateItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    const item = order.products.id(itemId);
    
    if (!item) {
      return res.json({ success: false, message: 'Item not found' });
    }
    
    item.itemStatus = status;
    
    const timelineField = status.toLowerCase().replace(/ /g, '') + 'At';
    if (!item.itemTimeline) item.itemTimeline = {};
    item.itemTimeline[timelineField] = new Date();
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Item status updated successfully' 
    });
    
  } catch (error) {
    console.error("Error updating item status:", error);
    res.json({ success: false, message: 'Error updating status' });
  }
};

export const printOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate('products.productId', 'name price')
      .lean();
    
    if (!order) {
      return res.status(404).send("Order not found");
    }
    
    res.render("admin/order-print", {
      order,
      title: `Invoice #${order.orderId}`,
      page:'order',
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server Error");
  }
};

export const approveCancelRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    if (order.status !== 'CancelRequested' && order.status !== 'Cancel Requested') {
      return res.json({ success: false, message: 'No cancel request found' });
    }
    
    const oldStatus = order.status;
    order.status = 'Cancelled';
    
    order.products.forEach(item => {
      item.itemStatus = 'Cancelled';
      if (!item.itemTimeline) item.itemTimeline = {};
      item.itemTimeline.cancelledAt = new Date();
    });
    
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'Cancelled',
      reason: reason || 'Cancel request approved by admin',
      changedBy: 'Admin',
      date: new Date(),
      previousStatus: oldStatus
    });
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Cancel request approved successfully'
    });
    
  } catch (error) {
    console.error("Error approving cancel request:", error);
    res.json({ success: false, message: 'Error approving cancel request' });
  }
};

export const rejectCancelRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    if (order.status !== 'CancelRequested' && order.status !== 'Cancel Requested') {
      return res.json({ success: false, message: 'No cancel request found' });
    }
    
    const previousStatus = order.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory[order.statusHistory.length - 1].previousStatus
      : 'Pending';
    
    const oldStatus = order.status;
    order.status = previousStatus;
    
    order.products.forEach(item => {
      item.itemStatus = previousStatus;
    });
    
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: previousStatus,
      reason: reason || 'Cancel request rejected by admin',
      changedBy: 'Admin',
      date: new Date(),
      previousStatus: oldStatus
    });
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Cancel request rejected successfully'
    });
    
  } catch (error) {
    console.error("Error rejecting cancel request:", error);
    res.json({ success: false, message: 'Error rejecting cancel request' });
  }
};

export const approveReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    // ✅ FIXED: Check both possible formats
    if (order.status !== 'ReturnRequested' && order.status !== 'Return Requested') {
      return res.json({ success: false, message: 'No return request found' });
    }

    const oldStatus = order.status;
    order.status = 'ReturnApproved';

    order.products.forEach(item => {
      if (item.itemStatus === 'ReturnRequested' || item.itemStatus === 'Return Requested') {
        item.itemStatus = 'ReturnApproved';
        item.itemTimeline ||= {};
        item.itemTimeline.returnApprovedAt = new Date();
      }
    });

    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'ReturnApproved',
      reason: reason || 'Return approved by admin',
      changedBy: 'Admin',
      previousStatus: oldStatus,
      date: new Date()
    });

    await order.save();

    res.json({
      success: true,
      message: 'Return approved. Awaiting product receipt.'
    });

  } catch (error) {
    console.error("Approve return error:", error);
    res.json({ success: false, message: 'Error approving return request' });
  }
};

export const rejectReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'ReturnRequested' && order.status !== 'Return Requested') {
      return res.json({ success: false, message: 'No return request found' });
    }

    const oldStatus = order.status;
    order.status = 'Delivered';

    order.products.forEach(item => {
      if (item.itemStatus === 'ReturnRequested' || item.itemStatus === 'Return Requested') {
        item.itemStatus = 'Delivered';
      }
    });

    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'Delivered',
      reason: reason || 'Return rejected by admin',
      changedBy: 'Admin',
      previousStatus: oldStatus,
      date: new Date()
    });

    await order.save();

    res.json({
      success: true,
      message: 'Return request rejected successfully'
    });

  } catch (error) {
    console.error("Reject return error:", error);
    res.json({ success: false, message: 'Error rejecting return request' });
  }
};

export const markOrderAsReturned = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log('=== MARK AS RETURNED REQUEST ===');
    console.log('Order ID:', orderId);

    const order = await Order.findById(orderId)
      .populate('products.variantId');

    if (!order) {
      console.log('Order not found');
      return res.json({ success: false, message: 'Order not found' });
    }

    console.log('Current order status:', order.status);

    if (order.status !== 'ReturnApproved' && order.status !== 'Return Approved') {
      console.log('Order is not in ReturnApproved state');
      return res.json({
        success: false,
        message: 'Order is not in ReturnApproved state. Current status: ' + order.status
      });
    }

    const oldStatus = order.status;
    order.status = 'Returned';

    console.log('Processing items...');
    for (const item of order.products) {
      console.log('Item status:', item.itemStatus, 'Variant ID:', item.variantId);
      
      if (item.itemStatus === 'ReturnApproved' || item.itemStatus === 'Return Approved') {
        
        if (item.variantId && item.variantId._id) {
          const variantId = item.variantId._id;
          console.log('Updating stock for variant:', variantId, 'Quantity:', item.quantity);
          
          const result = await Variant.findByIdAndUpdate(
            variantId,
            { $inc: { stock: item.quantity } },
            { new: true }
          );
          
          console.log('Stock update result:', result ? 'Success' : 'Failed');
        } else {
          console.log('Warning: No variant ID found for item');
        }

        item.itemStatus = 'Returned';
        item.itemTimeline ||= {};
        item.itemTimeline.returnedAt = new Date();
      }
    }

    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'Returned',
      reason: 'Product received by admin',
      changedBy: 'Admin',
      previousStatus: oldStatus,
      date: new Date()
    });

    await order.save();
    console.log('Order saved successfully');

    res.json({
      success: true,
      message: 'Order marked as returned and stock updated'
    });

  } catch (error) {
    console.error("Mark returned error:", error);
    console.error("Error stack:", error.stack);
    res.json({ 
      success: false, 
      message: 'Error marking order as returned: ' + error.message 
    });
  }
};