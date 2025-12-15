import mongoose from "mongoose";
import crypto from "crypto";

const orderedItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Variant",
    required: true,
  },

  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  price: {
    type: Number,
    required: true,
  },

  itemStatus: {
    type: String,
    enum: [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "ReturnRequested",
      "ReturnRejected",
      "ReturnApproved",
      "Returned",
    ],
    default: "Pending",
  },

  itemTimeline: {
    confirmedAt: Date,
    processedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    returnRequestedAt: Date,
    returnRejectedAt: Date,
    returnApprovedAt: Date,
    returnedAt: Date,
  },

  reason: {
    type: String,
    default: "",
  },
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  address1: { type: String, required: true },
  address2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: "India" },
  addressType: String,
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    products: [orderedItemSchema],

    orderDate: { type: Date, default: Date.now },
    deliveryDate: Date,

    status: {
  type: String,
  enum: [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Out for Delivery",
    "Delivered",

    "CancelRequested",
    "ReturnRequested",
    "ReturnRejected",
    "ReturnApproved",

    "Cancelled",
    "Returned",

    "Partially Delivered",
    "Partially Cancelled",
    "Partially Returned",
  ],
  default: "Pending",
},

    cancelReason: {
      type: String,
      default: "",
    },

    returnReason: {
      type: String,
      default: "",
    },

    review: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      title: {
        type: String,
        default: "",
      },
      text: {
        type: String,
        default: "",
      },
      reviewedAt: Date,
    },

    statusHistory: {
      type: [
        {
          status: String,
          reason: String,
          date: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    address: shippingAddressSchema,

    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod", "wallet"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    paymentId: String,

    totalAmount: {
      type: Number,
      required: true,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    expectedDelivery: Date,
  },
  { timestamps: true }
);


orderSchema.pre("save", function (next) {
  if (!this.orderId) {
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    this.orderId = `ORD-${date}-${random}`;
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
