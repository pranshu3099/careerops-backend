import { PrismaClient } from "@prisma/client";
import { ApplicationService } from "./application.service";
import { HTTP_STATUS } from "../../constants/httpStatus";
const prisma = new PrismaClient();
export class ApplicationController {
  static async createApplicationHandler(req, res) {
    try {
      const token = req.cookies.refreshToken;
      const userId = await prisma.refreshToken.findUnique({
        where: {
          email,
        },
      });
      if (userId) {
        const applications = await ApplicationService.createApplication(
          userId,
          req.body,
        );
        return res.status(HTTP_STATUS.CREATED).json({
          success: true,
          data: application,
        });
      }
    } catch (err) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: err.message,
      });
    }
  }

  static async updateStatusHandler(req, res) {
    try {
      const userId = await prisma.refreshToken.findUnique({
        where: {
          email,
        },
      });
      const { id } = req.params;
      const { status } = req.body;

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
