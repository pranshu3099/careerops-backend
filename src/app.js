import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "./config/passport.js";
import authRoutes from "../src/modules/auth/auth.routes.js";

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json())
app.use(cookieParser());
app.use(passport.initialize());

app.use("/auth", authRoutes);

export default app;
