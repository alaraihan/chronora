import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    colorName: {
        type: String,
        required: true,
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    images: [{
        type: String,
        required: true
    }],
    isBlocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});



export default mongoose.model('Variant', variantSchema);