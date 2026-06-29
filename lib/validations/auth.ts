/**
 * SaveBites V3 — Authentication Validation Schemas
 * Zod schemas for login, register, merchant onboarding, and profile updates.
 */

import { z } from 'zod';

/** Login form schema */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginForm = z.infer<typeof loginSchema>;

/** Registration form schema */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(['consumer', 'merchant']).refine((val) => val !== undefined, {
    message: 'Please select a role',
  }),
});

export type RegisterForm = z.infer<typeof registerSchema>;

/** Merchant onboarding schema */
export const merchantOnboardingSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  category: z.string().min(1, 'Category is required'),
  cuisine: z.string().optional(),
  address: z.string().min(5, 'Address is required'),
  city: z.string().default('Yogyakarta'),
  latitude: z.coerce.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.coerce.number().min(-180).max(180, 'Invalid longitude'),
  phone: z.string().optional(),
  openingHours: z.record(z.string(), z.any()).optional(),
});

export type MerchantOnboardingForm = z.infer<typeof merchantOnboardingSchema>;

/** Profile update schema */
export const profileUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  dietaryTags: z.array(z.string()).optional(),
});

export type ProfileUpdateForm = z.infer<typeof profileUpdateSchema>;

/** Forgot password schema */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

/** Reset password schema */
export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
