import mongoose from "mongoose";
const { Schema } = mongoose;
import bcrypt from "bcrypt";


const userSchema=new Schema({
    fullName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:false
    },
    googleId:{
     type:String,
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isVerified:{
        type:Boolean,
        default:true
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    updatedAt:{
        type:Date,
  default:Date.now
    },
})
userSchema.pre("save",async function(next) {
    if(this.isModified("password")&&this.password){
        this.password=await bcrypt.hash(this.password,10);
    }
    next();
})
const User=mongoose.model("User",userSchema);

export default User;