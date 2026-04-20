import { Router } from "express";

import { ApplicationController } from "./application.controller.js";
import authenticate from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { createApplicationSchema } from "../../validators/application.schema.js";
const router = Router();

router.post(
  "/create",
  authenticate,
  validateRequest(createApplicationSchema),
  ApplicationController.createApplicationHandler,
);
router.patch(
  "/:id/status",
  authenticate,
  ApplicationController.updateStatusHandler,
);

export default router;
