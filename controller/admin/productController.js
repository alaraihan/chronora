import Product from "../../models/productSchema.js";
import Variant from "../../models/variantSchema.js";
import Category from "../../models/categorySchema.js";
import cloudinary from "../../config/cloudinary.js";
import fs from "fs";
import mongoose from "mongoose";
import logger from "../../helpers/logger.js";


async function uploadImage(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "chronora/products",
    transformation: { width: 1200, crop: "limit" },
  });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return result.secure_url;
}

function parseVariants(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw || [];
  } catch {
    return null;
  }
}


export async function listProducts(req, res) {
  try {
    const searchQuery = (req.query.search || "").trim();
    const currentPage = Math.max(1, parseInt(req.query.page  || "1"));
    const limit       = Math.max(1, parseInt(req.query.limit || "8"));
    const skip        = (currentPage - 1) * limit;

    const matchStage = searchQuery
      ? {
          $match: {
            $and: searchQuery
              .split(/\s+/)
              .map(word => ({ name: { $regex: word, $options: "i" } })),
          },
        }
      : { $match: {} };

    const agg = await Product.aggregate([
      matchStage,
      {
        $lookup: {
          from: "variants", localField: "variants",
          foreignField: "_id", as: "variantDocs",
        },
      },
      {
        $lookup: {
          from: "categories", localField: "category",
          foreignField: "_id", as: "categoryDoc",
        },
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
                  null,
                ],
              },
            },
          },
          totalStock: {
            $sum: {
              $map: {
                input: { $ifNull: ["$variantDocs", []] },
                as: "v",
                in: { $ifNull: ["$$v.stock", 0] },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1, name: 1, price: 1, totalStock: 1, isBlocked: 1,
          categoryName: "$categoryDoc.name",
          image: { $ifNull: ["$firstImage", "/images/no-image.png"] },
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          results:    [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ]).collation({ locale: "en", strength: 2 });

    const results    = agg?.[0]?.results             || [];
    const totalCount = agg?.[0]?.totalCount?.[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const categories = await Category.find({ isListed: true }).sort({ name: 1 }).lean();

    return res.render("admin/product", {
      page: "products", pageJs: "products", pageCss: "products",
      products: results, categories, searchQuery,
      pagination: { currentPage, limit, totalPages, totalCount },
      title: "Products",
    });
  } catch (err) {
    logger.error("listProducts error", err);
    return res.status(500).send("Server error");
  }
}

export async function getProduct(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("variants")
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.json({
      success: true,
      data: {
        id:          product._id,
        name:        product.name,
        description: product.description || "",
        price:       product.price       || 0,
        category:    product.category?._id || "",
        variants: (product.variants || []).map(v => ({
          id:     v._id,
          name:   v.colorName || "",
          stock:  v.stock     || 0,
          images: v.images    || [],
        })),
      },
    });
  } catch (err) {
    logger.error("getProduct error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function addProduct(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, category, description, price } = req.body;
    const files    = Array.isArray(req.files) ? req.files : [];
    const variants = parseVariants(req.body.variants);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    if (price === undefined || price === "" || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ success: false, message: "Price must be a number greater than 0" });
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ success: false, message: "At least one variant is required" });
    }

    if (files.length < 2) {
      return res.status(400).json({ success: false, message: "At least 2 images are required" });
    }

    for (let i = 0; i < variants.length; i++) {
      const stock = Number(variants[i].stock);
      if (isNaN(stock) || stock < 1) {
        return res.status(400).json({
          success: false,
          message: `Variant ${i + 1} stock must be at least 1`,
        });
      }
    }

    const cat = await Category.findById(category).lean();
    if (!cat) {
      return res.status(400).json({ success: false, message: "Selected category does not exist" });
    }

    const trimmedName = name.trim();
    const duplicate = await Product.findOne({
      name: { $regex: `^${trimmedName}$`, $options: "i" },
    }).lean();

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `A product named "${trimmedName}" already exists`,
      });
    }

    const [product] = await Product.create(
      [{ name: trimmedName, description: description?.trim() || "", price: Number(price), category }],
      { session }
    );

    let fileIndex = 0;
    const variantIds = [];

    for (const v of variants) {
      const images = [];
      const imgCount = Number(v.newImageCount || 0);

      for (let i = 0; i < imgCount; i++) {
        const file = files[fileIndex++];
        if (!file) break;
        const url = await uploadImage(file.path);
        images.push(url);
      }

      const [variant] = await Variant.create(
        [{ product: product._id, colorName: v.name || "", stock: Number(v.stock), images }],
        { session }
      );
      variantIds.push(variant._id);
    }

    product.variants = variantIds;
    await product.save({ session });

    await session.commitTransaction();
    logger.info("Product created", { id: product._id });

    return res.status(201).json({ success: true });

  } catch (err) {
    await session.abortTransaction();
    logger.error("addProduct error", err);
    return res.status(500).json({ success: false, message: "Failed to add product" });
  } finally {
    session.endSession();
  }
}

