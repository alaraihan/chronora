import User from "../../models/userSchema.js";
import { sendOtp, generateOtp } from "../../utils/mail.js";
import bcrypt from "bcrypt";
import { setFlash ,getFlash} from "../../utils/flash.js";  

const render = (req, res, view, options = {}) => {
  const flash = getFlash(req); 
  return res.render(view, { flash, ...options });
};

const loadSignUp = (req, res) => {
  return render(req, res, "user/signup", {
    title: "Chronora - Signup",
    layout: "layouts/userLayouts/auth",
  });
};

const signUp = async (req, res) => {
  try {
    const { fullName, email, password, confirm } = req.body;

    if (!fullName || !email || !password || !confirm) {
      setFlash(req, "error", "All fields are required");
      return res.redirect("/signup");
    }

    if (password !== confirm) {
      setFlash(req, "error", "Passwords do not match");
      return res.redirect("/signup");
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      setFlash(req, "error", "User already exists with this email");
      return res.redirect("/signup");
    }

    const otp = generateOtp(6);
    console.log("Signup OTP (dev):", otp);

    const emailSent = await sendOtp(email, otp);
    if (!emailSent) {
      setFlash(req, "error", "Failed to send verification email.");
      return res.redirect("/signup");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    req.session.pendingUser = {
      fullName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      otp,
      otpExpires: Date.now() +  1000*30,
    };

    setFlash(req, "success", "OTP sent to your email!");
    return res.redirect("/verifyOtp");
  } catch (error) {
    console.error("signup error", error);
    setFlash(req, "error", "Server error");
    return res.redirect("/signup");
  }
};

export const loadVerifyOtp = (req, res) => {
  const pending = req.session.pendingUser;

  if (!pending) {
    setFlash(req, "error", "No signup in progress");
    return res.redirect("/signup");
  }

  const now = Date.now();
  const expiresAt = pending.otpExpires || 0;
  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  return render(req, res, "user/verifyOtp", {
    title: "Chronora - Verify OTP",
    layout: "layouts/userLayouts/auth",
    timeLeft: remainingSeconds, 
    flash: getFlash(req),
  });
};

export const verifyOtp = async (req, res) => {
  try {
    const providedOtp = Array.isArray(req.body.otp)
      ? req.body.otp.join("")
      : (req.body.otp || "").trim();

    console.log("[verifyOtp] received otp:", providedOtp);
    const pending = req.session.pendingUser;
    if (!pending) {
      console.log("verifyOtp no pendingUser in session");
      setFlash(req, "error", "No signup in progress");
      return res.redirect("/signup");
    }

    const remainingSeconds = Math.max(0, Math.ceil((pending.otpExpires - Date.now()) / 1000));

    if (Date.now() > pending.otpExpires) {
      delete req.session.pendingUser;
      setFlash(req, "error", "OTP expired. Please sign up again.");
      return res.redirect("/signup");
    }

    if (!providedOtp || !/^\d{6}$/.test(providedOtp)) {
      setFlash(req, "error", "Enter a 6-digit OTP");
      return render(req, res, "user/verifyOtp", {
        title: "Chronora - Verify OTP",
        layout: "layouts/userLayouts/auth",
        timeLeft: remainingSeconds,
        flash: getFlash(req),
      });
    }

    if (providedOtp !== String(pending.otp)) {
      setFlash(req, "error", "Incorrect OTP. Please try again.");

      return render(req, res, "user/verifyOtp", {
        title: "Chronora - Verify OTP",
        layout: "layouts/userLayouts/auth",
        timeLeft: remainingSeconds,
        flash: getFlash(req),
      });
    }

    console.log("verifyOtp OTP correct. Creating user for:", pending.email);
    const newUser = await User.create({
      fullName: pending.fullName,
      email: pending.email,
      password: pending.password,
      isVerified: true,
    });

delete req.session.pendingUser;
setFlash(req, "success", "Account created successfully! Please log in.");

console.log("verifyOtp about to save session and redirect to /login; sessionID:", req.sessionID, "session:", req.session);

return req.session.save(err => {
  if (err) console.error("verifyOtp session.save error:", err);
  console.log("verifyOtp session saved -> redirecting to /login");
  return res.redirect("/login");
});

  } catch (err) {
    console.error("verify otp error", err);
    setFlash(req, "error", "Server error. Please try again.");

    const pending = req.session.pendingUser || {};
    const remainingSeconds = pending.otpExpires ? Math.max(0, Math.ceil((pending.otpExpires - Date.now()) / 1000)) : 0;

    return render(req, res, "user/verifyOtp", {
      title: "Chronora - Verify OTP",
      layout: "layouts/userLayouts/auth",
      timeLeft: remainingSeconds,
      flash: getFlash(req),
    });
  }
};

const loadLogin = (req, res) => {

  return render(req, res, "user/login", {
    title: "Chronora - Login",
    layout: "layouts/userLayouts/auth",
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      setFlash(req, "error", "Please provide both email and password");
      return res.redirect("/login");
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      setFlash(req, "error", "Account not found");
      return res.redirect("/login");
    }

    if (!user.isVerified) {
      setFlash(req, "error", "Please verify your email first");
      return res.redirect("/login");
    }
    if(user.isBlocked){
          setFlash(req, "error", "user is Blocked");
    return res.redirect("/login");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      setFlash(req, "error", "Invalid email or password");
      return res.redirect("/login");
    }

    req.session.userId = user._id.toString();
    req.session.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
    };

    setFlash(req, "success", "Logged in successfully!");
    return res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    setFlash(req, "error", "Something went wrong");
    return res.redirect("/login");
  }
};

