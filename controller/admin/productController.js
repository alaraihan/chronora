import Product from "../../models/productSchema.js";
import Variant from "../../models/variantSchema.js";
import Category from "../../models/categorySchema.js";
import cloudinary from "../../config/cloudinary.js";
import fs from "fs";
import mongoose from "mongoose";
import logger from "../../helpers/logger.js";

export async function listProducts(req, res) {
  try {
    const searchQuery = (req.query.search || "").trim();
    const currentPage = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "8", 10));
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
    ]).collation({ locale: "en", strength: 2 });

    const results = (agg[0] && Array.isArray(agg[0].results)) ? agg[0].results : [];
    const totalCount = (agg[0] && agg[0].totalCount && agg[0].totalCount[0] && Number(agg[0].totalCount[0].count)) ? Number(agg[0].totalCount[0].count) : 0;
    const totalPages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1;

    const categories = await Category.find({ isListed: true }).sort({ name: 1 }).lean();
    logger.info("Products listed", { searchQuery, currentPage, limit, totalCount });

    return res.render("admin/product", {
      page: "products",
      pageJs: "products",
      pageCss: "products",
      products: results,
      categories,
      searchQuery,
      pagination: {
        currentPage,
        limit,
        totalPages,
        totalCount
      },
      title: "Products"
    });
  } catch (err) {
    logger.error("listProducts error:", err);
    return res.status(500).send("Server error");
  }
}

export async function getProduct(req, res) {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
            logger.warn("Invalid product id in getProduct", { id });
       return res.status(400).json({ success: false, message: "Invalid id" }); }

    const p = await Product.findById(id)
      .populate("category", "name")
      .populate({ path: "variants", model: "Variant" })
      .lean();

    if (!p) { 
            logger.warn("Product not found in getProduct", { id });
return res.status(404).json({ success: false, message: "Product not found" }); }

    const data = {
      id: p._id.toString(),
      name: p.name,
      description: p.description || "",
      price: p.price || 0,
      category: p.category?._id?.toString() || "",
      variants: (p.variants || []).map(v => ({
        id: v._id.toString(),
        name: v.colorName || "",
        stock: v.stock || 0,
        images: (v.images || []).slice()
      }))
    };
    logger.info("Product fetched", { id });
    return res.json({ success: true, data });
  } catch (err) {
    logger.error("getProduct error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function addProduct(req, res) {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    const { name, category, description, price } = req.body;

    if (!name || !category || !price) {
            logger.warn("Missing required fields in addProduct", { body: req.body });
      return res.status(400).json({ success: false, message: "Name & price required" });
    }

    let variants = [];
    try {
      variants =
        typeof req.body.variants === "string"
          ? JSON.parse(req.body.variants)
          : req.body.variants || [];
    } catch (e) {
            logger.warn("Invalid variants format in addProduct", { error: e.message });
      return res.status(400).json({ success: false, message: "Invalid variants format" });
    }

    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length < 2) {
            logger.warn("Insufficient images in addProduct");
      return res.status(400).json({
        success: false,
        message: "Please upload at least 2 images for the product",
      });
    }

    const existing = await Product.findOne({
      name: new RegExp(`^${name.trim()}$`, "i"),
      isBlocked: false,
    });

    if (existing) {
            logger.warn("Product already exists in addProduct", { name });
      return res.status(400).json({ success: false, message: "Product already exists!" });
    }

    const cat = await Category.findById(category);
    if (!cat) {
            logger.warn("Invalid category in addProduct", { category });
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description?.trim() || "",
      price: Number(price),
      category,
    });

    let fileIndex = 0;
    const savedVariantIds = [];

    for (const v of variants) {
      const imgs = [];
      const count = Number(v.newImageCount || 0);

      for (let i = 0; i < count; i++) {
        const f = files[fileIndex++];
        if (!f) break;

        const uploadResult = await cloudinary.uploader.upload(f.path, {
          folder: "chronora/products",
          transformation: { width: 1200, crop: "limit" },
        });
        imgs.push(uploadResult.secure_url);

        try {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (e) {
          logger.warn("File cleanup failed:", e.message);
        }
      }

      const newVariant = await Variant.create({
        product: product._id,
        colorName: v.name || "",
        stock: Number(v.stock || 0),
        images: imgs,
        strapColor: v.strapColor || "",
      });

      savedVariantIds.push(newVariant._id);
    }

    product.variants = savedVariantIds;
    await product.save();
    logger.info("Product created", { productId: product._id, name });

    return res.status(201).json({ success: true, message: "Product created" });

  } catch (err) {
    logger.error("ADD PRODUCT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add product",
      error: err.message,
    });
  }
}


