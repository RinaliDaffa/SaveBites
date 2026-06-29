/**
 * SaveBites V3 — Shared Zod validation schemas
 *
 * Single source of truth for input validation. Used by:
 * - Route handlers (app/api/**)
 * - Server Actions (lib/actions/**)
 * - Tests (tests/unit/validations.test.ts)
 *
 * Re-export schemas here so they can be imported once and stay in sync
 * with the runtime checks.
 */
import { z } from 'zod';

// ─── Order: reservation ────────────────────────────────────────
export const reserveSchema = z.object({
  listingId: z.string().uuid('listingId must be a UUID'),
  quantity: z.number().int().min(1, 'quantity must be at least 1').max(10, 'quantity max is 10'),
  paymentMethod: z.enum(['midtrans', 'cash']).optional(),
});
export type ReserveInput = z.infer<typeof reserveSchema>;

// ─── Order: pickup code confirmation ───────────────────────────
export const pickupConfirmSchema = z.object({
  pickupCode: z
    .string()
    .regex(/^[A-Z0-9]{6}$/, 'pickupCode must be 6 uppercase alphanumeric')
    .or(z.string().length(6)),
});
export type PickupConfirmInput = z.infer<typeof pickupConfirmSchema>;

// ─── Order: pickup code verify (lookup) ────────────────────────
export const pickupVerifySchema = z.object({
  pickupCode: z
    .string()
    .regex(/^[A-Z0-9]{6}$/, 'pickupCode must be 6 uppercase alphanumeric'),
});
export type PickupVerifyInput = z.infer<typeof pickupVerifySchema>;

// ─── Auth: login ───────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ─── Auth: register ────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  fullName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  phone: z.string().min(6, 'Phone number is required'),
  role: z.enum(['consumer', 'merchant']),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Auth: forgot / reset password ─────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email('Email tidak valid'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmPassword: z.string().min(8, 'Password minimal 8 karakter'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password tidak cocok',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Reviews ───────────────────────────────────────────────────
export const reviewSchema = z.object({
  orderId: z.string().uuid('orderId must be a UUID'),
  rating: z.number().int().min(1, 'rating must be at least 1').max(5, 'rating max is 5'),
  comment: z.string().max(500).optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;