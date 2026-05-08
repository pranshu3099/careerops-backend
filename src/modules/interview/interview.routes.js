import { Router } from "express";

import authenticate from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import {
  createInterviewSchema,
  updateInterviewResultSchema,
  updateInterviewSchema,
} from "../../validators/interview.schema.js";
import { InterviewController } from "./interview.controller.js";

const router = Router();

router.get("/", authenticate, InterviewController.getAllInterviews);

router.post(
  "/",
  authenticate,
  validateRequest(createInterviewSchema),
  InterviewController.createInterview,
);

router.get(
  "/application/:applicationId",
  authenticate,
  InterviewController.getApplicationInterviews,
);

router.patch("/:id/cancel", authenticate, InterviewController.cancelInterview);

router.patch(
  "/:id/result",
  authenticate,
  validateRequest(updateInterviewResultSchema),
  InterviewController.updateInterviewResult,
);

router.patch(
  "/:id",
  authenticate,
  validateRequest(updateInterviewSchema),
  InterviewController.updateInterview,
);

export default router;
