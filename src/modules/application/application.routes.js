import { Router } from "express";
import { ApplicationController } from "./application.controller.js";
import authenticate from "../../middlewares/auth.middleware.js";
const router = Router()

router.post('/applications', authenticate ,ApplicationController.createApplicationHandler)
router.patch('/applications/:id/status', authenticate,  ApplicationController.updateStatusHandler)

export default router
