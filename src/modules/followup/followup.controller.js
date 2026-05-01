import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { FollowUpService } from "./followup.service.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;

export class FollowUpController {
  static async getApplicationFollowUps(req, res) {
    try {
      const userId = getAuthUserId(req);
      const applicationId = req.params.applicationId || req.params.id;
      const data = await FollowUpService.getApplicationFollowUps(
        applicationId,
        userId,
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: e.message });
    }
  }

  static async getUpcomingFollowUps(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await FollowUpService.getUpcomingFollowUps(userId);

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: e.message });
    }
  }
}
