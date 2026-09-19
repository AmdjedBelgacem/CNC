export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  username?: string | null;
  role: string;
  accountStatus: string;
  createdAt: string;
  avatarUrl?: string | null;
}
export interface UserPurchaseRow {
  id: string;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  currency: string;
  status: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface UserEnrollmentRow {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  certificateId?: string | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseThumbnail?: string | null;
}
export interface UserCertificateRow {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  pdfUrl?: string | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}
export interface UserLearningProgress {
  totalEnrollments: number;
  completedLessons: number;
  totalWatchTimeSeconds: number;
  certificatesEarned: number;
}
export const ROLE_OPTIONS = [
  'super_admin',
  'admin',
  'instructor',
  'moderator',
  'sponsor',
  'learner',
];
export const STAFF_ROLE_OPTIONS = ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'];
export const ADMIN_ROLES = ['super_admin', 'admin'];
export function userInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
