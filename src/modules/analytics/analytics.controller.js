import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { COMMON_MESSAGES } from "../../constants/messages.js";
import { AnalyticsService } from "./analytics.service.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;

export class AnalyticsController {
  static async getOverview(req, res) {
    try {
      const data = await AnalyticsService.getOverview(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async getFunnel(req, res) {
    try {
      const data = await AnalyticsService.getFunnel(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async getTimeline(req, res) {
    try {
      const data = await AnalyticsService.getTimeline(getAuthUserId(req), {
        range: req.query.range,
        bucket: req.query.bucket,
      });
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async getSources(req, res) {
    try {
      const data = await AnalyticsService.getSources(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async getInterviews(req, res) {
    try {
      const data = await AnalyticsService.getInterviews(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }

  static async getTimeMetrics(req, res) {
    try {
      const data = await AnalyticsService.getTimeMetrics(getAuthUserId(req));
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }
}
