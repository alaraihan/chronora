import mongoose from "mongoose";

const { Schema, model } = mongoose;

const addressSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true
    },

    street: {
      type: String,
      required: [true, "Street address is required"],
      trim: true
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true
    },

    state: {
      type: String,
      required: [true, "State is required"],
      trim: true
    },

    zip: {
      type: String,
      required: [true, "ZIP code is required"],
      trim: true
    },

    country: {
      type: String,
      required: [true, "Country is required"],
      default: "India",
      uppercase: true,
      trim: true
    },

    isDefaultShipping: {
      type: Boolean,
      default: false
    },

    isDefaultBilling: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const Address = model("Address", addressSchema);

export default Address;