import "dotenv/config";
import { Worker } from "bullmq";
import redisConnection from "../config/redis.js";
import { sendVerificationEmail } from "../utils/verificationmailer.js";

export const emailWorker = new Worker(
    "email-queue",
    async (job) =>{
        const {to, verificationLink} = job.data;
        if (job.name === "send-verification-email") {
            await sendVerificationEmail({ to, verificationLink });
        }
    },
    {
        connection: redisConnection,
    }
)

emailWorker.on("completed", (job) => {
    console.log(`Email job with ID ${job.id} has been completed.`);
});

emailWorker.on("failed", (job, err) => {
    console.error(`Email job with ID ${job.id} has failed. Error: ${err.message}`);
});
