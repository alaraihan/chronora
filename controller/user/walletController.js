
import User from "../../models/userSchema.js";
import logger from "../../helpers/logger.js";
export const loadWallet = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      logger.warn("Unauthorized wallet page access attempt");
      return res.redirect("/login");
    }

    const user = await User.findById(userId).select("fullName email referralCode wallet walletTransactions");

    if (!user) {
      logger.warn(`User not found during wallet load: ${userId}`);
      return res.redirect("/login");
    }
logger.info(`User wallet page loaded`, { id: user._id, email: user.email, referralCode: user.referralCode });
    logger.info("Full user object:", {
      id: user._id,
      email: user.email,
      referralCode: user.referralCode
    });

    return res.render("user/wallet", {
      title: "My Wallet - Chronora",
      user: {
        fullName: user.fullName,
        email: user.email,
        referralCode: user.referralCode || "NO_CODE",
        wallet: user.wallet || 0
      },
      active: "wallet"
    });
  } catch (error) {
logger.error("loadWallet error", error);
    return res.status(500).render("user/pageNotfound", {
      title: "Error - Chronora",
      message: "Unable to load wallet"
    });
  }
};

export const getWalletData = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      logger.warn("getWalletData called without authentication");
      return res.json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(userId).select("wallet walletTransactions");

    if (!user) {
      logger.warn(`User not found during getWalletData: ${userId}`);
      return res.json({ success: false, message: "User not found" });
    }

    const sortedTransactions = (user.walletTransactions || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      success: true,
      balance: user.wallet || 0,
      transactions: sortedTransactions
    });
  } catch (error) {
logger.error("getWalletData error", error);
    return res.json({ success: false, message: "Server error" });
  }
};

export const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      logger.warn("createWalletOrder called without authentication");
      return res.json({ success: false, message: "Not authenticated" });
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 10) {
      logger.warn(`Invalid wallet top-up amount: ${amount}`);
      return res.json({ success: false, message: "Minimum amount is ₹10" });
    }


    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const orderOptions = {
      amount: Math.round(parsedAmount * 100),
      currency: "INR",
      receipt: `wallet_${userId.toString().slice(-10)}_${Date.now() % 10000}`
    };

    const order = await razorpay.orders.create(orderOptions);
logger.info(`Razorpay order created`, { userId, orderId: order.id, amount: order.amount });
    return res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
logger.error("createWalletOrder error", error);
    return res.json({ success: false, message: "Failed to create order" });
  }
};

export const verifyAndAddMoney = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      logger.warn("verifyAndAddMoney called without authentication");
      return res.json({ success: false, message: "Not authenticated" });
    }

    const crypto = await import("crypto");

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      logger.warn(`Payment verification failed for user ${userId}`);
      return res.json({ success: false, message: "Payment verification failed" });
    }

    const parsedAmount = parseFloat(amount);
    const user = await User.findById(userId);

    if (!user) {
      logger.warn(`User not found during verifyAndAddMoney: ${userId}`);
      return res.json({ success: false, message: "User not found" });
    }

    user.wallet = (user.wallet || 0) + parsedAmount;
    user.walletTransactions.push({
      amount: parsedAmount,
      type: "credit",
      description: "Added via Razorpay",
      date: new Date()
    });

    await user.save();

logger.info(`Added ₹${parsedAmount} to user's wallet`, { userId, email: user.email });
    return res.json({
      success: true,
      message: `₹${parsedAmount} added successfully!`,
      newBalance: user.wallet
    });
  } catch (error) {
logger.error("verifyAndAddMoney error", error);
    return res.json({ success: false, message: "Failed to add money" });
  }
};