import Coupon from '../../models/couponSchema.js';
import User from '../../models/userSchema.js';

export const getCouponsPage = async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .populate('specificUsers', 'name email _id')
      .sort({ createdAt: -1 });

    const users = await User.find({}).select('name email _id');

    res.render('admin/coupons', { 
      coupons: Array.isArray(coupons) ? coupons : [],
      users ,
      title:"Coupon",
      page:'Coupons'
    });
  } catch (err) {
    console.error('Error fetching coupons:', err);
    res.status(500).render('admin/coupons', { 
      coupons: [], 
      users: [] 
    });
  }
};
export const createCoupon=async(req,res)=>{
    try{
const {name,code,description,discountType,discountValue,minPurchase,maxDiscountLimit,perUserLimit,totalUsageLimit,startDate,expiryDate,status,specificUsers=[]}=req.body;
if (!code || !name || !discountType || !discountValue || !startDate || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

  
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 3) {
      return res.status(400).json({ success: false, message: 'Coupon code must be at least 3 characters long.' });
    }
    const discountVal = parseFloat(discountValue);
    if (isNaN(discountVal) || discountVal <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a positive number.' });
    }
    if (discountType === 'percentage' && discountVal > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    }
    let maxLimit = null;
    if (maxDiscountLimit !== undefined && maxDiscountLimit !== null && maxDiscountLimit !== '') {
      maxLimit = parseFloat(maxDiscountLimit);
      if (isNaN(maxLimit) || maxLimit < 0) {
        return res.status(400).json({ success: false, message: 'Max discount limit must be a positive number.' });
      }
      if (discountType === 'percentage' && maxLimit < discountVal) {
        return res.status(400).json({ success: false, message: 'Max discount cap cannot be less than the discount value.' });
      }
    }
    const start = new Date(startDate);
    const expiry = new Date(expiryDate);
    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format.' });
    }
    if (expiry <= start) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after the start date.' });
    }
    const perUser = parseInt(perUserLimit);
    if (isNaN(perUser) || perUser < 1) {
      return res.status(400).json({ success: false, message: 'Per user limit must be at least 1.' });
    }

    let totalLimit = null;
    if (totalUsageLimit !== undefined && totalUsageLimit !== null && totalUsageLimit !== '') {
      totalLimit = parseInt(totalUsageLimit);
      if (isNaN(totalLimit) || totalLimit < 1) {
        return res.status(400).json({ success: false, message: 'Total usage limit must be at least 1.' });
      }
    }
await Coupon.create({
      code: code.toUpperCase().trim(),
      name: name.trim(),
      description: description?.trim(),
      discountType,
      discountValue: parseFloat(discountValue),
      minPurchase: parseFloat(minPurchase) || 0,
      maxDiscountLimit: maxDiscountLimit ? parseFloat(maxDiscountLimit) : null,
      perUserLimit: parseInt(perUserLimit) || 1,
      totalUsageLimit: totalUsageLimit ? parseInt(totalUsageLimit) : null,
      startDate: new Date(startDate),
      expiryDate: new Date(expiryDate),
      status: status || 'Active',
      specificUsers
    });
    res.json({ success: true ,message:"coupon created"});
    }catch(error){
res.status(400).json({success:false,message:"error loading coupon"});
    }
}
export const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id; 
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscountLimit,
      perUserLimit,
      totalUsageLimit,
      startDate,
      expiryDate,
      status,
      specificUsers = []
    } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode !== coupon.code) {
      const existing = await Coupon.findOne({ code: cleanCode });
      if (existing) {
        return res.json({ success: false, message: "This coupon code already exists" });
      }
    }

    coupon.code = cleanCode;
    coupon.name = name.trim();
    coupon.description = description?.trim() || '';
    coupon.discountType = discountType;
    coupon.discountValue = Number(discountValue);
    coupon.minPurchase = Number(minPurchase) || 0;
    coupon.maxDiscountLimit = maxDiscountLimit ? Number(maxDiscountLimit) : null;
    coupon.perUserLimit = Number(perUserLimit) || 1;
    coupon.totalUsageLimit = totalUsageLimit ? Number(totalUsageLimit) : null;
    coupon.startDate = new Date(startDate);
    coupon.expiryDate = new Date(expiryDate);
    coupon.status = status || "Active";
    coupon.specificUsers = specificUsers;

    await coupon.save();

    return res.json({ success: true, message: "Coupon updated successfully!" });

  } catch (error) {
    console.error("Update coupon error:", error);
    return res.json({ success: false, message: "Failed to update coupon" });
  }
};
export const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.json({ success: false, message: "Coupon not found" });
    }

    await Coupon.findByIdAndDelete(couponId);

    return res.json({ success: true, message: "Coupon deleted successfully!" });

  } catch (error) {
    console.error("Delete coupon error:", error);
    return res.json({ success: false, message: "Failed to delete coupon" });
  }
};
