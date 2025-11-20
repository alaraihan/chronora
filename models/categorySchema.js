// models/categorySchema.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
    // REMOVED unique: true → THIS WAS KILLING YOU
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ""
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true 
});

// Hide soft-deleted categories
categorySchema.pre(/^find/, function(next) {
  this.where({ isDeleted: false });
  next();
});

export default mongoose.model("Category", categorySchema);