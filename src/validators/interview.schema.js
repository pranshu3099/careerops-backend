import { z } from "zod";

const interviewTypes = [
  "DSA",
  "TECHNICAL",
  "SYSTEM_DESIGN",
  "HR",
  "MANAGERIAL",
  "BEHAVIORAL",
  "TAKE_HOME",
  "OTHER",
];

const interviewResults = ["PASSED", "FAILED", "PENDING"];

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const dateString = (message) =>
  z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), message);

export const createInterviewSchema = z
  .object({
    applicationId: z.string().uuid("Application ID must be a valid UUID"),
    round: z
      .number()
      .int()
      .positive("Round must be a positive number")
      .optional(),
    roundName: optionalTrimmedString,
    type: z.enum(interviewTypes),
    interviewer: optionalTrimmedString,
    scheduledAt: dateString("Scheduled date must be a valid date"),
  })
  .strict();

export const updateInterviewSchema = z
  .object({
    roundName: optionalTrimmedString,
    type: z.enum(interviewTypes).optional(),
    interviewer: optionalTrimmedString,
    scheduledAt: dateString("Scheduled date must be a valid date").optional(),
    feedback: optionalTrimmedString,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const updateInterviewResultSchema = z
  .object({
    result: z.enum(interviewResults),
    feedback: optionalTrimmedString,
  })
  .strict();
