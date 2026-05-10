import { HTTP_STATUS } from "../../constants/httpStatus.js";
import NotificationScheduler from "../../scheduler/notification.scheduler.js";
import { InterviewService } from "./interview.service.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;

export class InterviewController {
  static async getAllInterviews(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await InterviewService.getAllInterviews(userId);

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: e.message });
    }
  }

  static async createInterview(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await InterviewService.createInterview(userId, req.body);
      await NotificationScheduler.scheduleUserSyncJob(userId);

      return res.status(HTTP_STATUS.CREATED).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }

  static async getApplicationInterviews(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await InterviewService.getApplicationInterviews(
        req.params.applicationId,
        userId,
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async updateInterview(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await InterviewService.updateInterview(
        req.params.id,
        userId,
        req.body,
      );
      await NotificationScheduler.scheduleUserSyncJob(userId);

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }

  static async cancelInterview(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await InterviewService.cancelInterview(req.params.id, userId);

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }

  static async updateInterviewResult(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await InterviewService.updateInterviewResult(
        req.params.id,
        userId,
        req.body,
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }
}
