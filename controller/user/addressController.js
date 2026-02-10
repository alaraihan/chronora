import Address from "../../models/addressSchema.js";
import logger from "../../helpers/logger.js"; 

export const loadAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.session.userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.render("user/profile-edit-address", { active: "profile", addresses });
    logger.info(`Loaded addresses for user: ${req.session.userId}`);
  } catch (error) {
    logger.error(`loadAddresses error for user ${req.session.userId}:`, error);
    res.status(404).send("Server error");
  }
};

export const addAddress = async (req, res) => {
  try {
    const {
      name,
      phone,
      street,
      city,
      state,
      zip,
      country,
      isDefaultShipping,
      isDefaultBilling,
    } = req.body;

    logger.debug(`Received address data: ${JSON.stringify(req.body)}`);

    if (!name || !phone || !street || !city || !state || !zip || !country) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const userId = req.user?._id || req.session?.userId;
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
      isDefaultBilling: !!isDefaultBilling,
    });

    const saved = await newAddress.save();
    logger.info(`Address added for user ${userId}: ${saved._id}`);

    res.json({ success: true, message: "Address added!", newAddress: saved });
  } catch (err) {
    logger.error("addAddress error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const loadEditAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.session.userId });
    if (!address) {
      logger.warn(`Address not found for edit: ${req.params.id}, user: ${req.session.userId}`);
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    logger.info(`Loaded address for edit: ${address._id}, user: ${req.session.userId}`);
    res.json({ success: true, address });
  } catch (error) {
    logger.error(`loadEditAddress error for user ${req.session.userId}:`, error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { name, phone, street, city, state, zip, country, isDefaultShipping, isDefaultBilling } =
      req.body;
    const updates = { name, phone, street, city, state, zip, country, isDefaultShipping, isDefaultBilling };

    if (isDefaultShipping) {
      await Address.updateMany(
        { user: req.session.userId, _id: { $ne: req.params.id } },
        { isDefaultShipping: false }
      );
    }
    if (isDefaultBilling) {
      await Address.updateMany(
        { user: req.session.userId, _id: { $ne: req.params.id } },
        { isDefaultBilling: false }
      );
    }

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      updates,
      { new: true }
    );

    if (!address) {
      logger.warn(`Address not found for update: ${req.params.id}, user: ${req.session.userId}`);
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    logger.info(`Address updated: ${address._id}, user: ${req.session.userId}`);
    res.json({ success: true, message: "Address updated!", address });
  } catch (err) {
    logger.error(`updateAddress error for user ${req.session.userId}:`, err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const deleted = await Address.findOneAndDelete({ _id: req.params.id, user: req.session.userId });
    if (!deleted) {
      logger.warn(`Address not found for delete: ${req.params.id}, user: ${req.session.userId}`);
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    logger.info(`Address deleted: ${deleted._id}, user: ${req.session.userId}`);
    res.json({ success: true, message: "Address deleted!" });
  } catch (err) {
    logger.error(`deleteAddress error for user ${req.session.userId}:`, err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
