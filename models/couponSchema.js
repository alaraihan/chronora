import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: [0, 'Discount value must be positive'],
    },
    minPurchase: {
      type: Number,
      default: 0,
      min: [0, 'Minimum purchase cannot be negative'],
    },
    maxDiscountLimit: {
      type: Number,
      default: null,
      min: [0, 'Max discount limit cannot be negative'],
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, 'Per user limit must be at least 1'],
    },
    totalUsageLimit: {
      type: Number,
      default: null,
      min: [1, 'Total usage limit must be at least 1 if set'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    usedBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 1 },
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    specificUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

couponSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = this.code.toUpperCase().trim();
  }

  if (this.discountType === 'percentage' && this.discountValue > 100) {
    this.invalidate('discountValue', 'Percentage discount cannot exceed 100%');
  }

  if (
    this.discountType === 'percentage' &&
    this.maxDiscountLimit !== null &&
    this.maxDiscountLimit < this.discountValue
  ) {
    this.invalidate(
      'maxDiscountLimit',
      'Max discount limit must be >= discount value for percentage coupons'
    );
  }

  if (this.startDate && this.expiryDate && this.expiryDate <= this.startDate) {
    this.invalidate('expiryDate', 'Expiry date must be after start date');
  }

  if (this.totalUsageLimit !== null && this.usedCount > this.totalUsageLimit) {
    this.usedCount = this.totalUsageLimit;
  }

  next();
});

couponSchema.pre('save', function (next) {
  const now = new Date();
  const isExpired = this.expiryDate < now;
  const notStarted = this.startDate > now;
  const usageExceeded =
    this.totalUsageLimit !== null && this.usedCount >= this.totalUsageLimit;

  this.status = isExpired || notStarted || usageExceeded ? 'Inactive' : 'Active';
  next();
});

couponSchema.index({ code: 1 });
couponSchema.index({ startDate: 1, expiryDate: 1, status: 1 });

const Coupon = model('Coupon', couponSchema);

export default Coupon;