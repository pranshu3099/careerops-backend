import { ApplicationService } from "./application.service.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { getUser } from "../../utils/helper.js";
import FollowUpEmailScheduler from "../../scheduler/followupemail.scheduler.js";
import { ghostQueue } from "../../queues/ghost.queue.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;

export class ApplicationController {
  static async createApplicationHandler(req, res) {
    try {
      const { userId, hrEmail, role, company, appliedDate, hrName } = req?.body;
      const user = await getUser(userId);
      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { application, followUpId } =
        await ApplicationService.createApplication(userId, req.body);

      await FollowUpEmailScheduler.sendFollowupEmailJob(
        followUpId,
        hrEmail,
        role,
        company,
        appliedDate,
        hrName,
        user?.name,
        user?.email,
      );

      await ghostQueue.add(
        "check-ghost",
        {
          applicationId: application.id,
          followUpId,
          hrEmail,
          role,
          company,
          appliedDate,
          hrName,
          userName: user?.name,
          userEmail: user?.email,
        },
        {
          delay: 1000,
          //delay: 7 * 24 * 60 * 60 * 1000, first check after 7 days
          jobId: application.id,
          removeOnComplete: true,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );
      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: {
          application,
          followUpId,
        },
      });
    } catch (err) {
      if (err.message === "Application already exists") {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: err.message,
        });
      }

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: err.message,
      });
    }
  }

  static async updateStatusHandler(req, res) {
    try {
      const { id } = req.params;
      const { status, userId } = req.body;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const updated = await ApplicationService.updateApplicationStatus(
        userId,
        id,
        status,
      );

      await ghostQueue.add(
        "check-ghost",
        { applicationId: updated?.id },
        {
          delay: 3 * 24 * 60 * 60 * 1000,
          jobId: updated?.id,
        },
      );

      return res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: err.message,
      });
    }
  }

  static async getApplications(req, res) {
    try {
      const userId = getAuthUserId(req);
      console.log(userId, "userId");
      const data = await ApplicationService.getApplications(userId);
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: e.message });
    }
  }

  static async getApplicationById(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.getApplicationById(
        req.params.id,
        userId,
      );
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async updateApplication(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.updateApplication(
        req.params.id,
        userId,
        req.body,
      );
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async deleteApplication(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.deleteApplication(
        req.params.id,
        userId,
      );
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async getFollowUps(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.getUserFollowUps(
        req.params.id,
        userId,
      );
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async getGhost(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.getGhostApplication(
        req.params.id,
        userId,
      );
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async getStats(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.getApplicationStats(userId);
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: e.message });
    }
  }
}
