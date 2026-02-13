
import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant", 
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    originalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { timestamps: true }
);

cartSchema.index({ userId: 1, productId: 1, variantId: 1 }, { unique: true });

export default mongoose.model("Cart", cartSchema);