import { z } from "zod";
import { participantCategory } from "@/db/schema";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(72, "At most 72 characters")
    .regex(/[A-Za-z]/, "Include a letter")
    .regex(/[0-9]/, "Include a number"),
  category: z.enum(participantCategory.enumValues),
  institution: z.string().trim().max(160).optional().default(""),
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
  category: z.enum(participantCategory.enumValues),
  institution: z.string().trim().max(160).optional().default(""),
  department: z.string().trim().max(120).optional().default(""),
});

export const organizerApplicationSchema = z.object({
  organization: z.string().trim().min(2, "Which club, department or society?").max(120),
  reason: z.string().trim().min(20, "Tell us a little more (20+ characters)").max(1000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.input<typeof signupSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
