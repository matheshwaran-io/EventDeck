import { z } from "zod";
import { participantCategory } from "@/db/schema";

import { isSrmEmail } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(72, "At most 72 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string().min(1, "Confirm your password").optional(),
    institutionType: z.enum(["SRM", "EXTERNAL_INSTITUTION", "GUEST"]).optional(),
    campus: z.enum(["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"]).optional().nullable(),
    affiliation: z.enum(["STUDENT", "FACULTY", "STAFF", "ALUMNI", "GUEST"]).optional(),
    institutionName: z.string().trim().max(160).optional().default(""),
    city: z.string().trim().max(100).optional().default(""),
    department: z.string().trim().max(120).optional().default(""),
    // Legacy fields for backward compatibility
    category: z.enum(participantCategory.enumValues).optional(),
    institution: z.string().trim().max(160).optional().default(""),
  })
  .superRefine((data, ctx) => {
    // 1. Password confirmation match (when provided)
    if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }

    const isSrm = isSrmEmail(data.email);

    // Determine effective institution type, campus, and affiliation (supporting legacy category)
    let instType = data.institutionType;
    let camp = data.campus;
    let affil = data.affiliation;
    const instName = data.institutionName?.trim() || data.institution?.trim() || "";

    if (!instType && data.category) {
      if (data.category === "host_student") {
        instType = "SRM";
        camp = camp ?? "KTR";
        affil = "STUDENT";
      } else if (data.category === "external_student") {
        instType = "EXTERNAL_INSTITUTION";
        affil = "STUDENT";
      } else if (data.category === "faculty") {
        instType = isSrm ? "SRM" : "EXTERNAL_INSTITUTION";
        camp = isSrm ? (camp ?? "KTR") : null;
        affil = "FACULTY";
      } else if (data.category === "staff") {
        instType = "SRM";
        camp = camp ?? "KTR";
        affil = "STAFF";
      } else if (data.category === "alumni") {
        instType = "SRM";
        camp = camp ?? "KTR";
        affil = "ALUMNI";
      } else if (data.category === "guest") {
        instType = "GUEST";
        affil = "GUEST";
      }
    }

    // Default to SRM if neither was passed
    if (!instType) instType = "SRM";
    if (!affil) affil = "STUDENT";

    // 2. SRM University validation
    if (instType === "SRM") {
      if (!camp && !data.category) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["campus"],
          message: "Please select your SRM campus",
        });
      }

      // SRM students and staff must use official SRM email
      if (affil === "STUDENT" || affil === "STAFF") {
        if (!isSrm) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["email"],
            message:
              "SRM students and staff must use their official SRM email (e.g. @srmist.edu.in). If you are from another college, select 'Other College / University'.",
          });
        }
      }

      // Guest affiliation not allowed under SRM
      if (affil === "GUEST") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["affiliation"],
          message: "External guests should select the 'Guest' option.",
        });
      }
    }

    // 3. External institution validation
    if (instType === "EXTERNAL_INSTITUTION") {
      if (!instName || instName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["institutionName"],
          message: "Please enter your college or university name.",
        });
      }
      if (data.institutionType === "EXTERNAL_INSTITUTION" && (!data.city || data.city.trim().length < 2)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["city"],
          message: "Please enter the city of your institution.",
        });
      }
      if (affil === "GUEST") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["affiliation"],
          message: "Please select Student, Faculty, or Staff for your institution.",
        });
      }
    }

    // 4. Guest validation: guests need no college name or campus!
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/, "Digits, spaces and + only")
    .optional()
    .default(""),
  institutionType: z.enum(["SRM", "EXTERNAL_INSTITUTION", "GUEST"]).optional().default("SRM"),
  campus: z.enum(["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"]).optional().nullable(),
  affiliation: z.enum(["STUDENT", "FACULTY", "STAFF", "ALUMNI", "GUEST"]).optional().default("STUDENT"),
  institutionName: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  department: z.string().trim().max(120).optional().default(""),
  category: z.enum(participantCategory.enumValues).optional(),
  institution: z.string().trim().max(160).optional().default(""),
});

export const organizerApplicationSchema = z.object({
  organization: z.string().trim().min(2, "Which club, department or society?").max(120),
  reason: z.string().trim().min(20, "Tell us a little more (20+ characters)").max(1000),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(72, "At most 72 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.input<typeof signupSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
