import Address from "../../models/addressSchema.js";
export const loadAddresses=async (req,res)=>{
  try {
    const address = await Address.find({ user: req.session.userId }).sort({ isDefault: -1, createdAt: -1 });

    res.render("user/profile-edit-address",{active:"profile",addresses:address});
  } catch (error) {
    console.log(error);
    res.status(404).send("server error");
  }
};

export const addAddress=async (req,res)=>{
  try {
    const { name, phone, street, city, state, zip, country, isDefaultShipping, isDefaultBilling } = req.body;

    console.log("Received data:", req.body);
    if (!name || !phone || !street || !city || !state || !zip||!country) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }
    const userId = (req.user && req.user._id) ? req.user._id : req.session && req.session.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }


    if (isDefaultShipping) {
      await Address.updateMany({ user: userId }, { $set: { isDefaultShipping: false } });
    }
    if (isDefaultBilling) {
      await Address.updateMany({ user: userId }, { $set: { isDefaultBilling: false } });
    }

    const newAddress = new Address({
      user: userId,
      name,
      phone,
      street,
      city,
      state,
      zip,
      country: country || "India",
      isDefaultShipping: !!isDefaultShipping,
      isDefaultBilling: !!isDefaultBilling
    });
    const saved = await newAddress.save();

    res.json({ success: true, message: "Address added!", newAddress });
  } catch (err) {
    console.error("Add address error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const loadEditAddress=async (req,res)=>{
  try {
    const address=await Address.findOne({_id:req.params.id,user:req.session.userId});
    if (!address) {return res.status(404).json({success:false,message:"Address not found"});}
    res.json({ success: true, address });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const updateAddress=async (req,res)=>{
  try {
    const { name, phone, street, city, state, zip, country, isDefaultShipping, isDefaultBilling } = req.body;
    const updates = { name, phone, street, city, state, zip, country, isDefaultShipping, isDefaultBilling };

    if (isDefaultShipping) {
      await Address.updateMany({ user: req.session.userId, _id: { $ne: req.params.id } }, { isDefaultShipping: false });
    }
    if (isDefaultBilling) {
      await Address.updateMany({ user: req.session.userId, _id: { $ne: req.params.id } }, { isDefaultBilling: false });
    }

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      updates,
      { new: true }
    );

    if (!address) {return res.status(404).json({ success: false, message: "Address not found" });}
    res.json({ success: true, message: "Address updated!", address });
  } catch (err) {
    console.error("Update address error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteAddress=async (req,res)=>{
  try {
    const deleted = await Address.findOneAndDelete({ _id: req.params.id, user: req.session.userId });
    if (!deleted) {return res.status(404).json({ success: false, message: "Address not found" });}
    res.json({ success: true, message: "Address deleted!" });
  } catch (err) {
    console.error("Delete address error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};