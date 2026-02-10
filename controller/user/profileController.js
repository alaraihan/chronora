import emailOtps from "../../utils/emailOtpStore.js";

import cloudinary from "../../config/cloudinary.js";
import User from "../../models/userSchema.js";
import { sendOtp, generateOtp } from "../../utils/mail.js";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import logger  from "../../helpers/logger.js";
export const loadProfile=async (req,res)=>{
  try {
    if (!req.session.userId) {
      logger.warn("Unauthorized profile load attempt");
      return res.redirect("/login");
    }

    const user =await User.findById(req.session.userId);
    return res.render("user/profile",{
      title:"Chronora-Profile",
      user,
      active:"profile"
    });
  } catch (error) {
    logger.error("error loading profile", error);
    return res.status(500).render("user/pageNotfound");
  }
};

export const loadProfileImageEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
logger.warn("Unauthorized profile image edit load attempt");
    if (!user) {return res.redirect("/login");}

    res.render("user/profile-edit-image", {
      user,
      active: "profile-edit-image"
    });
  } catch (err) {
logger.error("Error loading profile image edit page", err);
    res.redirect("/profile");
  }
};
export const profileImageEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      logger.warn("Unauthorized profile image update attempt");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
      logger.warn("No file uploaded for profile image update");
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chronora/Profile_images",
      transformation: [
        { width: 500, height: 500, crop: "limit" }
      ]
    });

    if (user.profileImageId) {
      await cloudinary.uploader.destroy(user.profileImageId);
      logger.info(`Deleted old profile image ${user.profileImageId} from Cloudinary`);
    }

    user.profileImage = result.secure_url;
    user.profileImageId = result.public_id;
    await user.save();


    try {
      fs.unlinkSync(req.file.path);
      logger.info("Temporary file deleted successfully");
    } catch (err) {
logger.warn("Temp file delete failed", err);
    }
logger.info(`Profile image updated for user ${user._id}`);
    res.json({
      success: true,
      message: "Profile image updated successfully",
      image: user.profileImage
    });

  } catch (error) {
logger.error("Error updating profile image", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const loadProfileNameEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render("user/profile-edit-name", {
      active: "profile-edit-name",
      user
    });
  } catch (error) {
logger.error("Error loading name edit page", error);
    res.status(500).render("user/pageNotfound");
  }
};

