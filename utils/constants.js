export const ORDER_STATUS = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERING: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCEL_REQUESTED: "CancelRequested",
    RETURN_REQUESTED: "ReturnRequested",
    RETURN_REJECTED: "ReturnRejected",
    RETURN_APPROVED: "ReturnApproved",
    CANCELLED: "Cancelled",
    RETURNED: "Returned",
    PARTIALLY_DELIVERED: "Partially Delivered",
    PARTIALLY_CANCELLED: "Partially Cancelled",
    PARTIALLY_RETURNED: "Partially Returned",
};

export const ITEM_STATUS = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERING: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    RETURN_REQUESTED: "ReturnRequested",
    RETURN_REJECTED: "ReturnRejected",
    RETURN_APPROVED: "ReturnApproved",
    RETURNED: "Returned",
};

export const PAYMENT_STATUS = {
    PENDING: "Pending",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partially Refunded",
};

export const PAYMENT_METHOD = {
    RAZORPAY: "razorpay",
    COD: "cod",
    WALLET: "wallet",
};

export const OFFER_TYPE = {
    PRODUCT: "product",
    CATEGORY: "category",
};

export const DISCOUNT_TYPE = {
    PERCENTAGE: "percentage",
    FIXED: "fixed",
};

export const MESSAGES = {
    COUPON_CREATED: "Coupon created successfully!",
    COUPON_UPDATED: "Coupon updated successfully!",
    COUPON_DELETED: "Coupon deleted successfully.",
    COUPON_EXISTS: "Coupon code already exists.",
    COUPON_INVALID: "Invalid coupon code.",
    COUPON_EXPIRED: "This coupon is expired or not active yet.",
    COUPON_LIMIT_REACHED: "Coupon usage limit reached.",
    COUPON_MIN_PURCHASE: (min) => `Minimum purchase of ₹${min} required.`,

    OFFER_CREATED: "Offer created successfully",
    OFFER_UPDATED: "Offer updated successfully",
    OFFER_DELETED: "Offer deleted successfully",
    OFFER_EXISTS: "Offer already exists!",
    OFFER_INVALID_DISCOUNT: "Invalid discount value",

    ORDER_PLACED: "Order placed successfully!",
    ORDER_FAILED: "Failed to place order. Please try again.",
    PAYMENT_FAILED: "Payment failed. Please try again.",
    PAYMENT_VERIFIED: "Payment verified successfully",
    INSUFFICIENT_WALLET: "Insufficient wallet balance.",
    STOCK_OUT: "Some items in your cart are out of stock.",

    SERVER_ERROR: "Internal Server Error. Please try again later.",
    UNAUTHORIZED: "Unauthorized access.",
    NOT_FOUND: "Resource not found.",
};
