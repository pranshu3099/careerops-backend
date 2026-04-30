import { z } from "zod";

const validPlatforms = ["linkedin", "naukri", "referral", "career page", "other"];
const validSources = [
  ...validPlatforms,
  "career_page",
  "LINKEDIN",
  "NAUKRI",
  "REFERRAL",
  "CAREER_PAGE",
  "OTHER",
];

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
});

export const updateApplicationSchema = z
  .object({
    role: z.string().trim().min(1, "Role cannot be empty").optional(),
    location: z.string().trim().optional(),
    source: z
      .string()
      .trim()
      .refine(
        (value) => validSources.includes(value) || validSources.includes(value.toLowerCase()),
        "Source must be one of: LinkedIn, Naukri, Referral, Career Page, Other",
      )
      .optional(),
    appliedDate: z
      .string()
      .trim()
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "Applied date must be a valid date",
      )
      .optional(),
    hrEmail: z.string().email("Invalid HR email format").optional(),
    hrName: z.string().trim().min(1, "HR name cannot be empty").optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
