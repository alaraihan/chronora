
import User from "../../models/userSchema.js";

export const loadWallet = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId).select("fullName email referralCode wallet walletTransactions");

    if (!user) {
      return res.redirect("/login");
    }
    console.log("User referral code:", user.referralCode);
    console.log("Full user object:", {
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
    console.error("loadWallet error:", error);
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
      return res.json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(userId).select("wallet walletTransactions");

    if (!user) {
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
    console.error("getWalletData error:", error);
    return res.json({ success: false, message: "Server error" });
  }
};

export const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "Not authenticated" });
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 10) {
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

    return res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("createWalletOrder error:", error);
    return res.json({ success: false, message: "Failed to create order" });
  }
};

export const verifyAndAddMoney = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.json({ success: false, message: "Not authenticated" });
    }

    const crypto = await import("crypto");

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.json({ success: false, message: "Payment verification failed" });
    }

    const parsedAmount = parseFloat(amount);
    const user = await User.findById(userId);

    if (!user) {
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

    console.log(`✅ Added ₹${parsedAmount} to ${user.email}'s wallet`);

    return res.json({
      success: true,
      message: `₹${parsedAmount} added successfully!`,
      newBalance: user.wallet
    });
  } catch (error) {
    console.error("verifyAndAddMoney error:", error);
    return res.json({ success: false, message: "Failed to add money" });
  }
};