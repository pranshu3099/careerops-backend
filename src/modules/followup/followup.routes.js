import { Router } from "express";

import authenticate from "../../middlewares/auth.middleware.js";
import { FollowUpController } from "./followup.controller.js";

const router = Router();

router.get("/due-soon", authenticate, FollowUpController.getDueSoonFollowUps);
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

legacyFollowUpRoutes.get("/due-soon", authenticate, FollowUpController.getDueSoonFollowUps);


export default router;
