import { Router } from "express";

import authenticate from "../../middlewares/auth.middleware.js";
import { FollowUpController } from "./followup.controller.js";

const router = Router();

router.get("/upcoming", authenticate, FollowUpController.getUpcomingFollowUps);
router.get(
  "/application/:applicationId",
  authenticate,
  FollowUpController.getApplicationFollowUps,
);

export const legacyFollowUpRoutes = Router();

legacyFollowUpRoutes.get(
  "/upcoming-followups",
  authenticate,
  FollowUpController.getUpcomingFollowUps,
);
legacyFollowUpRoutes.get(
  "/:id/followups",
  authenticate,
  FollowUpController.getApplicationFollowUps,
);

export default router;
