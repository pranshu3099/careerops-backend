import crypto from "crypto";
import { emailQueue } from "../queues/email.queue.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
class EmailVerificationScheduler {
  static async sendVerificationEmailJob(user) {
    try {
      if (!user?.id || !user?.email) {
        throw new Error(
          "Invalid user object passed to sendVerificationEmailJob",
        );
      }
      const verificationToken = crypto.randomBytes(32).toString("hex");
      await prisma.emailVerificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const verificationLink = `${process.env.BACKEND_URL}/auth/verify-email?token=${verificationToken}`;
      await emailQueue.add(
        "send-verification-email",
        {
          to: user.email,
          verificationLink,
        },
        {
          attempts: 3, // retry 3 times
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      const err = new Error("Failed to enqueue email job");
      err.cause = error;
      throw err;
    }
  }
}

export default EmailVerificationScheduler;