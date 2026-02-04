import multer from "multer";
import path from "path";
import dotenv from "dotenv";
import { createRequire } from "module";

// Ensure dotenv is loaded first
dotenv.config();

const require = createRequire(import.meta.url);

// Use require for cloudinary to ensure compatibility with multer-storage-cloudinary
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

console.log("Cloudinary upload middleware configured");

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