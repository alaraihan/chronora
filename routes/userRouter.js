import express from "express";

const router = express.Router();
import upload from "../middlewares/uploadImage.js"; 

import { checkLogin, isLoggedIn } from "../middlewares/authMiddleware.js";
import userController from "../controller/user/userController.js";
import authController from "../controller/user/authController.js";
import passport from "../config/passport.js";

import {
  loadProfile, profileImageEdit,
  loadProfileImageEdit, loadProfileNameEdit, profileNameEdit,
  loadProfileEmailEdit, sendEmailOtp, verifyEmailOtp,
  getPendingEmailChange, changePassword, getChangePassword
} from "../controller/user/profileController.js";

import {
  loadAddresses,
  addAddress,
  loadEditAddress,
  updateAddress,
  deleteAddress
} from "../controller/user/addressController.js";

import {
  loadCart,
  addToCart,
  updateQuantity,
  removeFromCart
} from "../controller/user/cartController.js";

import { 
  loadCheckout, 
  addAddressCheck, 
  placeOrder,
  successPage
} from "../controller/user/checkoutController.js";

import {
  getOrdersPage,
  getOrderDetails,
  cancelOrder,
  returnOrder,
  downloadInvoice,
  submitOrderReview
} from "../controller/user/orderController.js"; 


router.get("/pageNotfound", userController.pageNotfound);
router.get("/about", userController.loadAboutpage);
router.get("/contact", userController.loadContactpage);
router.get("/", userController.loadHomepage);

router.get("/product/:id", userController.productDetails);
router.get("/watch", userController.loadWatchPage);

router.get("/login",checkLogin, authController.loadLogin);
router.post("/login", authController.login);

router.get("/signup",checkLogin, authController.loadSignUp);
router.post("/signup", authController.signUp);

router.get("/verifyOtp",checkLogin, authController.loadVerifyOtp);
router.post("/verifyOtp", authController.verifyOtp);
router.post("/resendOtp", authController.resendOtp);

router.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?error=Google login failed",
    failureMessage: true
  }),
  authController.googleCallback
);

router.get("/forgetPassword",checkLogin, authController.loadForgotPassword);
router.post("/forgetPassword", authController.sendResetOtp);

router.get("/resetOtp",checkLogin, authController.loadResetOtp);
router.post("/resetOtp", authController.verifyResetOtp);

router.get("/resetPassword",checkLogin, authController.loadResetPassword);
router.post("/resetPassword", authController.resetPassword);

router.post("/resendResetOtp",checkLogin, authController.resendResetOtp);

router.get("/logout", authController.loadLogout);
router.post("/logout", authController.performLogout);

router.get("/profile", loadProfile);
router.get("/profile/edit/image", loadProfileImageEdit);
router.post("/profile/edit/image", upload.single("profileImage"), profileImageEdit);

router.get("/profile/edit/name", loadProfileNameEdit);
router.post("/profile/edit/name", profileNameEdit);

router.get("/profile/edit/email", loadProfileEmailEdit);
router.post("/profile/send-email-otp", sendEmailOtp);
router.post("/profile/verify-email-otp", verifyEmailOtp);

router.get("/profile/pending-email", getPendingEmailChange);

router.get('/profile/addresses', loadAddresses);
router.post('/profile/addresses/add', addAddress);
router.get('/profile/addresses/:id/edit', loadEditAddress);
router.put('/profile/addresses/:id', updateAddress);
router.delete('/profile/addresses/:id', deleteAddress);

router.get('/profile/change-password', isLoggedIn, getChangePassword);
router.post('/profile/change-password', isLoggedIn, changePassword);


router.get("/cart", isLoggedIn, loadCart);
router.post("/cart/add", isLoggedIn, addToCart);
router.post('/cart/update/:id', isLoggedIn, updateQuantity);
router.post('/cart/remove/:id', isLoggedIn, removeFromCart);


router.get("/checkout", isLoggedIn, loadCheckout);
router.post('/address/add', isLoggedIn, addAddressCheck);
router.post('/checkout/place-order', isLoggedIn, placeOrder);
router.get("/checkout/success", successPage);


router.get("/profile/orders", isLoggedIn, getOrdersPage);

router.get("/profile/orders/:orderId", isLoggedIn, getOrderDetails);
router.post("/profile/orders/:orderId/cancel", isLoggedIn, cancelOrder);
router.post("/profile/orders/:orderId/return", isLoggedIn, returnOrder);
router.get("/profile/orders/:orderId/invoice", isLoggedIn, downloadInvoice);
router.post( "/profile/orders/:orderId/review", isLoggedIn, submitOrderReview);



export default router;
