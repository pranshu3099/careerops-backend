import { ApplicationService } from "./application.service.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { getUser } from "../../utils/helper.js";
import FollowUpEmailScheduler from "../../scheduler/followupemail.scheduler.js";
import { ghostQueue } from "../../queues/ghost.queue.js";

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
}