export async function updateProduct(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const { name, category, description, price } = req.body;
    const files    = Array.isArray(req.files) ? req.files : [];
    const variants = parseVariants(req.body.variants);

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ success: false, message: "At least one variant is required" });
    }

    if (price !== undefined && (isNaN(Number(price)) || Number(price) <= 0)) {
      return res.status(400).json({ success: false, message: "Price must be a number greater than 0" });
    }

    for (let i = 0; i < variants.length; i++) {
      const stock = Number(variants[i].stock);
      if (isNaN(stock) || stock < 1) {
        return res.status(400).json({
          success: false,
          message: `Variant ${i + 1} stock must be at least 1`,
        });
      }
    }

    const product = await Product.findById(id).session(session);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

 
    if (name && name.trim()) {
      const trimmedName = name.trim();
      const duplicate = await Product.findOne({
        _id:  { $ne: id },                                      
        name: { $regex: `^${trimmedName}$`, $options: "i" },   
      }).lean();

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another product named "${trimmedName}" already exists`,
        });
      }

      product.name = trimmedName;
    }

    if (description !== undefined)  product.description = description.trim();
    if (price       !== undefined)  product.price       = Number(price);

    if (category) {
      const cat = await Category.findById(category).lean();
      if (!cat) {
        return res.status(400).json({ success: false, message: "Selected category does not exist" });
      }
      product.category = category;
    }

    let fileIndex = 0;
    const newVariantIds = [];

    for (const v of variants) {
      const images   = Array.isArray(v.existingImages) ? [...v.existingImages] : [];
      const imgCount = Number(v.newImageCount || 0);

      for (let i = 0; i < imgCount; i++) {
        const file = files[fileIndex++];
        if (!file) break;
        const url = await uploadImage(file.path);
        images.push(url);
      }

      if (images.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Variant "${v.name || "unnamed"}" must have at least 1 image`,
        });
      }

      if (v.id && mongoose.Types.ObjectId.isValid(v.id)) {
        await Variant.findByIdAndUpdate(
          v.id,
          { colorName: v.name, stock: Number(v.stock), images },
          { session }
        );
        newVariantIds.push(v.id);
      } else {
        const [created] = await Variant.create(
          [{ product: product._id, colorName: v.name, stock: Number(v.stock), images }],
          { session }
        );
        newVariantIds.push(created._id);
      }
    }

    const removedVariantIds = product.variants.filter(
      existingId => !newVariantIds.map(String).includes(String(existingId))
    );
    if (removedVariantIds.length > 0) {
      await Variant.deleteMany({ _id: { $in: removedVariantIds } }).session(session);
    }

    product.variants = newVariantIds;
    await product.save({ session });

    await session.commitTransaction();
    logger.info("Product updated", { id });

    return res.json({ success: true });

  } catch (err) {
    await session.abortTransaction();
    logger.error("updateProduct error", err);
    return res.status(500).json({ success: false, message: "Failed to update product" });
  } finally {
    session.endSession();
  }
}


export async function toggleBlock(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const shouldBlock = req.body.action === "block";

    const product = await Product.findByIdAndUpdate(
      id,
      { isBlocked: shouldBlock },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    logger.info(`Product ${shouldBlock ? "blocked" : "unblocked"}`, { id });
    return res.json({ success: true });

  } catch (err) {
    logger.error("toggleBlock error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}


export default { listProducts, getProduct, addProduct, updateProduct, toggleBlock };