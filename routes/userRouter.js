import express from "express";

const router = express.Router();



import userController from"../controller/user/userController.js";
import authController from"../controller/user/authController.js";
import passport from"../config/passport.js";


router.get("/pageNotfound", userController.pageNotfound);
router.get("/about", userController.loadAboutpage);
router.get("/contact", userController.loadContactpage);
router.get("/",userController.loadHomepage);

router.get("/product/:id", userController.productDetails);  
router.get("/watch", userController.loadWatchPage);

router.get("/login",authController.loadLogin);
router.post("/login", authController.login);
router.get("/signup", authController.loadSignUp);
router.post("/signup", authController.signUp);
router.get("/verifyOtp", authController.loadVerifyOtp);
router.post("/verifyOtp", authController.verifyOtp);
router.post("/resendOtp", authController.resendOtp);


router.get("/auth/google", 
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/auth/google/callback",
  passport.authenticate("google", { 
    failureRedirect: "/login?error=Google login failed",
    failureMessage: true 
  }),  authController.googleCallback   
);
router.get("/forgetPassword", authController.loadForgotPassword);
router.post("/forgetPassword", authController.sendResetOtp);

router.get("/resetOtp", authController.loadResetOtp);
router.post("/resetOtp", authController.verifyResetOtp);

router.get("/resetPassword",authController.loadResetPassword);
router.post("/resetPassword", authController.resetPassword);
router.post("/resendResetOtp",authController.resendResetOtp);

router.get("/logout",authController.loadLogout);
router.post("/logout", authController.performLogout);
export default router;