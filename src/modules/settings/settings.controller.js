import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { SettingsService } from "./settings.service.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;

export class SettingsController {
  static async getFollowUpAlertSettings(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await SettingsService.getFollowUpAlertSettings(userId);

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: e.message });
    }
  }

  static async updateFollowUpAlertSettings(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await SettingsService.updateFollowUpAlertSettings(
        userId,
        req.body,
      );

      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: e.message });
    }
  }
}
