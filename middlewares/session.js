import MongoStore from "connect-mongo";
import session from "express-session";
import dotenv from "dotenv";
dotenv.config();

export const sessions=session({
  name: "sid",
  secret: process.env.SESSION_SECRET || "replace_this_secret",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI|| "mongodb://127.0.0.1:27017/chronora",
    collectionName: "sessions",
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: false
  }
});