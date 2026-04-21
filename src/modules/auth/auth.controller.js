import { AuthService } from "./auth.service.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { AUTH_MESSAGES, COMMON_MESSAGES } from "../../constants/messages.js";
import { PrismaClient } from "@prisma/client";
import { generateRefreshToken, hashToken } from "../../utils/jwt.utils.js";
import EmailVerificationScheduler from "../../scheduler/emailverification.scheduler.js";
const prisma = new PrismaClient();
export class AuthController {
  static googleCallback(req, res) {
    try {
      const token = AuthService.generateAuthToken(req?.user);
      res.cookie("access_token", token, {
        httpOnly: true,
        sameSite: "strict",
      });
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Authentication failed ${AUTH_MESSAGES.INTERNAL_SERVER_ERROR}`,
      });
    }
  }

  static async register(req, res) {
    try {
      const user = await AuthService.userRegister(req?.body);

      if (!user || !user.id) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR,
        });
      }

      await EmailVerificationScheduler.sendVerificationEmailJob(user);

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: AUTH_MESSAGES.REGISTER_SUCCESS,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      if (error.message === AUTH_MESSAGES.EMAIL_ALREADY_EXISTS) {
        return res.status(HTTP_STATUS.CONFLICT || 409).json({
          success: false,
          message: AUTH_MESSAGES.EMAIL_ALREADY_EXISTS,
        });
      }

      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR,
      });
    }
  }

  static async verifyEmail(req, res) {
    const { token } = req?.query;
    if (!token) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Invalid verification link" });
    }

    const storedToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Link expired or invalid" });
    }

    await prisma.user.update({
      where: { id: storedToken.userId },
      data: { isUserVerified: true },
    });

    await prisma.emailVerificationToken.delete({
      where: { id: storedToken.id },
    });

    // redirect to frontend login page
    return res.redirect(`${process.env.FRONTEND_URL}`);
  }

  static async login(req, res) {
    try {
      const user = await AuthService.userLogin(req?.body);
      if (!user?.isUserVerified) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          message: "Your email address has not been verified yet.",
        });
      }
      const accessToken = AuthService.generateAuthToken({
        userId: user?.id,
        email: user?.email,
      });
      const refreshToken = generateRefreshToken();
      const hashedRefreshToken = hashToken(refreshToken);
      await prisma.refreshToken.create({
        data: {
          token: hashedRefreshToken,
          userId: user?.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Login successful",
        data: {
          accessToken,
          user: {
            id: user?.id,
            email: user?.email,
            name: user?.name || "John Doe",
          },
        },
      });
    } catch (error) {
      console.log(error);
      let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      let message = COMMON_MESSAGES.INTERNAL_SERVER_ERROR;

      if (error.message === AUTH_MESSAGES.INVALID_CREDENTIALS) {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = AUTH_MESSAGES.INVALID_CREDENTIALS;
      }

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  static async refresh() {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ message: "unauthorized" });
    }

    const hashedToken = hashToken(token);
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: hashedToken,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!storedToken) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ message: "Token reuse detected" });
    }
    // rotation for refresh token

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const newRefreshToken = generateRefreshToken();
    const hashedNewToken = hashToken(newRefreshToken);

    await prisma.refreshToken.create({
      data: {
        token: hashedNewToken,
        userId: storedToken.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = AuthService.generateAuthToken(user);
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.json({ accessToken });
  }

  static async logout(req, res) {
    const token = req.cookies.refreshToken;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: {
          token: hashToken(token),
        },
        data: { revoked: true },
      });
    }
    res.clearCookie("refreshToken");
    return res.status(HTTP_STATUS.OK).json({ message: "Logged out successfully", success: true, });
  }

  static async me(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      const user = await AuthService.getCurrentUser(refreshToken);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          isUserVerified: user.isUserVerified,
        },
      });
    } catch (error) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_MESSAGES.UNAUTHORIZED || "Unauthorized",
      });
    }
  }
}
