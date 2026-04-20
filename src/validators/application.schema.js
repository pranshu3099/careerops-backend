import { z } from "zod";

const validPlatforms = ["linkedin", "naukri", "referral", "career page", "other"];

export const createApplicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().min(1, "Role is required"),
  location: z.string().trim().min(1, "Location is required"),
  platform: z
    .string()
    .trim()
    .min(1, "Platform is required")
    .refine(
      (value) => validPlatforms.includes(value.toLowerCase()),
      "Platform must be one of: LinkedIn, Naukri, Referral, Career Page, Other",
    ),
  appliedDate: z
    .string()
    .trim()
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Applied date must be a valid date",
    ),
  hrEmail: z.string().email("Invalid HR email format"),
  hrName: z.string().trim().min(1, "HR name is required"),
  userId: z.string().uuid("User ID must be a valid UUID"),
});
