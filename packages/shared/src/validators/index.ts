import { z } from 'zod';
import { USER_ROLES } from '../types/auth';

export const tenantSlugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens');

export const emailSchema = z.string().email();

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberDevice: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(255),
  username: z.string().min(2).max(100).regex(/^[a-z0-9_-]+$/).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const setup2faSchema = z.object({
  token: z.string().length(6),
});

export const verify2faSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().length(6),
  rememberDevice: z.boolean().optional().default(false),
});

export const twoFactorRecoverySchema = z.object({
  userId: z.string().uuid(),
  backupCode: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(USER_ROLES),
  tenantId: z.string().uuid().optional(),
});

export const impersonateSchema = z.object({
  userId: z.string().uuid(),
});

export const adminActionSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const linkOauthSchema = z.object({
  provider: z.enum(['google', 'github']),
  code: z.string().min(1),
});

export const unlinkOauthSchema = z.object({
  provider: z.enum(['google', 'github']),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type Setup2faInput = z.infer<typeof setup2faSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type TwoFactorRecoveryInput = z.infer<typeof twoFactorRecoverySchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type ImpersonateInput = z.infer<typeof impersonateSchema>;
export type AdminActionInput = z.infer<typeof adminActionSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type LinkOauthInput = z.infer<typeof linkOauthSchema>;
export type UnlinkOauthInput = z.infer<typeof unlinkOauthSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const difficultySchema = z.number().int().min(1).max(5);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const createCourseSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  description: z.string().optional(),
  difficulty: difficultySchema.default(1),
  estimatedHours: z.number().int().min(1).optional(),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  isPublic: z.boolean().default(true),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export * from './theme';
export * from './page';
