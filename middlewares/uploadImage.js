import multer from "multer";
import path from "path";
import { createRequire } from "module";
import cloudinary from "../config/cloudinary.js"; 

const require = createRequire(import.meta.url);
const cloudinaryStoragePkg  = require("multer-storage-cloudinary");

const CloudinaryStorage =
  cloudinaryStoragePkg.CloudinaryStorage ||
  cloudinaryStoragePkg.default ||
  cloudinaryStoragePkg;

const storage =  new CloudinaryStorage({
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