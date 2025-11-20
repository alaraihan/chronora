import express from "express";
import adminController from '../controller/admin/adminController.js';
const router = express.Router();
import {isAdmin} from "../middlewares/authMiddleware.js"
import {
  listCategories,
  editCategory,
  deleteCategory,
  addCategory
} from "../controller/admin/categoryController.js";import upload from "../middlewares/uploadImage.js";
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/logout",adminController.loadlogout);
router.post("/logout",adminController.logout)
router.get("/dashboard",isAdmin,adminController.dashboard);
router.get("/customers", isAdmin, adminController.loadCustomers);
router.patch("/customers/toggle-block/:id", isAdmin, adminController.toggleBlockCustomer);
router.get("/categories", isAdmin, listCategories);
router.post("/categories", isAdmin, upload.single("image"), addCategory);
router.patch("/categories/:id", isAdmin, upload.single("image"), editCategory);
router.delete("/categories/:id", isAdmin, deleteCategory);
export default router;
