import express from "express";
const router = express.Router();

import adminController from "../controller/admin/adminController.js";
import { isAdmin } from "../middlewares/authMiddleware.js";

import {
  listCategories,
  addCategory,
  editCategory,
  getCategory,
  toggleListCategory
} from "../controller/admin/categoryController.js";

import {
  listProducts,
  addProduct,
  updateProduct,
  getProduct,
  toggleBlock
} from "../controller/admin/productController.js";

import {
  getAdminOrders,
  getOrderDetails,
  printOrder,
  updateOrderStatus,
  updateItemStatus,
  approveCancelRequest,
  rejectCancelRequest,
  approveReturnRequest,
  rejectReturnRequest,
  markOrderAsReturned
} from "../controller/admin/orderController.js";

import upload from "../middlewares/uploadImage.js";

router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);

router.get("/dashboard", isAdmin, adminController.dashboard);

router.get("/customers", isAdmin, adminController.loadCustomers);
router.patch("/customers/toggle-block/:id", isAdmin, adminController.toggleBlockCustomer);

router.get("/categories", isAdmin, listCategories);
router.post("/categories", isAdmin, upload.single("logo"), addCategory);
router.put("/categories/:id", isAdmin, upload.single("logo"), editCategory);
router.get("/categories/:id", isAdmin, getCategory);
router.patch("/categories/toggle/:id", isAdmin, toggleListCategory);

router.get("/products", isAdmin, listProducts);
router.get("/products/get/:id", isAdmin, getProduct);
router.post("/products/add", isAdmin, upload.array("images"), addProduct);
router.put("/products/edit/:id", isAdmin, upload.array("images"), updateProduct);
router.put("/products/block/:id", isAdmin, toggleBlock);

router.get("/orders", isAdmin, getAdminOrders); 
router.get("/orders/print/:orderId", isAdmin, printOrder); 
router.get("/orders/:orderId", isAdmin, getOrderDetails); 

router.post("/orders/:orderId/status", isAdmin, updateOrderStatus);
router.post("/orders/:orderId/items/:itemId/status", isAdmin, updateItemStatus);

router.post("/orders/:orderId/approve-cancel", isAdmin, approveCancelRequest);
router.post("/orders/:orderId/reject-cancel", isAdmin, rejectCancelRequest);

router.post("/orders/:orderId/approve-return", isAdmin, approveReturnRequest);
router.post("/orders/:orderId/reject-return", isAdmin, rejectReturnRequest);
router.post('/orders/:orderId/mark-returned', markOrderAsReturned);
export default router;