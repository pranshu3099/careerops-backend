import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import passport from "./config/passport.js";
import authRoutes from "../src/modules/auth/auth.routes.js";
import applicationRoutes from "../src/modules/application/application.routes.js";
import followUpRoutes, {
  legacyFollowUpRoutes,
} from "../src/modules/followup/followup.routes.js";
import interviewRoutes from "../src/modules/interview/interview.routes.js";
import settingsRoutes from "../src/modules/settings/settings.routes.js";
import analyticsRoutes from "../src/modules/analytics/analytics.routes.js";
import notificationRoutes from "../src/modules/notification/notification.routes.js";
import { originCheck } from "./middlewares/csrf.middleware.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(originCheck);
app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/followups", followUpRoutes);
app.use("/interviews", interviewRoutes);
app.use("/settings", settingsRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/notifications", notificationRoutes);
app.use("/applications", legacyFollowUpRoutes);
app.use("/applications", applicationRoutes);

export default app;
