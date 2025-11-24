import Category from "../../models/categorySchema.js";
import cloudinary from "../../config/cloudinary.js";
import fs from "fs";
import sendResponse from "../../utils/response.js";   

const render = (req, res, view, options = {}) => {
  const flash = req.session.flash || null;
  delete req.session.flash; 
  return res.render(view, { flash, ...options });
};

export const listCategories = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 8;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
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
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCategories: total,
    });
  } catch (err) {
    console.error("listCategories error:", err);
    return sendResponse(req, res, "error", "Failed to load categories", {}, "/admin/dashboard");
  }
};
export const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name?.trim() || !description?.trim()) {
      return sendResponse(req, res, "error", "Please fill all fields", {}, "/admin/categories");
    }

    const exists = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false,
    });
    if (exists) {
      return sendResponse(req, res, "error", "Category already exists", {}, "/admin/categories");
    }

    let image = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chronora/categories",
        transformation: { width: 500, height: 500, crop: "limit" },
      });
      image = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const category = await Category.create({
      name: name.trim(),
      description: description.trim(),
      image,
    });

    return sendResponse(req, res, "success", "Category added successfully!", {
      category: category.toObject()
    }, "/admin/categories");

  } catch (err) {
    console.error("addCategory error:", err);
    return sendResponse(req, res, "error", "Failed to add category", {}, "/admin/categories");
  }
};
export const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name?.trim() || !description?.trim()) {
      return sendResponse(req, res, "error", "Please fill all fields", {}, "/admin/categories");
    }

    const updateData = {
      name: name.trim(),
      description: description.trim(),
    };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chronora/categories",
      });
      updateData.image = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const updated = await Category.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return sendResponse(req, res, "error", "Category not found", {}, "/admin/categories");
    }

    return sendResponse(req, res, "success", "Category updated successfully!", {
      category: updated.toObject()
    }, "/admin/categories");

  } catch (err) {
    console.error("editCategory error:", err);
    return sendResponse(req, res, "error", "Failed to update category", {}, "/admin/categories");
  }
};

export const toggleDeleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return sendResponse(req, res, "error", "Category not found");
    }

    const wasDeleted = category.isDeleted;
    category.isDeleted = !wasDeleted;
    category.deletedAt = wasDeleted ? null : new Date();
    await category.save();

    const message = wasDeleted ? "Category restored!" : "Category moved to trash!";

    return sendResponse(req, res, "success", message, {
      isDeleted: category.isDeleted,
      message
    });

  } catch (err) {
    console.error("toggleDeleteCategory error:", err);
    return sendResponse(req, res, "error", "Operation failed");
  }
};

export default {
  listCategories,
  addCategory,
  editCategory,
  toggleDeleteCategory,
};