import Product from "../../models/productSchema.js";
import Variant from "../../models/variantSchema.js";
import Category from "../../models/categorySchema.js";
import cloudinary from "../../config/cloudinary.js";
import fs from "fs";
import mongoose from "mongoose";
import logger from "../../helpers/logger.js";

const escapeRegex = str =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeParseVariants = variantsRaw => {
  try {
    return typeof variantsRaw === "string"
      ? JSON.parse(variantsRaw)
      : variantsRaw || [];
  } catch {
    return null;
  }
};

const deleteLocalFile = path => {
  try {
    if (path && fs.existsSync(path)) fs.unlinkSync(path);
  } catch (e) {
    logger.warn("File cleanup failed", { error: e.message });
  }
};


export async function listProducts(req, res) {
  try {
    const searchQuery = (req.query.search || "").trim();
    const currentPage = Math.max(1, parseInt(req.query.page || "1"));
    const limit = Math.max(1, parseInt(req.query.limit || "8"));
    const skip = (currentPage - 1) * limit;

    const matchStage = searchQuery
      ? {
          $match: {
            $and: searchQuery.split(/\s+/).map(word => ({
              name: { $regex: word, $options: "i" }
            }))
          }
        }
      : { $match: {} };

    const agg = await Product.aggregate([
      matchStage,
      {
        $lookup: {
          from: "variants",
          localField: "variants",
          foreignField: "_id",
          as: "variantDocs"
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          firstImage: {
            $let: {
              vars: { fv: { $arrayElemAt: ["$variantDocs", 0] } },
              in: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ["$$fv.images", []] } }, 0] },
                  { $arrayElemAt: ["$$fv.images", 0] },
                  null
                ]
              }
            }
          },
          totalStock: {
            $sum: {
              $map: {
                input: { $ifNull: ["$variantDocs", []] },
                as: "v",
                in: { $ifNull: ["$$v.stock", 0] }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          totalStock: 1,
          isBlocked: 1,
          categoryName: "$categoryDoc.name",
          image: { $ifNull: ["$firstImage", "/images/no-image.png"] },
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          results: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }]
        }
      }
    ]);

    const results = agg?.[0]?.results || [];
    const totalCount = agg?.[0]?.totalCount?.[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const categories = await Category.find({ isListed: true })
      .sort({ name: 1 })
      .lean();

    return res.render("admin/product", {
      page: "products",
      pageJs: "products",
      pageCss: "products",
      products: results,
      categories,
      searchQuery,
      pagination: { currentPage, limit, totalPages, totalCount },
      title: "Products"
    });
  } catch (err) {
    logger.error("listProducts error", err);
    res.status(500).send("Server error");
  }
}


export async function getProduct(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid ID" });

    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("variants")
      .lean();

    if (!product)
      return res.status(404).json({ success: false });

    res.json({
      success: true,
      data: {
        id: product._id,
        name: product.name,
        description: product.description || "",
        price: product.price || 0,
        category: product.category?._id || "",
        variants: (product.variants || []).map(v => ({
          id: v._id,
          name: v.colorName || "",
          stock: v.stock || 0,
          images: v.images || []
        }))
      }
    });
  } catch (err) {
    logger.error("getProduct error", err);
    res.status(500).json({ success: false });
  }
}


export async function addProduct(req, res) {
  try {
    const { name, category, description, price } = req.body;

    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Name required" });

    if (!category)
      return res.status(400).json({ success: false, message: "Category required" });

    if (!price || isNaN(price))
      return res.status(400).json({ success: false, message: "Valid price required" });

    const variants = safeParseVariants(req.body.variants);
    if (!variants)
      return res.status(400).json({ success: false, message: "Invalid variants" });

    const files = req.files || [];
    if (files.length < 2)
      return res.status(400).json({ success: false, message: "At least 2 images required" });

    const existing = await Product.findOne({
      name: new RegExp(`^${escapeRegex(name.trim())}$`, "i")
    });

    if (existing)
      return res.status(400).json({
        success: false,
        message: "Product already exists"
      });

    const cat = await Category.findById(category);
    if (!cat)
      return res.status(400).json({ success: false, message: "Invalid category" });

    const product = await Product.create({
      name: name.trim(),
      description,
      price: Number(price),
      category
    });

    let fileIndex = 0;
    const variantIds = [];

    for (const v of variants) {
      const images = [];

      for (let i = 0; i < Number(v.newImageCount || 0); i++) {
        const f = files[fileIndex++];
        if (!f) break;

        const upload = await cloudinary.uploader.upload(f.path, {
          folder: "chronora/products",
          transformation: { width: 1200, crop: "limit" }
        });

        images.push(upload.secure_url);
        deleteLocalFile(f.path);
      }

      if (!images.length)
        return res.status(400).json({ success: false, message: "Variant image required" });

      if (isNaN(v.stock) || v.stock < 0)
        return res.status(400).json({ success: false, message: "Invalid stock" });

      const variant = await Variant.create({
        product: product._id,
        colorName: v.name || "",
        stock: Number(v.stock),
        images,
        strapColor: v.strapColor || ""
      });

      variantIds.push(variant._id);
    }

    product.variants = variantIds;
    await product.save();

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error("addProduct error", err);
    res.status(500).json({ success: false });
  }
}


export async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Invalid ID" });

    const product = await Product.findById(id);
    if (!product)
      return res.status(404).json({ success: false });

    const { name, category, description, price } = req.body;
    const variants = safeParseVariants(req.body.variants);

    if (!variants)
      return res.status(400).json({ success: false, message: "Invalid variants" });

    if (name) {
      const existing = await Product.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${escapeRegex(name.trim())}$`, "i")
      });

      if (existing)
        return res.status(400).json({ success: false, message: "Duplicate product" });

      product.name = name.trim();
    }

    if (description !== undefined)
      product.description = description.trim();

    if (price !== undefined) {
      if (isNaN(price))
        return res.status(400).json({ success: false, message: "Invalid price" });

      product.price = Number(price);
    }

    if (category) {
      const cat = await Category.findById(category);
      if (!cat)
        return res.status(400).json({ success: false, message: "Invalid category" });

      product.category = category;
    }

    await product.save();

    res.json({ success: true });
  } catch (err) {
    logger.error("updateProduct error", err);
    res.status(500).json({ success: false });
  }
}


export async function toggleBlock(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false });

    const block = req.body.action === "block";

    const product = await Product.findByIdAndUpdate(
      id,
      { isBlocked: block },
      { new: true }
    );

    if (!product)
      return res.status(404).json({ success: false });

    res.json({ success: true });
  } catch (err) {
    logger.error("toggleBlock error", err);
    res.status(500).json({ success: false });
  }
}

export default {
  listProducts,
  getProduct,
  addProduct,
  updateProduct,
  toggleBlock
};
