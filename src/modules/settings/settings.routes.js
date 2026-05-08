import { Router } from "express";

import authenticate from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { updateFollowUpAlertSettingsSchema } from "../../validators/settings.schema.js";
import { SettingsController } from "./settings.controller.js";

const router = Router();

router.get(
  "/followup-alerts",
  authenticate,
  SettingsController.getFollowUpAlertSettings,
);

router.patch(
  "/followup-alerts",
  authenticate,
  validateRequest(updateFollowUpAlertSettingsSchema),
  SettingsController.updateFollowUpAlertSettings,
);

export default router;
