import mongoose from "mongoose";
import bcrypt from "bcrypt";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: false
    },
    profileImage: {
      type: String,
      default: ""
    },
    googleId: {
      type: String,
      sparse: true
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },

    referralCode: {
      type: String,
      unique: true,
      required: false,
      uppercase: true,
      trim: true
    },
    referredBy: {
      type: String,
      default: null,
      trim: true
    },
    wallet: {
      type: Number,
      default: 0,
      min: 0
    },

    walletTransactions: [
      {
        amount: {
          type: Number,
          required: true
        },
        type: {
          type: String,
          enum: ["credit", "debit"],
          required: true
        },
        description: {
          type: String,
          required: true,
          trim: true
        },
        date: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) {
    return next();
  }

  if (this.password.startsWith("$2b$") || this.password.startsWith("$2a$")) {
    return next();
  }

  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {return false;}

  if (!this.password.startsWith("$2")) {
    if (candidatePassword === this.password) {
      this.password = await bcrypt.hash(candidatePassword, 10);
      await this.save();
      return true;
    }
    return false;
  }

  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;