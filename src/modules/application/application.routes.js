import { Router } from "express";

import { ApplicationController } from "./application.controller.js";
import authenticate from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { createApplicationSchema } from "../../validators/application.schema.js";
const router = Router();

router.post(
  "/",
  authenticate,
  validateRequest(createApplicationSchema),
  ApplicationController.createApplicationHandler,
);
router.patch(
  "/:id/status",
  authenticate,
  ApplicationController.updateStatusHandler,
);

router.get("/", authenticate, ApplicationController.getApplications);
router.get("/stats", authenticate, ApplicationController.getStats);

router.get("/:id", authenticate, ApplicationController.getApplicationById);
router.patch("/:id", authenticate, ApplicationController.updateApplication);
router.delete("/:id", authenticate, ApplicationController.deleteApplication);

router.get("/:id/followups", authenticate, ApplicationController.getFollowUps);
router.get("/:id/ghost", authenticate, ApplicationController.getGhost);

export default router;
