import { ApplicationService } from "./application.service.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import FollowUpEmailService from "../../services/followupemail.service.js";
import { getUser } from "../../utils/helper.js";

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

      const { application, followUpId } = await ApplicationService.createApplication(
        userId,
        req.body,
      );

      await FollowUpEmailService.sendFollowupEmailJob(
        followUpId,
        hrEmail,
        role,
        company,
        appliedDate,
        hrName,
        user?.name,
        user?.email,
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
