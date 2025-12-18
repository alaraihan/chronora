import express from "express";
const app = express();
import dotenv from "dotenv";
dotenv.config();
import {sessions} from "./middlewares/session.js";
import passport from "./config/passport.js";
import expressLayouts from 'express-ejs-layouts';
import userRouter from "./routes/userRouter.js";
import adminRouter from "./routes/adminRouter.js";
import { message } from "./middlewares/message.js";
import {setUser} from './middlewares/authMiddleware.js';
import { Cache } from "./middlewares/cache.js";
import { layouts } from "./middlewares/layouts.js";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import { checkBlockedUser } from "./middlewares/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({limit:'50mb'}));
app.use(express.urlencoded({ extended: true,limit:'50mb' }));

app.use(sessions);

app.use(message);
app.use(Cache);
app.use(layouts);
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);



app.set('layout', 'layouts/userLayouts/main');

app.use(passport.initialize());
app.use(passport.session());
app.use(setUser);
app.use(checkBlockedUser);

app.use("/", userRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
