import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["product", "category"], required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 1 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Offer", offerSchema);