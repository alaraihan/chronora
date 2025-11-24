import mongoose from "mongoose";
import bcrypt from "bcrypt";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: false,
    },
    googleId: {
      type: String,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, 
  }
);

userSchema.pre("save",async function(next){
    if(!this.isModified(this.password))
        return next();

    if(!this.password)
        return next();

    if(this.password.startsWith("$2")){
        return next();
    }
    this.password=await bcrypt.hash(this.password,10);
    next();
})

userSchema.methods.compareAndMigratePassword = async function (userPassword) {
  const stored = this.password;
  if (!stored) return false;
  if (typeof stored === "string" && stored.startsWith("$2")) {
    try {
      return await bcrypt.compare(userPassword, stored);
    } catch {
      return false;
    }
  }
  if (userPassword === stored) {
    try {
      this.password = await bcrypt.hash(userPassword, 10);
      await this.save();
      return true;
    } catch {

      return false;
    }
  }

  return false;
};

const User = mongoose.model("User", userSchema);
export default User;