const loadForgotPassword = (req, res) => {
  delete req.session.resetOtpData;
  delete req.session.resetUserId;
  return render(req, res, "user/forgetPassword", {
    title: "Chronora - Forgot Password",
    layout: "layouts/userLayouts/auth",
  });
};

const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    setFlash(req, "error", "Please enter your email");
    return res.redirect("/forgetPassword");
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      setFlash(req, "error", "No account found with this email");
      return res.redirect("/forgetPassword");
    }

    const otp = generateOtp(6);
    console.log("Reset OTP (dev):", otp);

    req.session.resetOtpData = {
      userId: user._id,
      email: user.email,
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000,
    };

    const sent = await sendOtp(user.email, otp);
    if (!sent) {
      setFlash(req, "error", "Failed to send OTP");
      return res.redirect("/forgetPassword");
    }

    setFlash(req, "success", "OTP sent to your email");
    return res.redirect("/resetOtp");
  } catch (error) {
    console.error("sendResetOtp error:", error);
    setFlash(req, "error", "Server error");
    return res.redirect("/forgetPassword");
  }
};

const loadResetOtp = (req, res) => {
  if (!req.session.resetOtpData) {
    setFlash(req, "error", "No OTP session found");
    return res.redirect("/forgetPassword");
  }
  return render(req, res, "user/resetOtp", {
    title: "Chronora - Verify Reset OTP",
    layout: "layouts/userLayouts/auth",
    email: req.session.resetOtpData.email,
  });
};

const verifyResetOtp = async (req, res) => {
  const providedOtp = Array.isArray(req.body.otp) ? req.body.otp.join("") : req.body.otp?.trim() || "";
  const data = req.session.resetOtpData;

  if (!data) {
    setFlash(req, "error", "Session expired");
    return res.redirect("/forgetPassword");
  }

  if (Date.now() > data.otpExpires) {
    delete req.session.resetOtpData;
    setFlash(req, "error", "OTP expired");
    return res.redirect("/forgetPassword");
  }

  if (providedOtp !== data.otp) {
    setFlash(req, "error", "Incorrect OTP");
    return res.redirect("/resetOtp");
  }

  req.session.resetUserId = data.userId;
  delete req.session.resetOtpData;

  setFlash(req, "success", "OTP verified! Set your new password");
  return res.redirect("/resetPassword");
};

