import express from "express";
const router = express.Router();

import upload from "../middlewares/uploadImage.js"; 

import { checkLogin, isLoggedIn } from "../middlewares/authMiddleware.js";
import * as userController from "../controller/user/userController.js";
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
  cancelOrderItem,
  returnOrderItem,
  downloadInvoice,
  reviewOrderItem
} from "../controller/user/orderController.js"; 

router.get("/pageNotfound", userController.pageNotfound);
router.get("/about", userController.loadAboutpage);
router.get("/contact", userController.loadContactpage);
router.get("/", userController.loadHomepage);

router.get("/product/:id", userController.productDetails);
router.get("/watch", userController.loadWatchPage);

router.get("/login", checkLogin, authController.loadLogin);
router.post("/login", authController.login);

router.get("/signup", checkLogin, authController.loadSignUp);
router.post("/signup", authController.signUp);

router.get("/verifyOtp", checkLogin, authController.loadVerifyOtp);
router.post("/verifyOtp", authController.verifyOtp);
router.post("/resendOtp", authController.resendOtp);

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?error=Google login failed"
  }),
  authController.googleCallback
);

router.get("/forgetPassword", checkLogin, authController.loadForgotPassword);
router.post("/forgetPassword", authController.sendResetOtp);

router.get("/resetOtp", checkLogin, authController.loadResetOtp);
router.post("/resetOtp", authController.verifyResetOtp);

router.get("/resetPassword", checkLogin, authController.loadResetPassword);
router.post("/resetPassword", authController.resetPassword);

router.post("/resendResetOtp", checkLogin, authController.resendResetOtp);

router.get("/logout", authController.loadLogout);
router.post("/logout", authController.performLogout);


router.get("/profile", isLoggedIn, loadProfile);
router.get("/profile/edit/image", isLoggedIn, loadProfileImageEdit);
router.post("/profile/edit/image", isLoggedIn, upload.single("profileImage"), profileImageEdit);

router.get("/profile/edit/name", isLoggedIn, loadProfileNameEdit);
router.post("/profile/edit/name", isLoggedIn, profileNameEdit);

router.get("/profile/edit/email", isLoggedIn, loadProfileEmailEdit);
router.post("/profile/send-email-otp", isLoggedIn, sendEmailOtp);
router.post("/profile/verify-email-otp", isLoggedIn, verifyEmailOtp);

router.get("/profile/pending-email", isLoggedIn, getPendingEmailChange);

router.get('/profile/addresses', isLoggedIn, loadAddresses);
router.post('/profile/addresses/add', isLoggedIn, addAddress);
router.get('/profile/addresses/:id/edit', isLoggedIn, loadEditAddress);
router.put('/profile/addresses/:id', isLoggedIn, updateAddress);
router.delete('/profile/addresses/:id', isLoggedIn, deleteAddress);

router.get('/profile/change-password', isLoggedIn, getChangePassword);
router.post('/profile/change-password', isLoggedIn, changePassword);


router.get("/cart", isLoggedIn, loadCart);
router.post("/cart/add", isLoggedIn, addToCart);
router.post('/cart/update/:id', isLoggedIn, updateQuantity);
router.post('/cart/remove/:id', isLoggedIn, removeFromCart);


router.get("/checkout", isLoggedIn, loadCheckout);
router.post('/address/add', isLoggedIn, addAddressCheck);
router.post('/checkout/place-order', isLoggedIn, placeOrder);
router.get("/checkout/success", isLoggedIn, successPage);


router.get("/profile/orders", isLoggedIn, getOrdersPage);

router.get("/profile/orders/:orderId", isLoggedIn, getOrderDetails);

router.get("/profile/orders/:orderId/invoice", isLoggedIn, downloadInvoice);


router.post("/order/:orderId/cancel-item", isLoggedIn, cancelOrderItem);
router.post("/order/:orderId/return-item", isLoggedIn, returnOrderItem);
router.post("/order/:orderId/review-item", isLoggedIn, reviewOrderItem);


router.get("/profile/orders/:orderId/invoice", isLoggedIn, downloadInvoice);
router.post("/profile/orders/:orderId/review-item", isLoggedIn, reviewOrderItem);



export default router;