export async function updateProduct(req, res) {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
            logger.warn("Invalid product id in updateProduct", { id });
 return res.status(400).json({ success: false, message: "Invalid id" }); }

    const { name, category, description, price } = req.body;
    const variants = JSON.parse(req.body.variants || "[]");
    const files = req.files || [];

    const product = await Product.findById(id);
    if (!product) { 
            logger.warn("Product not found in updateProduct", { id });
return res.status(404).json({ success: false, message: "Product not found" }); }

    const cat = await Category.findById(category);
    if (!cat) { 
            logger.warn("Invalid category in updateProduct", { category });
return res.status(400).json({ success: false, message: "Invalid category" }); }

    product.name = name?.trim() || product.name;
    product.description = description?.trim() || product.description;
    product.price = Number(price || product.price);
    product.category = category;

    let fileIndex = 0;
    const newVariantIds = [];

    for (const v of variants) {
      const existing = Array.isArray(v.existingImages) ? v.existingImages.slice() : [];
      const count = Number(v.newImageCount || 0);

      for (let i = 0; i < count; i++) {
        const f = files[fileIndex++];
        if (!f) { break; }

        const uploadResult = await cloudinary.uploader.upload(f.path, {
          folder: "chronora/products",
          transformation: { width: 1200, crop: "limit" }
        });
        existing.push(uploadResult.secure_url);

        try {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (e) {
          console.warn("File cleanup failed:", e.message);
        }
      }

      if (v.id) {
        await Variant.findByIdAndUpdate(v.id, {
          colorName: v.name || "",
          stock: Number(v.stock || 0),
          images: existing,
          strapColor: v.strapColor
        }, { new: true });
        newVariantIds.push(v.id);
      } else {
        const created = await Variant.create({
          product: product._id,
          colorName: v.name || "",
          stock: Number(v.stock || 0),
          images: existing,
          strapColor: v.strapColor
        });
        newVariantIds.push(created._id);
      }
    }

    const currentIds = (product.variants || []).map(x => x.toString());
    const toDelete = currentIds.filter(x => !newVariantIds.includes(x));
    if (toDelete.length) {
      await Variant.deleteMany({ _id: { $in: toDelete } });
          logger.info("Deleted removed variants in updateProduct", { productId: product._id, deletedVariantIds: toDelete });
}

    product.variants = newVariantIds;
    await product.save();
    logger.info("Product updated", { productId: product._id });

    return res.json({ success: true, message: "Product updated" });
  } catch (err) {
    logger.error("updateProduct error:", err);
    return res.status(500).json({ success: false, message: "Failed to update product" });
  }
}

export async function toggleBlock(req, res) {
  try {
    const id = req.params.id;
    const action = req.body.action;
    const block = action === "block";
    const p = await Product.findByIdAndUpdate(id, { isBlocked: block }, { new: true });
    if (!p) { 
            logger.warn("Product not found in toggleBlock", { id });
return res.status(404).json({ success: false, message: "Product not found" }); }
    logger.info(`Product ${block ? "blocked" : "unblocked"}`, { productId: p._id });
    return res.json({ success: true, message: `Product ${block ? "blocked" : "unblocked"}` });
  } catch (err) {
    logger.error("toggleBlock error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
}

export default {
  listProducts,
  getProduct,
  addProduct,
  updateProduct,
  toggleBlock
};
