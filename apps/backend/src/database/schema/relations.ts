import { relations } from 'drizzle-orm';
import { courses, series, lessons } from './courses';
import { academies } from './academies';
import { users, follows, userPortfolioItems } from './users';
import { tenants } from './tenants';
import { enrollments, lessonProgress } from './progress';
import { posts, postLikes, comments } from './posts';
import { certifications } from './certifications';
import { orders, orderItems } from './orders';
import { navigationItems } from './navigation';
import { productsBundle, productVariants } from './products';
import { notifications } from './notifications';
import { userPreferences } from './user-preferences';
import { events, eventAttendees } from './events';
import { videoSeries, videos } from './videos';
import { studyGroups } from './social';
import { themes, themeVersions } from './themes';
import { pages, pageVersions } from './pages';
import {
  refreshTokens,
  verificationTokens,
  oauthAccounts,
  twoFactorSecrets,
  userSessions,
  auditLogs,
  userTenantRoles,
} from './auth';

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  courses: many(courses),
  academies: many(academies),
  enrollments: many(enrollments),
  certifications: many(certifications),
  posts: many(posts),
  orders: many(orders),
  navigationItems: many(navigationItems),
  userTenantRoles: many(userTenantRoles),
  auditLogs: many(auditLogs),
  pages: many(pages),
  pageVersions: many(pageVersions),
  themes: many(themes),
  themeVersions: many(themeVersions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  enrollments: many(enrollments),
  lessonProgress: many(lessonProgress),
  posts: many(posts),
  comments: many(comments),
  certifications: many(certifications),
  orders: many(orders),
  portfolioItems: many(userPortfolioItems),
  notifications: many(notifications),
  followers: many(follows, { relationName: 'followers' }),
  following: many(follows, { relationName: 'following' }),
  refreshTokens: many(refreshTokens),
  verificationTokens: many(verificationTokens),
  oauthAccounts: many(oauthAccounts),
  twoFactorSecret: one(twoFactorSecrets),
  sessions: many(userSessions),
  auditLogs: many(auditLogs),
  tenantRoles: many(userTenantRoles),
  preferences: one(userPreferences),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, { fields: [verificationTokens.userId], references: [users.id] }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }),
}));

export const twoFactorSecretsRelations = relations(twoFactorSecrets, ({ one }) => ({
  user: one(users, { fields: [twoFactorSecrets.userId], references: [users.id] }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [auditLogs.tenantId], references: [tenants.id] }),
}));

export const userTenantRolesRelations = relations(userTenantRoles, ({ one }) => ({
  user: one(users, { fields: [userTenantRoles.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [userTenantRoles.tenantId], references: [tenants.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id], relationName: 'followers' }),
  following: one(users, { fields: [follows.followingId], references: [users.id], relationName: 'following' }),
}));

export const userPortfolioItemsRelations = relations(userPortfolioItems, ({ one }) => ({
  user: one(users, { fields: [userPortfolioItems.userId], references: [users.id] }),
}));

export const academiesRelations = relations(academies, ({ one, many }) => ({
  tenant: one(tenants, { fields: [academies.tenantId], references: [tenants.id] }),
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  tenant: one(tenants, { fields: [courses.tenantId], references: [tenants.id] }),
  academy: one(academies, { fields: [courses.academyId], references: [academies.id] }),
  series: many(series),
  enrollments: many(enrollments),
  certifications: many(certifications),
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
  course: one(courses, { fields: [series.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  series: one(series, { fields: [lessons.seriesId], references: [series.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [lessonProgress.lessonId], references: [lessons.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  likes: many(postLikes),
  comments: many(comments),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, { fields: [postLikes.postId], references: [posts.id] }),
  user: one(users, { fields: [postLikes.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const productsRelations = relations(productsBundle, ({ many }) => ({
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(productsBundle, { fields: [productVariants.productId], references: [productsBundle.id] }),
}));

export const navigationItemsRelations = relations(navigationItems, ({ one }) => ({
  tenant: one(tenants, { fields: [navigationItems.tenantId], references: [tenants.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  tenant: one(tenants, { fields: [events.tenantId], references: [tenants.id] }),
  attendees: many(eventAttendees),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, { fields: [eventAttendees.eventId], references: [events.id] }),
  user: one(users, { fields: [eventAttendees.userId], references: [users.id] }),
}));

export const videoSeriesRelations = relations(videoSeries, ({ many }) => ({
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  series: one(videoSeries, { fields: [videos.seriesId], references: [videoSeries.id] }),
}));

export const studyGroupsRelations = relations(studyGroups, ({ one }) => ({
  host: one(users, { fields: [studyGroups.hostId], references: [users.id] }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  tenant: one(tenants, { fields: [pages.tenantId], references: [tenants.id] }),
  publishedBy: one(users, { fields: [pages.publishedById], references: [users.id] }),
  updatedBy: one(users, { fields: [pages.updatedById], references: [users.id] }),
  versions: many(pageVersions),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  page: one(pages, { fields: [pageVersions.pageId], references: [pages.id] }),
  tenant: one(tenants, { fields: [pageVersions.tenantId], references: [tenants.id] }),
  changedBy: one(users, { fields: [pageVersions.changedById], references: [users.id] }),
}));

export const themesRelations = relations(themes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [themes.tenantId], references: [tenants.id] }),
  publishedBy: one(users, { fields: [themes.publishedById], references: [users.id] }),
  updatedBy: one(users, { fields: [themes.updatedById], references: [users.id] }),
  versions: many(themeVersions),
}));

export const themeVersionsRelations = relations(themeVersions, ({ one }) => ({
  theme: one(themes, { fields: [themeVersions.themeId], references: [themes.id] }),
  tenant: one(tenants, { fields: [themeVersions.tenantId], references: [tenants.id] }),
  changedBy: one(users, { fields: [themeVersions.changedById], references: [users.id] }),
}));

export const certificationsRelations = relations(certifications, ({ one }) => ({
  tenant: one(tenants, { fields: [certifications.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [certifications.userId], references: [users.id] }),
  course: one(courses, { fields: [certifications.courseId], references: [courses.id] }),
}));
