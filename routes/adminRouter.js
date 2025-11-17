import express from "express";
import adminController from '../controller/admin/adminController.js';
const router = express.Router();
import {isAdmin} from "../middlewares/authMiddleware.js"

router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",isAdmin,adminController.dashboard)
export default router;
