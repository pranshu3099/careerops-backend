import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "./config/passport.js";
import authRoutes from "../src/modules/auth/auth.routes.js";
import applicationRoutes from "../src/modules/application/application.routes.js";
import followUpRoutes, {
  legacyFollowUpRoutes,
} from "../src/modules/followup/followup.routes.js";

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
app.use("/followups", followUpRoutes);
app.use("/applications", legacyFollowUpRoutes);
app.use("/applications", applicationRoutes);

export default app;