const loadResetPassword = (req, res) => {
  if (!req.session.resetUserId) {
    setFlash(req, "error", "Invalid session");
    return res.redirect("/forgetPassword");
  }
  return render(req, res, "user/resetPassword", {
    title: "Chronora - Reset Password",
    layout: "layouts/userLayouts/auth",
  });
};

const resetPassword = async (req, res) => {
  const { password, confirm } = req.body;
  const userId = req.session.resetUserId;

  if (!userId || !password || password !== confirm) {
    setFlash(req, "error", "Passwords do not match");
    return res.redirect("/resetPassword");
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      delete req.session.resetUserId;
      setFlash(req, "error", "User not found");
      return res.redirect("/forgetPassword");
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    delete req.session.resetUserId;

    setFlash(req, "success", "Password reset successfully! Please log in.");
    return res.redirect("/login");
  } catch (err) {
    console.error(err);
    setFlash(req, "error", "Failed to reset password");
    return res.redirect("/resetPassword");
  }
};
const resendOtp = async (req, res) => {
  try {
    const pending = req.session.pendingUser;
    if (!pending) return res.json({ success: false, message: "No signup in progress" });

    const newOtp = generateOtp(6);
    console.log("Resend OTP:", newOtp);
    pending.otp = newOtp;
    pending.otpExpires = Date.now() + 3 * 60 * 1000; 
    req.session.pendingUser = pending;

    const sent = await sendOtp(pending.email, newOtp);
    const timeLeftSeconds = Math.max(0, Math.ceil((pending.otpExpires - Date.now()) / 1000));
    return res.json({ success: !!sent, timeLeft: timeLeftSeconds });
  } catch (err) {
    console.error("resendOtp error", err);
    return res.json({ success: false });
  }
};

const resendResetOtp = async (req, res) => {
  try {
    if (!req.session.resetOtpData) return res.json({ success: false });
    const { email } = req.session.resetOtpData;
    const newOtp = generateOtp(6);
    console.log("Resend reset OTP:", newOtp);

    req.session.resetOtpData.otp = newOtp;
    req.session.resetOtpData.otpExpires = Date.now() + 10 * 60 * 1000; 
    const sent = await sendOtp(email, newOtp);
    const timeLeftSeconds = Math.max(0, Math.ceil((req.session.resetOtpData.otpExpires - Date.now()) / 1000));
    return res.json({ success: !!sent, timeLeft: timeLeftSeconds });
  } catch (err) {
    console.error("resendResetOtp error", err);
    return res.json({ success: false });
  }
};


const googleCallback = (req, res) => {
  if (!req.user) {
    setFlash(req, "error", "Google login failed");
    return res.redirect("/login");
  }

  req.session.userId = req.user._id.toString();
  req.session.user = {
    id: req.user._id.toString(),
    fullName: req.user.fullName || "User",
    email: req.user.email,
  };

  setFlash(req, "success", "Logged in with Google!");
  return res.redirect("/");
};

const loadLogout=async(req,res)=>{
  try{
    return res.render("user/logout", { title: "Chronora-Logout",layout: 'layouts/userLayouts/auth'} )
    
  }catch(error){
    console.log("logout page is not found");
    res.status(500).render("user/pageNotfound",{ title: "Error - Chronora",
      message: "Something went wrong. Please try again later.",
})
  }
}
const performLogout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).render("user/pageNotfound", {
          title: "Error - Chronora",
          message: "Unable to logout. Try again.",
          layout: 'layouts/userLayouts/auth'
        });
      }
      res.clearCookie("connect.sid");
      return res.redirect("/login");
    });
  } catch (error) {
    console.error("performLogout error:", error);
    return res.status(500).send("Server error");
  }
};


export default {
  loadSignUp,
  signUp,
  loadVerifyOtp,
  verifyOtp,
  loadLogin,
  login,
  loadForgotPassword,
  sendResetOtp,
  loadResetOtp,
  verifyResetOtp,
  loadResetPassword,
  resetPassword,
  resendOtp,
  resendResetOtp,
  googleCallback,
  performLogout,
  loadLogout,
};