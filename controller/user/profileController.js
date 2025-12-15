import emailOtps from "../../utils/emailOtpStore.js";  

import cloudinary from "../../config/cloudinary.js";
import User from "../../models/userSchema.js";
import { sendOtp, generateOtp } from "../../utils/mail.js";
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
export const loadProfile=async(req,res)=>{
    try{
    if(!req.session.userId){
        return res.redirect("/login");
    }

    const user =await User.findById(req.session.userId);
    return res.render("user/profile",{
        title:'Chronora-Profile',
        user,
        active:"proile"
    });
}catch(error){
    console.log("error loading profile", error);
    return res.status(500).render("user/pageNotfound");
}
};

export const loadProfileImageEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) return res.redirect("/login");

    res.render("user/profile-edit-image", {
      user,
      active: "profile-edit-image"
    });
  } catch (err) {
    console.error(err);
    res.redirect("/profile");
  }
};
export const profileImageEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // ✅ Upload new image
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chronora/Profile_images",
      transformation: [
        { width: 500, height: 500, crop: "limit" }
      ],
    });

    // ✅ Delete old image from Cloudinary
    if (user.profileImageId) {
      await cloudinary.uploader.destroy(user.profileImageId);
    }

    // ✅ Save new image details
    user.profileImage = result.secure_url;
    user.profileImageId = result.public_id;
    await user.save();

    // ✅ Delete local temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.log("Temp file delete failed:", err.message);
    }

    res.json({
      success: true,
      message: "Profile image updated successfully",
      image: user.profileImage,
    });

  } catch (error) {
    console.error("Error updating profile image:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const loadProfileNameEdit = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render("user/profile-edit-name", {
      active: "profile-edit-name",
      user,
    });
  } catch (error) {
    console.error("Error loading name edit page:", error);
    res.status(500).render("user/pageNotfound");
  }
};

export const profileNameEdit = async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!fullName) {
      return res.status(400).json({ success: false, message: "Full name is required." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.fullName = fullName;
    await user.save();

    return res.status(200).json({ success: true, message: "Name updated successfully!", fullName: user.fullName });
  } catch (error) {
    console.error("Error updating name:", error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
};



export const loadProfileEmailEdit = async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect("/login");

    const user = await User.findById(req.session.userId);
    return res.render("user/profile-edit-email", {
      active: "profile-email-edit",
      user,
    });
  } catch (error) {
    console.error("Error loading email edit page:", error);
    return res.status(500).render("user/pageNotfound");
  }
};

export const sendEmailOtp = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ success: false, message: "This is already your current email." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing && existing._id.toString() !== req.session.userId) {
      return res.status(400).json({ success: false, message: "This email is already taken!" });
    }

    const otp = generateOtp(6);
    let sent = false;
    try {
      sent = await sendOtp(email, otp); 
    } catch (sendErr) {
      console.error("sendOtp failed:", sendErr);
      sent = false;
    }

    if (!sent) {
      return res.status(500).json({ success: false, message: "Failed to send OTP. Try again later." });
    }

    const expiresAt = Date.now() + 5 * 60 * 1000; 

    emailOtps.set(email.toLowerCase(), {
      otp,
      expiresAt,
      userId: req.session.userId,
    });

    req.session.pendingEmailChange = { email: email.toLowerCase(), otpExpires: expiresAt };

    return res.json({ success: true, message: "OTP sent successfully!", expiresAt });
  } catch (error) {
    console.error("sendEmailOtp error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPendingEmailChange = (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: "No session" });

    const pending = req.session.pendingEmailChange;
    if (!pending) return res.json({ success: false, message: "No pending email change" });

    const now = Date.now();
    const remainingMs = Math.max(0, pending.otpExpires - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    return res.json({ success: true, pendingEmail: pending.email, remainingSeconds });
  } catch (err) {
    console.error("getPendingEmailChange error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: "Email & OTP required." });

    const key = email.toLowerCase();
    const record = emailOtps.get(key);
    if (!record) return res.status(400).json({ success: false, message: "No OTP found. Request a new one." });

    if (record.userId !== req.session.userId) {
      return res.status(403).json({ success: false, message: "OTP does not match this user session." });
    }

    if (Date.now() > record.expiresAt) {
      emailOtps.delete(key);
      if (req.session.pendingEmailChange && req.session.pendingEmailChange.email === key) {
        delete req.session.pendingEmailChange;
      }
      return res.status(400).json({ success: false, message: "OTP expired. Request again." });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    const other = await User.findOne({ email: key });
    if (other && other._id.toString() !== req.session.userId) {
      emailOtps.delete(key);
      return res.status(400).json({ success: false, message: "Email already taken by another account." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    user.email = key;
    await user.save();

    emailOtps.delete(key);
    if (req.session.pendingEmailChange && req.session.pendingEmailChange.email === key) {
      delete req.session.pendingEmailChange;
    }
    req.session.userEmail = key;

    return res.json({ success: true, message: "Email updated successfully!" });
  } catch (err) {
    console.error("verifyEmailOtp error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getChangePassword = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');

    res.render("user/change-password", {
      user,
      active:'profeil-change password'
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("user/pageNotfound");
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password too short' });
    }

    const user = await User.findById(req.session.userId).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ success: false, message: 'New password must be different' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};