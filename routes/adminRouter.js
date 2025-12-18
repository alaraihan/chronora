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
  renderAdminOrdersPage,   // ✅ NEW
  getAdminOrdersData,      // ✅ NEW
  getOrderDetails,
  printOrder,
  updateItemStatus,
  approveItemReturn,
  rejectItemReturn,
  markItemAsReturned,
getAdminOrdersPage,
  updateOrderStatus
} from "../controller/admin/orderController.js";

import {
 loadOfferPage,
  getOffersData,
  getOfferTargets,
  createOffer,
  updateOffer,
  deleteOffer,
} from '../controller/admin/offerController.js'
import upload from "../middlewares/uploadImage.js";


// ==================== AUTH ====================
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);

router.get("/dashboard", isAdmin, adminController.dashboard);


// ==================== CUSTOMERS ====================
router.get("/customers", isAdmin, adminController.loadCustomers);
router.patch("/customers/toggle-block/:id", isAdmin, adminController.toggleBlockCustomer);


// ==================== CATEGORIES ====================
router.get("/categories", isAdmin, listCategories);
router.post("/categories", isAdmin, upload.single("logo"), addCategory);
router.put("/categories/:id", isAdmin, upload.single("logo"), editCategory);
router.get("/categories/:id", isAdmin, getCategory);
router.patch("/categories/toggle/:id", isAdmin, toggleListCategory);


// ==================== PRODUCTS ====================
router.get("/products", isAdmin, listProducts);
router.get("/products/get/:id", isAdmin, getProduct);
router.post("/products/add", isAdmin, upload.array("images"), addProduct);
router.put("/products/edit/:id", isAdmin, upload.array("images"), updateProduct);
router.put("/products/block/:id", isAdmin, toggleBlock);


// ==================== ORDERS ====================

// 1️⃣ Orders page (HTML only)
router.get("/orders", isAdmin, renderAdminOrdersPage);

// 2️⃣ Orders data (JSON only – used by Axios)
router.get("/orders/data", isAdmin, getAdminOrdersData);

// 3️⃣ Single item detail page
router.get("/orders/:orderId/item/:itemIndex", isAdmin, getOrderDetails);

// 4️⃣ Print full order invoice
router.get("/orders/print/:orderId", isAdmin, printOrder);


// ==================== ORDER ACTION APIs ====================
// Orders page (EJS)
router.get("/orders", isAdmin, getAdminOrdersPage);

// Orders data (JSON for Axios)
router.get("/orders/data", isAdmin, getAdminOrdersData);

// Update overall order status
router.post("/orders/update-status/:orderId", isAdmin, updateOrderStatus);

// Update single item status
router.post("/orders/:orderId/update-item", isAdmin, updateItemStatus);

// Approve return for one item
router.post("/orders/:orderId/approve-return", isAdmin, approveItemReturn);

// Reject return for one item
router.post("/orders/:orderId/reject-return", isAdmin, rejectItemReturn);

// Mark item as returned (restores stock)
router.post("/orders/:orderId/mark-returned-item", isAdmin, markItemAsReturned);

router.get("/offer",isAdmin, loadOfferPage);                    // Page render
router.get("/offers/data", isAdmin,getOffersData);              // Table data
router.get("/offers/targets", isAdmin,getOfferTargets);         // Dropdown data

router.post("/offers",isAdmin, createOffer);                    // Create
router.put("/offers/:id",isAdmin, updateOffer);                 // Update
router.delete("/offers/:id",isAdmin, deleteOffer);export default router;