export const profileNameEdit = async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!fullName) {
      logger.warn("Full name not provided for update");
      return res.status(400).json({ success: false, message: "Full name is required." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      logger.warn(`User not found for name update: ${req.session.userId}`);
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.fullName = fullName;
    await user.save();
logger.info(`Name updated for user ${user._id} to ${fullName}`);
    return res.status(200).json({ success: true, message: "Name updated successfully!", fullName: user.fullName });
  } catch (error) {
logger.error("Error updating name", error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
};


export const loadProfileEmailEdit = async (req, res) => {
  try {
    if (!req.session.userId) {
      logger.warn("Unauthorized email edit load attempt");
      return res.redirect("/login");}

    const user = await User.findById(req.session.userId);
    return res.render("user/profile-edit-email", {
      active: "profile-email-edit",
      user
    });
  } catch (error) {
logger.error("Error loading email edit page", error);
    return res.status(500).render("user/pageNotfound");
  }
};

export const sendEmailOtp = async (req, res) => {
  try {
    if (!req.session.userId) {
      logger.warn("OTP send attempt without session");
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    const { email } = req.body;
    if (!email) {
      logger.warn("OTP send attempt without email");
      return res.status(400).json({ success: false, message: "Email is required." });}

    if (!/\S+@\S+\.\S+/.test(email)) {
      logger.warn(`Invalid email format: ${email}`);
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      logger.warn(`User not found for OTP send: ${req.session.userId}`);
      return res.status(404).json({ success: false, message: "User not found." });}

    if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
      logger.warn(`User ${user._id} tried to change to current email`);
      return res.status(400).json({ success: false, message: "This is already your current email." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing && existing._id.toString() !== req.session.userId) {
      logger.warn(`Email already taken: ${email}`);
      return res.status(400).json({ success: false, message: "This email is already taken!" });
    }

    const otp = generateOtp(6);
    let sent = false;
    try {
      sent = await sendOtp(email, otp);
    } catch (sendErr) {
logger.error(`sendOtp failed for ${email}`, sendErr);
      sent = false;
    }

    if (!sent) {
      return res.status(500).json({ success: false, message: "Failed to send OTP. Try again later." });
    }

    const expiresAt = Date.now() + 5 * 60 * 1000;

    emailOtps.set(email.toLowerCase(), {
      otp,
      expiresAt,
      userId: req.session.userId
    });

    req.session.pendingEmailChange = { email: email.toLowerCase(), otpExpires: expiresAt };
logger.info(`OTP sent for user ${user._id} to email ${email}`);
    return res.json({ success: true, message: "OTP sent successfully!", expiresAt });
  } catch (error) {
logger.error("sendEmailOtp error", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPendingEmailChange = (req, res) => {
  try {
    if (!req.session.userId) {
      logger.warn("Pending email check without session");
      return res.status(401).json({ success: false, message: "No session" });}

    const pending = req.session.pendingEmailChange;
    if (!pending) {return res.json({ success: false, message: "No pending email change" });}

    const now = Date.now();
    const remainingMs = Math.max(0, pending.otpExpires - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    return res.json({ success: true, pendingEmail: pending.email, remainingSeconds });
  } catch (err) {
logger.error("getPendingEmailChange error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    if (!req.session.userId) {
      logger.warn("OTP verify attempt without session");
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    const { email, otp } = req.body;
    if (!email || !otp) {
      logger.warn("OTP verification missing email or otp");
      return res.status(400).json({ success: false, message: "Email & OTP required." });}

    const key = email.toLowerCase();
    const record = emailOtps.get(key);
    if (!record) {return res.status(400).json({ success: false, message: "No OTP found. Request a new one." });}

    if (record.userId !== req.session.userId) {
      logger.warn(`OTP does not match session for user ${req.session.userId}`);
      return res.status(403).json({ success: false, message: "OTP does not match this user session." });
    }

    if (Date.now() > record.expiresAt) {
      emailOtps.delete(key);
      if (req.session.pendingEmailChange && req.session.pendingEmailChange.email === key) {
        delete req.session.pendingEmailChange;
      }
      logger.info(`OTP expired for email ${key}`);
      return res.status(400).json({ success: false, message: "OTP expired. Request again." });
    }

    if (record.otp !== otp) {
      logger.warn(`Invalid OTP entered for email ${key}`);
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    const other = await User.findOne({ email: key });
    if (other && other._id.toString() !== req.session.userId) {
      emailOtps.delete(key);
      logger.warn(`Email ${key} already taken by another account`);
      return res.status(400).json({ success: false, message: "Email already taken by another account." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      logger.warn(`User not found during OTP verify: ${req.session.userId}`);
      return res.status(404).json({ success: false, message: "User not found." });}

    user.email = key;
    await user.save();

    emailOtps.delete(key);
    if (req.session.pendingEmailChange && req.session.pendingEmailChange.email === key) {
      delete req.session.pendingEmailChange;
    }
    req.session.userEmail = key;
logger.info(`Email updated for user ${user._id} to ${key}`);
    return res.json({ success: true, message: "Email updated successfully!" });
  } catch (err) {
logger.error("verifyEmailOtp error", err);    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getChangePassword = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      logger.warn("Unauthorized change password page load attempt");
      return res.redirect("/login");}

    res.render("user/change-password", {
      user,
      active:"profeil-change password"
    });
  } catch (error) {
logger.error("Error loading change password page", error);
    res.status(500).render("user/pageNotfound");
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      logger.warn("Password change attempt with missing fields");
      return res.status(400).json({ success: false, message: "All fields required" });
    }
    if (newPassword.length < 8) {
      logger.warn("New password too short");
      return res.status(400).json({ success: false, message: "Password too short" });
    }

    const user = await User.findById(req.session.userId).select("+password");
    if (!user) {
      logger.warn(`User not found during password change: ${req.session.userId}`);
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      logger.warn(`Incorrect current password for user ${user._id}`);
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      logger.warn(`New password same as old for user ${user._id}`);
      return res.status(400).json({ success: false, message: "New password must be different" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
logger.info(`Password changed successfully for user ${user._id}`);
    return res.json({ success: true, message: "Password changed successfully!" });
  } catch (error) {
logger.error("Error changing password", error);    return res.status(500).json({ success: false, message: "Server error" });
  }
};