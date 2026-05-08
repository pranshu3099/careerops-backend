import { z } from "zod";

export const updateFollowUpAlertSettingsSchema = z
  .object({
    followUpAlertsEnabled: z.boolean().optional(),
    followUpAlertDays: z.number().int().min(0).max(2).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
