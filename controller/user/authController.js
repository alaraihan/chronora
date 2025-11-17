import User from "../../models/userSchema.js";
import { sendOtp, generateOtp } from "../../utils/mail.js";
import bcrypt from "bcrypt";
;

const googleCallback=(req,res)=>{
  console.log("Google login succesful,User: ",req.user);
  req.session.userId=req.user._id;
  req.session.user={
    id:req.user._id,
    fullName:req.user.fullName,
    email:req.user.email,
  }
  res.redirect("/home");
}
const loadLogout=async(req,res)=>{
  try{
    return res.render("user/logout", { layout: "layouts/userLayouts/auth", title: "Chronora-Logout"} )
    
  }catch(error){
    console.log("logout page is not found");
    res.status(500).render("user/pageNotfound",{ title: "Error - Chronora",
      message: "Something went wrong. Please try again later.",
})
  }
}
const performLogout=async(req,res)=>{
  try{
  req.session.destroy((err)=>{
    if(err){
        console.error("Session destroy error:", err);
        return res.status(500).render("user/pageNotfound", {title: "Error - Chronora",message: "Unable to logout. Try again.",});
    }
  });
  res.clearCookie("connect.sid");
  return res.redirect("/login");
  }catch(error){
console.error("performLogout error:", error);
    return res.status(500).send("Server error");
  }
}
const loadLogin = async (req, res) => {
  try {
    const success = req.query.verified ? "Account verified — please sign in" : null;
    return res.render("user/login", {layout: "layouts/userLayouts/auth",title: "Chronora-Login",message: null,success,
    });
  } catch (error) {
    console.log("login page not found");
    res.status(500).send("server error");
  }
};

const loadSignUp = async (req, res) => {
  try {
    return res.render("user/signup", { layout: "layouts/userLayouts/auth", title: "Chronora-Signup", message: null });
  } catch (error) {
    console.log("signUp page not found");
    res.status(500).send("server error");
  }
};


const loadForgotPassword = (req, res) => {
  delete req.session.resetOtpData;
  delete req.session.resetUserId;
  res.render("user/forgetPassword", {
    title: "Chronora – Forgot Password",
    layout: "layouts/userLayouts/auth",
    message: null,
  });
};

const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.render("user/forgetPassword", {
      title: "Chronora – Forgot Password",
      layout: "layouts/userLayouts/auth",
      message: "Please enter your email.",
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render("user/forgetPassword", {
        title: "Chronora – Forgot Password",
        layout: "layouts/userLayouts/auth",
        message: "No account found with this email.",
      });
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
      return res.render("user/forgetPassword", {
        title: "Chronora – Forgot Password",
        layout: "layouts/userLayouts/auth",
        message: "Failed to send OTP. Try again.",
      });
    }

    return res.render("user/resetOtp", {
      title: "Verify Reset OTP",
      layout: "layouts/userLayouts/auth",
      email: user.email,
      message: "OTP sent to your email.",
    });
  } catch (error) {
    console.error("sendResetOtp error:", error);
    return res.render("user/forgetPassword", {
      title: "Chronora – Forgot Password",
      layout: "layouts/userLayouts/auth",
      message: "Server error.",
    });
  }
};

const loadResetOtp = (req, res) => {
  if (!req.session.resetOtpData) {
    return res.redirect("/forgetPassword");
  }
  res.render("user/resetOtp", {
    title: "Verify Reset OTP",
    layout: "layouts/userLayouts/auth",
    email: req.session.resetOtpData.email,
    message: null,
  });
};

const verifyResetOtp = async (req, res) => {
  const providedOtp = Array.isArray(req.body.otp)
    ? req.body.otp.join("")
    : (req.body.otp || "").trim();

  const data = req.session.resetOtpData;
  if (!data) return res.redirect("/forgetPassword");

  if (Date.now() > data.otpExpires) {
    delete req.session.resetOtpData;
    return res.render("user/forgetPassword", {
      title: "Chronora – Forgot Password",
      layout: "layouts/userLayouts/auth",
      message: "OTP expired. Request a new one.",
    });
  }

  if (providedOtp !== data.otp) {
    return res.render("user/resetOtp", {
      title: "Verify Reset OTP",
      layout: "layouts/userLayouts/auth",
      email: data.email,
      message: "Incorrect OTP. Try again.",
    });
  }

  req.session.resetUserId = data.userId;
  delete req.session.resetOtpData;

  return res.render("user/resetPassword", {
    title: "Reset Password",
    layout: "layouts/userLayouts/auth",
    message: null,
  });
};
const resendResetOtp=async(req,res)=>{
  try{
    if(!req.session.resetOtpData){
      return res.json({success:false,message:"No otp session found"});

    }
    const{email}=req.session.resetOtpData;
    const newOtp=generateOtp(6);
    console.log("resend reset password: ",newOtp);
    req.session.resetOtpData.otp=newOtp;
    req.session.resetOtpData.otpExpires=Date.now() + 10 * 60 * 1000;

    const sent=await sendOtp(email,newOtp);
    if(sent){
      res.json({success:true})
    }else{
      res.json({success:false,message:'Failed to send otp to email'})
    }
  }catch(error){
    console.error("Resend OTP Error:", err);
    res.json({ success: false, message: "Server error" });
  }
}
const loadResetPassword=async(req,res)=>{
  if(!req.session.resetUserId){
    return res.redirect("/forgetPassword");
  }
  res.render("user/resetPassword",{title:"reset password",layout:"layouts/userLayouts/auth",message:null})
}
const resetPassword = async (req, res) => {
  const { password, confirm } = req.body;
  const userId = req.session.resetUserId;

  if (!userId) return res.redirect("/forgetPassword");
  if (!password || password !== confirm) {
    return res.render("user/resetPassword", {
      title: "Reset Password",
      layout: "layouts/userLayouts/auth",
      message: "Passwords do not match.",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      delete req.session.resetUserId;
      return res.redirect("/forgetPassword");
    }

    user.password = password; // bcrypt pre-save hook
    await user.save();

    delete req.session.resetUserId;

    return res.render("user/login", {
      layout: "layouts/userLayouts/auth",
      title: "Chronora – Login",
      message: null,
      success: "Password reset successful! Please log in.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.render("user/resetPassword", {
      title: "Reset Password",
      layout: "layouts/userLayouts/auth",
      message: "Failed to reset password.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render("user/login", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Login",
        message: "Please provide both email and password",
      });
    }

    const findUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!findUser) {
      return res.render("user/login", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Login",
        message: "Account not found",
      });
    }

    if (!findUser.isVerified) {
      return res.render("user/login", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Login",
        message: "Please verify your email first",
      });
    }

    const match = await bcrypt.compare(password, findUser.password);
    if (!match) {
      return res.render("user/login", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Login",
        message: "Invalid email or password.",
        success: null,
      });
    }

    req.session.userId = findUser._id;
    req.session.user = { id: findUser._id, fullName: findUser.fullName, email: findUser.email };
    return res.redirect("/home");
  } catch (error) {
    console.log("login error", error);
    return res.render("user/login", {
      layout: "layouts/userLayouts/auth",
      title: "Chronora-Login",
      message: "Something went wrong. Try again later.",
    });
  }
};

