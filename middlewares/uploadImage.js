import multer from "multer";
import path from "path";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { createRequire } from "module";

// Ensure dotenv is loaded first
dotenv.config();

// Configure cloudinary directly here to avoid import timing issues
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const require = createRequire(import.meta.url);
const cloudinaryStoragePkg = require("multer-storage-cloudinary");

const CloudinaryStorage =
  cloudinaryStoragePkg.CloudinaryStorage ||
  cloudinaryStoragePkg.default ||
  cloudinaryStoragePkg;

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "chronora/variants",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req, file) => `variant-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
    transformation: [
      { quality: "auto" },
      { fetch_format: "auto" },
      { width: 1000, height: 1000, crop: "limit" }
    ]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, PNG, WEBP images allowed!"));
    }
  }
});

export default upload;