import cloudinary from "../../config/cloudinary.js";
import Category from "../../models/categorySchema.js";
import fs from "fs";

export const listCategories = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = Number(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

   const filter = {
      isDeleted: false,
      ...(search && {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { regex: search, $options: "i" } }
        ]
      })
    };

    const total = await Category.countDocuments(filter);
    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render("admin/categories", {
      title: "Categories",
      page: "categories",           // REQUIRED FOR SIDEBAR
      categories,
      search,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      message: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ success: false, message: "Fill all fields" });
    }

    let image = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chronora/categories"
      });
      image = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    await Category.create({ name, description, image });
    res.json({ success: true, message: "Category added!" });
  } catch (err) {
    console.error("addCategory:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const update = { name, description };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chronora/categories"
      });
      update.image = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    await Category.findByIdAndUpdate(id, update);
    res.json({ success: true, message: "Updated!" });
  } catch (err) {
    console.error("editCategory:", err);
    res.status(500).json({ success: false, message: "Update failed" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cat = await Category.findById(id);
    if (!cat) return res.status(404).json({ success: false });

    await Category.findByIdAndUpdate(id, {
      isDeleted: !cat.isDeleted,
      deletedAt: !cat.isDeleted ? new Date() : null
    });

    res.json({ success: true, message: cat.isDeleted ? "Restored!" : "Deleted!" });
  } catch (err) {
    console.error("deleteCategory:", err);
    res.status(500).json({ success: false });
  }
};