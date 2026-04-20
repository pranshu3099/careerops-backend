import { PrismaClient } from "@prisma/client";
import { generateToken, hashToken } from "../../utils/jwt.utils.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { AUTH_MESSAGES, COMMON_MESSAGES } from "../../constants/messages.js";
import { sendVerificationEmail } from "../../utils/verificationmailer.js";

const prisma = new PrismaClient();

export class AuthService {
  static async handleGoogleLogin(profile) {
    try {
      const googleId = profile?.id;
      const email = profile?.emails[0]?.value;
      let user = await prisma.user.findUnique({
        where: { oauthId: googleId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            oauthId: googleId,
            email,
            name: profile.displayName,
            avatar: profile.photos[0].value,
            provider: "GOOGLE",
          },
        });
      }
      return user;
    } catch (err) {
      const error = new Error("Server error");
      error.cause = err;
      throw error;
    }
  }

  static generateAuthToken(user) {
    return generateToken({
      userId: user.id,
      email: user.email,
    });
  }

  static async getCurrentUser(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error(AUTH_MESSAGES.UNAUTHORIZED);
      }
      const hashedToken = hashToken(refreshToken);
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: hashedToken,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: true,
        },
      });
      if (!storedToken || !storedToken.user) {
        throw new Error(AUTH_MESSAGES.UNAUTHORIZED);
      }

      return storedToken.user;
    } catch (err) {
      console.error("AuthService.getCurrentUser:", err);
      throw error;
    }
  }

  // static async sendEmail(user) {
  //   try {
  //     if (!user?.id || !user?.email) {
  //       throw new Error("Invalid user object passed to sendEmail");
  //     }

  //     const verificationToken = crypto.randomBytes(32).toString("hex");

  //     await prisma.emailVerificationToken.create({
  //       data: {
  //         token: verificationToken,
  //         userId: user.id,
  //         expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  //       },
  //     });

  //     const verificationLink = `${process.env.BACKEND_URL}/auth/verify-email?token=${verificationToken}`;

  //     await sendVerificationEmail({
  //       to: user.email,
  //       verificationLink,
  //     });
  //   } catch (error) {
  //     console.error("Error in sendEmail:", error);
  //     throw error; // VERY important
  //   }
  // }

  static async userRegister(user) {
    try {
      const { email, password, name } = user;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error(AUTH_MESSAGES.EMAIL_ALREADY_EXISTS);
      }

      const hashed_password = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          email: email,
          passwordHash: hashed_password,
          name,
        },
      });
      if (!newUser || !newUser?.id) {
        throw new Error(COMMON_MESSAGES.INTERNAL_SERVER_ERROR);
      }
      return newUser;
    } catch (error) {
      console.error("AuthService.userRegister:", error);
      throw error;
    }
  }

  static async userLogin(user) {
    try {
      const { email, password } = user;
      const existingUser = await prisma.user.findUnique({
        where: {
          email,
        },
      });
      console.log(existingUser, "existingUser");
      if (!existingUser || !existingUser.passwordHash) {
        throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        existingUser.passwordHash,
      );
      if (!isPasswordValid) {
        throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
      }
      return existingUser;
    } catch (error) {
      console.error("AuthService.userLogin:", error);
      throw error;
    }
  }
}