const signUp = async (req, res) => {
  try {
    const { fullName, email, password, confirm } = req.body;
    if (!fullName || !email || !password || !confirm) {
      return res.render("user/signup", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Signup",
        message: "All fields are required",
      });
    }

    if (password !== confirm) {
      return res.render("user/signup", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Signup",
        message: "Passwords do not match",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render("user/signup", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Signup",
        message: "User already exists with this email",
      });
    }

    const otp = generateOtp(6);
    console.log("Signup OTP (dev):", otp);

    const emailSent = await sendOtp(email, otp);
    if (!emailSent) {
      return res.render("user/signup", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora - Signup",
        message: "Failed to send verification email. Try again.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    req.session.pendingUser = {
      fullName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      otp,
      otpExpires: Date.now() + 3 * 60 * 1000,
    };

    return res.redirect("/verifyOtp");
  } catch (error) {
    console.error("signup error", error);
    return res.status(500).render("user/signup", {
      layout: "llayouts/userLayouts/auth",
      title: "Chronora - Signup",
      message: "Server error",
    });
  }
};

const loadVerifyOtp = async (req, res) => {
  try {
    if (!req.session?.pendingUser) return res.redirect("/signup");
    return res.render("user/verifyOtp", {
      layout: "layouts/userLayouts/auth",
      title: "Verify OTP",
      message: null,
    });
  } catch (err) {
    console.error("loadVerifyOtp error", err);
    return res.redirect("/signup");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const providedOtp = Array.isArray(req.body.otp) ? req.body.otp.join("") : (req.body.otp || "").trim();
    const pending = req.session.pendingUser;
    if (!pending) {
      return res.render("user/signup", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Signup",
        message: "No signup in progress. Please sign up again.",
      });
    }

    if (Date.now() > pending.otpExpires) {
      delete req.session.pendingUser;
      return res.render("user/signup", {
        layout: "layouts/userLayouts/auth",
        title: "Chronora-Signup",
        message: "OTP expired. Please sign up again.",
      });
    }

    if (providedOtp !== String(pending.otp)) {
      return res.render("user/verifyOtp", {
        layout: "layouts/userLayouts/auth",
        title: "Verify OTP",
        message: "Incorrect OTP. Try again.",
      });
    }

    const newUser = await User.create({
      fullName: pending.fullName,
      email: pending.email,
      password: pending.password,
      isVerified: true,
    });

    delete req.session.pendingUser;
    return res.redirect("/login?verified=1");
  } catch (err) {
    console.error("verify otp error", err);
    return res.status(500).render("user/verifyOtp", {
      layout: "layouts/userLayouts/auth",
      title: "Verify OTP",
      message: "Server error",
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const pending = req.session?.pendingUser;
    if (!pending) {
      return res.json({ success: false, message: "No signup in progress." });
    }

    const newOtp = generateOtp(6);
    console.log("Resend OTP (dev):", newOtp);

    pending.otp = newOtp;
    pending.otpExpires = Date.now() + 3 * 60 * 1000;
    req.session.pendingUser = pending;

    const emailSent = await sendOtp(pending.email, newOtp);
    return res.json({ success: !!emailSent });
  } catch (err) {
    console.error("resendOtp error:", err);
    return res.json({ success: false, message: "Server error" });
  }
};
export default {
  loadLogin,
  login,
  loadSignUp,
  signUp,
  loadVerifyOtp,
  verifyOtp,
  resendOtp,
  loadForgotPassword,
  sendResetOtp,
  loadResetOtp,
  verifyResetOtp,
  loadResetPassword,
  resetPassword,
  resendResetOtp,
  googleCallback,
  loadLogout,
  performLogout
};