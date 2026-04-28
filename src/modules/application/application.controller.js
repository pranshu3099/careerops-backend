import { ApplicationService } from "./application.service.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { getUser } from "../../utils/helper.js";
import FollowUpEmailScheduler from "../../scheduler/followupemail.scheduler.js";
import { ghostQueue } from "../../queues/ghost.queue.js";

const getAuthUserId = (req) => req?.user?.userId || req?.user?.id;
const INITIAL_GHOST_CHECK_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const STATUS_GHOST_CHECK_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

const createGhostJobId = (applicationId, delayMs) =>
  `ghost-${applicationId}-${Date.now() + delayMs}`;

const enqueueGhostCheck = async (data, delayMs) => {
  try {
    await ghostQueue.add("check-ghost", data, {
      delay: delayMs,
      jobId: createGhostJobId(data.applicationId, delayMs),
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });
  } catch (err) {
    console.error(
      `Failed to enqueue ghost check for application ${data.applicationId}: ${err.message}`,
    );
  }
};

const enqueueFollowUpJobs = async (followUps, jobData) => {
  const results = await Promise.allSettled(
    followUps.map(async (followUp) => {
      try {
        return await FollowUpEmailScheduler.scheduleFollowUpJob({
          followUpId: followUp.id,
          type: followUp.type,
          sequence: followUp.sequence,
          ...jobData,
          delayMs: Math.max(followUp.scheduledAt.getTime() - Date.now(), 0),
        });
      } catch (err) {
        err.followUpId = followUp.id;
        throw err;
      }
    }),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(
        `Failed to enqueue followup ${result.reason?.followUpId}: ${result.reason?.message}`,
      );
    }
  });
};

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

      const { applicationId, status, appliedAt, followUpId, nextFollowUpAt, followUps } =
        await ApplicationService.createApplication(userId, req.body);

      const queueData = {
        hrEmail,
        role,
        company,
        appliedDate,
        hrName,
        userName: user?.name,
        userEmail: user?.email,
      };

      await enqueueFollowUpJobs(followUps, queueData);

      await enqueueGhostCheck(
        {
          applicationId,
          followUpId,
          ...queueData,
        },
        INITIAL_GHOST_CHECK_DELAY_MS,
      );
      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: {
          applicationId,
          status,
          appliedAt,
          followUpId,
          nextFollowUpAt,
          followUps,
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

      await enqueueGhostCheck(
        { applicationId: updated?.id },
        STATUS_GHOST_CHECK_DELAY_MS,
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

  static async getUpcomingFollowUps(req, res) {
    try {
      const userId = getAuthUserId(req);
      const data = await ApplicationService.getUpcomingFollowUps(userId);
      return res.status(HTTP_STATUS.OK).json(data);
    } catch (e) {
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: e.message });
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
