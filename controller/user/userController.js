import User from "../../models/userSchema.js";
import Product from "../../models/productSchema.js";
import Variant from '../../models/variantSchema.js'
import { sendOtp, generateOtp } from "../../utils/mail.js";
import bcrypt from "bcrypt";
import { setFlash, getFlash } from "../../utils/flash.js";
import Category from "../../models/categorySchema.js";
const render = (req, res, view, options = {}) => {
  const flash = getFlash(req); 
  return res.render(view, { flash, ...options });
};

const pageNotfound = async (req, res) => {
  try {
    return render(req, res, "user/pageNotfound", {
      title: "Chronora - 404 Page",
    });
  } catch (error) {
    console.log("Page not found");
    res.status(404).send();
  }
};

const googleCallback = (req, res) => {
  try {
    console.log("Google login successful, User:", req.user);

    req.session.userId = req.user._id;
    req.session.user = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
    };

    setFlash(req, "success", "Login successful!");
    return res.redirect("/home");
  } catch (err) {
    console.error("googleCallback error:", err);
    setFlash(req, "error", "Google login failed. Try again.");
    return res.redirect("/login");
  }
};

const loadAboutpage = async (req, res) => {
  try {
    return render(req, res, "user/about", {
      title: "Chronora - About",
    });
  } catch (error) {
    console.log("About page not found");
    res.status(404).send(error);
  }
};

const loadContactpage = async (req, res) => {
  try {
    return render(req, res, "user/contact", {
      title: "Chronora - Contact",
    });
  } catch (error) {
    console.log("Contact page not found");
    res.status(404).send(error);
  }
};

const loadHomepage = async (req, res) => {
  try {
    const categories=await Category.find({isListed:true})
    .select("name image")
    .sort({createdAt:-1})
    .limit(4)
    .lean();

    return render(req, res, "user/home", {
      user: req.session.user||null,
      title: "Chronora - Home",
      categories,
    });
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("server error");
  }
};



export const loadWatchPage = async (req, res) => {
  try {
    const searchQuery = req.query.search?.trim() || "";
    const sortQuery = req.query.sort || "newest";
    const categoryFilter = req.query.category || "";
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = 6;
    const skip = (page - 1) * limit;
    const productQuery = { isBlocked: false };

    if (searchQuery) {
      productQuery.$or = [{ name: { $regex: searchQuery, $options: "i" } }];
    }

    if (categoryFilter) {
      const categoryObj = await Category.findById(categoryFilter).lean();
      if (!categoryObj || !categoryObj.isListed) {
        const categories = await Category.find({ isListed: true })
          .select("name")
          .sort({ name: 1 })
          .lean();
        return res.render("user/watch", {
          user: req.session.user || null,
          title: "Chronora - Watch",
          products: [],
          categories,
          searchQuery,
          sortQuery,
          categoryFilter,
          currentPage: 1,
          totalPages: 0
        });
      }
      productQuery.category = categoryFilter;
    } else {
      const blockedCats = await Category.find({ isListed: false }).select("_id").lean();
      if (blockedCats.length) {
        productQuery.category = { $nin: blockedCats.map(c => c._id) };
      }
    }

    let sortOption = { createdAt: -1 }; 
    switch (sortQuery) {
      case "price-low":
        sortOption = { price: 1 };
        break;
      case "price-high":
        sortOption = { price: -1 };
        break;
      case "a-z":
        sortOption = { name: 1 };
        break;
      case "z-a":
        sortOption = { name: -1 };
        break;
    }

    const totalProducts = await Product.countDocuments(productQuery);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    const products = await Product.find(productQuery)
      .select("name price description category createdAt")
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const productIds = products.map(p => String(p._id));
    const variants = productIds.length
      ? await Variant.find({ product: { $in: productIds }, isBlocked: false })
          .select("product images colorName stock price")
          .lean()
      : [];

    const variantMap = {};
    variants.forEach(v => {
      variantMap[String(v.product)] = v;
    });

    const availableProducts = products.map(product => ({
      ...product,
      variant: variantMap[product._id] || null
    }));

    const categories = await Category.find({ isListed: true })
      .select("name")
      .sort({ name: 1 })
      .lean();

    res.render("user/watch", {
      user: req.session.user || null,
      title: "Chronora - Watch",
      products: availableProducts,
      categories,
      searchQuery,
      sortQuery,
      categoryFilter,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.error("Error in loadWatchPage:", error);
    res.status(500).send("Something went wrong");
  }
};


export const productDetails = async (req, res) => {
  try {
    const productId = req.params.id;
    const selectedVariantId = req.query.variant;

    const product = await Product.findOne({
      _id: productId,
      isBlocked: false
    }).populate("category");

    if (!product) {
      return res.status(404).render("user/pageNotfound");
    }
    if (!product.category || !product.category.isListed) {
      return res.status(404).render("user/pageNotfound");
    }

    const categoryId = product.category._id; 

    const variants = await Variant.find({
      product: productId,
      isBlocked: false
    });

    let variant = null;

    if (selectedVariantId) {
      variant = await Variant.findOne({
        _id: selectedVariantId,
        product: productId,
        isBlocked: false
      });
    }

    if (!variant && variants.length > 0) {
      variant = variants[0];
    }

    if (!variant) {
      variant = {
        images: [],
        colorName: "Default",
        stock: 0,
        price: product.price 
      };
    }

    const stockStatus = variant.stock > 0 ? "In Stock" : "Out of Stock";

    const relatedProducts = await Product.find({
      category: categoryId,
      _id: { $ne: productId },
      isBlocked: false
    })
    .limit(4)
    .populate("category"); 

const allVariants = await Variant.find({}, { product: 1, images: 1 }).lean();


    return res.render("user/productDetail", {
      title: "Product Detail",
      product,
      variants,
      variant,
      stockStatus,
      relatedProducts,
      allVariants
    });

  } catch (error) {
    console.error("Error loading product details:", error);
    return res.status(500).render("user/serverError"); 
  }
};
export default {
  googleCallback,
  pageNotfound,
  loadAboutpage,
  loadContactpage,
  loadHomepage,
  loadWatchPage,
  productDetails,
};