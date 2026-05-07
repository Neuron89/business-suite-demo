import { z } from 'zod';
import { MODULE_KEYS, PORTAL_ROLES } from './constants';

export const loginSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, 'password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
});
export type ForgotInput = z.infer<typeof forgotSchema>;

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(10, 'minimum 10 characters'),
});
export type ResetInput = z.infer<typeof resetSchema>;

export const setPasswordSchema = z.object({
  password: z.string().min(10, 'minimum 10 characters'),
});

// Derived from MODULE_KEYS so that adding a module in constants.ts
// automatically extends the access schema. Without this, a checkbox toggle
// for an un-listed module gets silently stripped by zod and never reaches
// the directory PATCH endpoint.
const accessShape = Object.fromEntries(
  MODULE_KEYS.map((key) => [key, z.boolean().optional()])
) as Record<(typeof MODULE_KEYS)[number], z.ZodOptional<z.ZodBoolean>>;

export const updateAccessSchema = z.object({
  email: z.string().email(),
  access: z.object(accessShape).optional(),
  portal_role: z.enum(PORTAL_ROLES).optional(),
});
