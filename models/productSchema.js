import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  variants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Variant"
  }],
  isBlocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});
productSchema.virtual("image").get(function () {
  for (const variant of this.variants || []) {
    if (variant?.images?.length > 0) {
      return variant.images[0];
    }
  }
  return "/images/no-image.png";
});

productSchema.virtual("totalStock").get(function () {
  return (this.variants || []).reduce((sum, v) => sum + (v?.stock || 0), 0);
});


export default mongoose.model("Product", productSchema);