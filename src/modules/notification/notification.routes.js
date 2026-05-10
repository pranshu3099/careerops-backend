import { Router } from "express";

import authenticate from "../../middlewares/auth.middleware.js";
import { NotificationController } from "./notification.controller.js";

const router = Router();

router.get("/", authenticate, NotificationController.getNotifications);
router.get("/unread-count", authenticate, NotificationController.getUnreadCount);
router.patch("/read-all", authenticate, NotificationController.markAllRead);
router.patch("/:id/read", authenticate, NotificationController.markRead);
router.delete("/:id", authenticate, NotificationController.delete);

export default router;
