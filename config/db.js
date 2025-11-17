import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
const connectDB=async()=>{
    try{
          console.log("Attempting MongoDB connection to:", process.env.MONGODB_URI);
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("DB connected");
    }catch(error){
console.log("DB connection error",error.message);
process.exit(1);
    }
}
export default connectDB;