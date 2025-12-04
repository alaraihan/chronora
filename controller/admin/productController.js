import Product from '../../models/productSchema.js';
import Variant from '../../models/variantSchema.js';
import Category from '../../models/categorySchema.js';
import cloudinary from '../../config/cloudinary.js'; 
import fs from 'fs';
import mongoose from 'mongoose';
export async function listProducts(req, res) {
  try {
    const searchQuery = (req.query.search || '').trim();
    const currentPage = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '8', 10));
    const skip = (currentPage - 1) * limit;

    const matchStage = searchQuery ? { $match: { name: { $regex: searchQuery, $options: 'i' } } } : { $match: {} };

    const agg = await Product.aggregate([
      matchStage,
      {
        $lookup: {
          from: 'variants',
          localField: 'variants',
          foreignField: '_id',
          as: 'variantDocs'
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDoc'
        }
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          firstImage: {
            $let: {
              vars: { fv: { $arrayElemAt: ['$variantDocs', 0] } },
              in: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$$fv.images', []] } }, 0] },
                  { $arrayElemAt: ['$$fv.images', 0] },
                  null
                ]
              }
            }
          },
          totalStock: {
            $sum: {
              $map: {
                input: { $ifNull: ['$variantDocs', []] },
                as: 'v',
                in: { $ifNull: ['$$v.stock', 0] }
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
          categoryName: '$categoryDoc.name',
          image: { $ifNull: ['$firstImage', '/images/no-image.png'] },
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          results: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ]);

    const results = (agg[0] && Array.isArray(agg[0].results)) ? agg[0].results : [];
    const totalCount = (agg[0] && agg[0].totalCount && agg[0].totalCount[0] && Number(agg[0].totalCount[0].count)) ? Number(agg[0].totalCount[0].count) : 0;
    const totalPages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1;

    const categories = await Category.find({ isListed: true }).sort({ name: 1 }).lean();

    return res.render('admin/product', {
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
      title: 'Products'
    });
  } catch (err) {
    console.error('listProducts error:', err);
    return res.status(500).send('Server error');
  }
}

export async function getProduct(req, res) {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const p = await Product.findById(id)
      .populate('category', 'name')
      .populate({ path: 'variants', model: 'Variant' })
      .lean();

    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });

    const data = {
      id: p._id.toString(),
      name: p.name,
      description: p.description || '',
      price: p.price || 0,
      category: p.category?._id?.toString() || '',
      variants: (p.variants || []).map(v => ({
        id: v._id.toString(),
        name: v.colorName || '',
        stock: v.stock || 0,
        images: (v.images || []).slice() 
      }))
    };

    return res.json({ success: true, data });
  } catch (err) {
    console.error('getProduct error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function addProduct(req, res) {
  try {
   
    const { name, category, description, price } = req.body;
    const variants = JSON.parse(req.body.variants || '[]'); 
    const files = req.files || [];
    if (!name || !category ||!price) return res.status(400).json({ success: false, message: 'Name & price required' });
     const existing = await Product.findOne({ name: name.trim(), isBlocked: false });
    if (existing) return res.status(400).json({ success: false, message: 'Product already exists!' });

    const cat = await Category.findById(category);
    if (!cat) return res.status(400).json({ success: false, message: 'Invalid category' });

 if (files.length < 2) {
      return res.status(400).json({ success: false, message: 'Please upload at least 2 images for the product' });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description?.trim() || '',
      price: Number(price || 0),
      category
    });

    let fileIndex = 0;
    const savedVariantIds = [];

    for (const v of variants) {
      const imgs = [];
      const count = Number(v.newImageCount || 0);
      for (let i = 0; i < count; i++) {
        const f = files[fileIndex++];
        if (!f) break;
        const up = await cloudinary.uploader.upload(f.path, { folder: 'chronora/products', transformation: { width: 1200, crop: 'limit' }});
        imgs.push(up.secure_url);
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      }

      const newV = await Variant.create({
        product: product._id,
        colorName: v.name || '',
        stock: Number(v.stock || 0),
        images: imgs
      });

      savedVariantIds.push(newV._id);
    }
    
    product.variants = savedVariantIds;
    await product.save();

    return res.status(201).json({ success: true, message: 'Product created' });
  } catch (err) {
    console.error('addProduct error', err);
    return res.status(500).json({ success: false, message: 'Failed to add product' });
  }
}

export async function updateProduct(req, res) {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const { name, category, description, price } = req.body;
    const variants = JSON.parse(req.body.variants || '[]'); 
    const files = req.files || [];

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const cat = await Category.findById(category);
    if (!cat) return res.status(400).json({ success: false, message: 'Invalid category' });

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
        if (!f) break;
        const up = await cloudinary.uploader.upload(f.path, { folder: 'chronora/products', transformation: { width: 1200, crop: 'limit' } });
        existing.push(up.secure_url);
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      }

      if (v.id) {
        await Variant.findByIdAndUpdate(v.id, {
          colorName: v.name || '',
          stock: Number(v.stock || 0),
          images: existing
        }, { new: true });
        newVariantIds.push(v.id);
      } else {
        const created = await Variant.create({
          product: product._id,
          colorName: v.name || '',
          stock: Number(v.stock || 0),
          images: existing
        });
        newVariantIds.push(created._id);
      }
    }

    const currentIds = (product.variants || []).map(x => x.toString());
    const toDelete = currentIds.filter(x => !newVariantIds.includes(x));
    if (toDelete.length) {
      await Variant.deleteMany({ _id: { $in: toDelete } });
    }

    product.variants = newVariantIds;
    await product.save();

    return res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    console.error('updateProduct error', err);
    return res.status(500).json({ success: false, message: 'Failed to update product' });
  }
}

export async function toggleBlock(req, res) {
  try {
    const id = req.params.id;
    const action = req.body.action; 
    const block = action === 'block';
    const p = await Product.findByIdAndUpdate(id, { isBlocked: block }, { new: true });
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.json({ success: true, message: `Product ${block ? 'blocked' : 'unblocked'}` });
  } catch (err) {
    console.error('toggleBlock error', err);
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  }
}

export default {
  listProducts,
  getProduct,
  addProduct,
  updateProduct,
  toggleBlock
};
