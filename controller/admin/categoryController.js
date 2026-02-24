import Category from "../../models/categorySchema.js";
import cloudinary from "../../config/cloudinary.js";
import Product from "../../models/productSchema.js";
import Variant from "../../models/variantSchema.js";
import Offer from '../../models/offerSchema.js'
import fs from "fs";
import { setFlash, getFlash } from "../../utils/flash.js";
import offerSchema from "../../models/offerSchema.js";
import logger from "../../helpers/logger.js";
import HttpStatus from "../../utils/httpStatus.js";
const render = (req, res, view, options = {}) => {
  const flash = getFlash(req);
  return res.render(view, { flash, ...options });
};
export const listCategories = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const status = req.query.status || "listed";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 4;
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const total = await Category.countDocuments(filter);
    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return render(req, res, "admin/categories", {
      title: "Categories - Chronora Admin",
      layout: "layouts/adminLayouts/main",
      page: "categories",
      categories,
      search,
      status,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCategories: total,
      pageJs: "categories",
      pageCss: "categories"
    });
  } catch (err) {
    logger.error("listCategories error", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to load categories" });
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const trimmedName = name?.trim();
    const trimmedDescription = description?.trim();

    if (!trimmedName || !trimmedDescription) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Please fill all required fields."
      });
    }

    if (!req.file) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Please upload a category image."
      });
    }

    const exists = await Category.findOne({
      name: { $regex: `^${trimmedName}$`, $options: "i" }
    });

    if (exists) {
      return res.status(HttpStatus.CONFLICT).json({
        success: false,
        message: "Category already exists!"
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chronora/categories",
      transformation: { width: 500, height: 500, crop: "limit" }
    });

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const category = await Category.create({
      name: trimmedName,
      description: trimmedDescription,
      image: {
        url: result.secure_url,
        public_id: result.public_id
      }
    });
    logger.info(`Category created: ${category.name}`);


    return res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Category created successfully",
      category
    });

  } catch (err) {
    logger.error("addCategory error", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error: Failed to add Category"
    });
  }
};
export const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isListed } = req.body;

    const trimmedName = name?.trim();
    const trimmedDescription = description?.trim();

    if (!trimmedName || !trimmedDescription) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Please fill all required fields."
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Category not found"
      });
    }



    const updateData = {
      name: trimmedName,
      description: trimmedDescription,
      isListed: isListed === "true"
    };

    const exists = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name}$`, $options: "i" }
    });


    if (exists) {
      return res.status(HttpStatus.CONFLICT).json({
        success: false,
        message: "Category already exists!"
      });
    }
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chronora/categories"
      });

      if (category.image?.public_id) {
        await cloudinary.uploader.destroy(category.image.public_id);
      }

      updateData.image = {
        url: result.secure_url,
        public_id: result.public_id
      };

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }

    const updated = await Category.findByIdAndUpdate(id, updateData, {
      new: true
    });
    logger.info(`Category updated: ${updated.name}`);
    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Category updated successfully!",
      category: updated
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(HttpStatus.CONFLICT).json({
        success: false,
        message: "Category name already taken."
      });
    }

    logger.error("editCategory error", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update Category"
    });
  }
};


export const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      logger.warn(`Category not found: ${id}`);
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Category not found" });
    }

    return res.status(HttpStatus.OK).json({ category });

  } catch (err) {
    logger.error("getCategory error", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to fetch category" });
  }
};

export const toggleListCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).select("isListed");
    if (!category) {
      logger.warn(`Category not found for toggle: ${id}`);
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Category not found!" });
    }

    const newStatus = !category.isListed;
    await Category.updateOne({ _id: id }, { isListed: newStatus });
    const action = newStatus ? "listed" : "unlisted ";
    logger.info(`Category ${action}: ${category.name}`);
    return res.status(HttpStatus.OK).json({
      success: true,
      message: `Category successfully ${action}.`,
      isListed: newStatus
    });
  } catch (error) {
    logger.error("toggleListCategory error", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to toggle category status." });
  }
};

export default {
  listCategories,
  addCategory,
  editCategory,
  getCategory,
  toggleListCategory
};