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
  renderAdminOrdersPage,
  getAdminOrdersData,
  getOrderDetails,
  printOrder,
  updateItemStatus,
  approveItemReturn,
  rejectItemReturn,
  markItemAsReturned
} from "../controller/admin/orderController.js";

import {
  loadOfferPage,
  getOffersData,
  getOfferTargets,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferActive

} from "../controller/admin/offerController.js";
import upload from "../middlewares/uploadImage.js";

import {
  getCouponsPage,createCoupon,updateCoupon,deleteCoupon
} from "../controller/admin/couponController.js";

import { processRefund } from "../controller/admin/refundController.js";
import {
  getSalesReportPage,
  getSalesReportData,
  downloadSalesReport
} from "../controller/admin/salesReport.js";

import { getDashboardPage, getDashboardData } from "../controller/admin/adminController.js";

router.get("/dashboard", getDashboardPage);
router.get("/dashboard/data", getDashboardData);
router.post("/orders/:orderId/refund-item", isAdmin, processRefund);

router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);


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


router.get("/orders", isAdmin, renderAdminOrdersPage);


router.get("/orders/:orderId/:itemIndex/detail", isAdmin, getOrderDetails);

router.get("/orders/print/:orderId", isAdmin, printOrder);


router.get("/orders/data", isAdmin, getAdminOrdersData);


router.post("/orders/:orderId/update-item", isAdmin, updateItemStatus);

router.post("/orders/:orderId/approve-return", isAdmin, approveItemReturn);

router.post("/orders/:orderId/reject-return", isAdmin, rejectItemReturn);

router.post("/orders/:orderId/mark-returned-item", isAdmin, markItemAsReturned);

router.get("/offer",isAdmin, loadOfferPage);
router.get("/offers/data", isAdmin,getOffersData);
router.get("/offers/targets", isAdmin,getOfferTargets);

router.post("/offers",isAdmin, createOffer);
router.put("/offers/:id",isAdmin, updateOffer);
router.delete("/offers/:id",isAdmin, deleteOffer);
router.patch("/offers/:id/toggle", toggleOfferActive);

router.get("/coupons",isAdmin,getCouponsPage);
router.post("/coupons/create",isAdmin,createCoupon);
router.put("/coupons/update/:id", isAdmin, updateCoupon);
router.delete("/coupons/delete/:id", isAdmin, deleteCoupon);

router.get("/sales-report", isAdmin, getSalesReportPage);
router.get("/sales-report/data", isAdmin, getSalesReportData);
router.get("/sales-report/download", isAdmin, downloadSalesReport);
export default router;