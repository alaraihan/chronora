import express from "express";
const app = express();
import dotenv from "dotenv";
dotenv.config();
import session from "express-session";
import passport from "./config/passport.js";
import expressLayouts from 'express-ejs-layouts';
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import userRouter from "./routes/userRouter.js";
import adminRouter from "./routes/adminRouter.js";
import {setUser} from './middlewares/authMiddleware.js';
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'sid', 
  secret: process.env.SESSION_SECRET || 'replace_this_secret',
  resave: false,               
  saveUninitialized: false,  
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI|| 'mongodb://127.0.0.1:27017/chronora', 
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, 
    sameSite: 'lax',
    secure: false 
  }
}));

// app.js — place after app.use(session(...))
app.use((req, res, next) => {
  // 1) take flash from session if present
  const sessionMessage = req.session?.message || null;
  const sessionSuccess = typeof req.session?.success !== 'undefined' ? req.session.success : null;

  // 2) fallback to query params (useful for redirects like /login?success=Logged%20out)
  const queryMessage = req.query?.message || null;
  const querySuccess = req.query?.success ? true : null;

  // Resolution order: session > query
  const finalMessage = sessionMessage || queryMessage || (querySuccess ? req.query.success : null) || null;
  const finalSuccess = (sessionSuccess !== null ? sessionSuccess : (querySuccess !== null ? true : false)) || false;

  // expose to views
  res.locals.message = finalMessage;
  res.locals.success = finalSuccess;

  // clear session flash so it's one-time
  if (req.session) {
    delete req.session.message;
    delete req.session.success;
  }

  next();
});



app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});


app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);

app.use((req, res, next) => {
  if (req.path.startsWith('/admin') && req.path !== '/admin/login') {
    res.locals.layout = 'layouts/adminLayouts/main';
  } else if (!req.path.startsWith('/admin')) {
    res.locals.layout = 'layouts/userLayouts/main';
  } else {
    res.locals.layout = false;
  }
  next();
});

app.set('layout', 'layouts/userLayouts/main');

app.use(passport.initialize());
app.use(passport.session());
app.use(setUser);

app.use("/", userRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
