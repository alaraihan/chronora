import express from "express";
import adminController from '../controller/admin/adminController.js';

const router = express.Router();
import {isAdmin} from "../middlewares/authMiddleware.js"
import {
  listCategories,
  editCategory,
  toggleDeleteCategory,
  addCategory,
} from "../controller/admin/categoryController.js";import upload from "../middlewares/uploadImage.js";
router.get("/login",adminController.loadLoginWithLogoutMessage);
router.post("/login",adminController.login);
router.get("/logout",adminController.logout);
router.get("/dashboard",isAdmin,adminController.dashboard);
router.get("/customers", isAdmin, adminController.loadCustomers);
router.patch("/customers/toggle-block/:id", isAdmin, adminController.toggleBlockCustomer);
router.get("/categories", isAdmin, listCategories);
router.post("/categories", isAdmin, upload.single("image"), addCategory);
router.patch("/categories/:id", isAdmin, upload.single("image"), editCategory);
router.patch("/categories/delete/:id", isAdmin, toggleDeleteCategory);

export default router;
