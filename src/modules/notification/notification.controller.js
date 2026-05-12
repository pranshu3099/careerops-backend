import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { COMMON_MESSAGES } from "../../constants/messages.js";
import { NotificationService } from "./notification.service.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;

export class NotificationController {
  static async getNotifications(req, res) {
    try {
      const data = await NotificationService.getNotifications(
        getAuthUserId(req),
        req.query,
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async getUnreadCount(req, res) {
    try {
      const data = await NotificationService.getUnreadCount(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async markRead(req, res) {
    try {
      const data = await NotificationService.markRead(
        req.params.id,
        getAuthUserId(req),
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }

  static async markAllRead(req, res) {
    try {
      const data = await NotificationService.markAllRead(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }

  static async delete(req, res) {
    try {
      const data = await NotificationService.delete(
        req.params.id,
        getAuthUserId(req),
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }
}
