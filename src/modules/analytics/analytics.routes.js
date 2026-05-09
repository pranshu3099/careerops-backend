import { Router } from "express";

import authenticate from "../../middlewares/auth.middleware.js";
import { AnalyticsController } from "./analytics.controller.js";

const router = Router();

router.get("/overview", authenticate, AnalyticsController.getOverview);
router.get("/funnel", authenticate, AnalyticsController.getFunnel);
router.get("/timeline", authenticate, AnalyticsController.getTimeline);
router.get("/sources", authenticate, AnalyticsController.getSources);
router.get("/interviews", authenticate, AnalyticsController.getInterviews);
router.get("/time-metrics", authenticate, AnalyticsController.getTimeMetrics);

export default router;

