// models/adminSchema.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const adminSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

// safe pre-save hash (avoid double-hashing)
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const pw = this.password || "";
  if (/^\$2[aby]\$/.test(pw) && pw.length >= 59) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

// Force collection name to 'admin' (singular)
const Admin = mongoose.model("Admin", adminSchema, "admin");
export default Admin;
