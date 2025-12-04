import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required.'],
        unique: true, 
    },
    description: {
        type: String,
        required: [true, 'Category description is required.'],
    },

    image: {
        type: String, 
        default: ""
    },
    isListed: {
        type: Boolean,
        default: true, 
    }
}, {
   
    timestamps: true 
});

export default mongoose.model("Category", categorySchema);