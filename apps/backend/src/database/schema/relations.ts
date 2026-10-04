import { relations } from 'drizzle-orm';
import { courses, series, lessons } from './courses';
import { academies } from './academies';
import { users, follows, userPortfolioItems } from './users';
import { tenants } from './tenants';
import { enrollments, lessonProgress, lessonQuizAttempts } from './progress';
import { posts, postVotes, comments, commentVotes, tags, postTags } from './posts';
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
import { financeBudgets } from './finance';
import { aiConversations, aiMessages } from './ai-assistant';
import { aiEvalCases, aiEvalRuns, aiFeedback, aiWebSearchCache, aiWebSearchConfigs } from './ai-learning';
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
  lessonQuizAttempts: many(lessonQuizAttempts),
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
  products: many(productsBundle),
  financeBudgets: many(financeBudgets),
  notifications: many(notifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  enrollments: many(enrollments),
  lessonProgress: many(lessonProgress),
  lessonQuizAttempts: many(lessonQuizAttempts),
  posts: many(posts),
  comments: many(comments),
  certifications: many(certifications),
  orders: many(orders),
  portfolioItems: many(userPortfolioItems),
  notifications: many(notifications, { relationName: 'notificationRecipient' }),
  sentNotifications: many(notifications, { relationName: 'notificationActor' }),
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
  aiConversations: many(aiConversations),
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

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, { fields: [notifications.tenantId], references: [tenants.id] }),
  recipient: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'notificationRecipient',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'notificationActor',
  }),
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
  products: many(productsBundle),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  tenant: one(tenants, { fields: [courses.tenantId], references: [tenants.id] }),
  academy: one(academies, { fields: [courses.academyId], references: [academies.id] }),
  series: many(series),
  enrollments: many(enrollments),
  certifications: many(certifications),
  products: many(productsBundle),
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
  course: one(courses, { fields: [series.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  series: one(series, { fields: [lessons.seriesId], references: [series.id] }),
  lessonProgress: many(lessonProgress),
  quizAttempts: many(lessonQuizAttempts),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [lessonProgress.lessonId], references: [lessons.id] }),
}));

export const lessonQuizAttemptsRelations = relations(lessonQuizAttempts, ({ one }) => ({
  user: one(users, { fields: [lessonQuizAttempts.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [lessonQuizAttempts.lessonId], references: [lessons.id] }),
  tenant: one(tenants, { fields: [lessonQuizAttempts.tenantId], references: [tenants.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  votes: many(postVotes),
  comments: many(comments),
  postTags: many(postTags),
}));

export const postVotesRelations = relations(postVotes, ({ one }) => ({
  post: one(posts, { fields: [postVotes.postId], references: [posts.id] }),
  user: one(users, { fields: [postVotes.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  // Self-reference for the thread. Kept explicit rather than inferred so the
  // shape a service gets is obvious at the call site.
  parent: one(comments, { fields: [comments.parentId], references: [comments.id], relationName: 'commentReplies' }),
  replies: many(comments, { relationName: 'commentReplies' }),
  votes: many(commentVotes),
}));

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, { fields: [commentVotes.commentId], references: [comments.id] }),
  user: one(users, { fields: [commentVotes.userId], references: [users.id] }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  tenant: one(tenants, { fields: [tags.tenantId], references: [tenants.id] }),
  posts: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const productsRelations = relations(productsBundle, ({ one, many }) => ({
  variants: many(productVariants),
  academy: one(academies, { fields: [productsBundle.academyId], references: [academies.id] }),
  course: one(courses, { fields: [productsBundle.courseId], references: [courses.id] }),
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

export const financeBudgetsRelations = relations(financeBudgets, ({ one }) => ({
  tenant: one(tenants, { fields: [financeBudgets.tenantId], references: [tenants.id] }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  user: one(users, { fields: [aiConversations.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [aiConversations.tenantId], references: [tenants.id] }),
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one, many }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
  user: one(users, { fields: [aiMessages.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [aiMessages.tenantId], references: [tenants.id] }),
  feedback: many(aiFeedback),
}));

export const aiWebSearchConfigsRelations = relations(aiWebSearchConfigs, ({ one }) => ({
  tenant: one(tenants, { fields: [aiWebSearchConfigs.tenantId], references: [tenants.id] }),
}));

export const aiWebSearchCacheRelations = relations(aiWebSearchCache, ({ one }) => ({
  tenant: one(tenants, { fields: [aiWebSearchCache.tenantId], references: [tenants.id] }),
}));

export const aiFeedbackRelations = relations(aiFeedback, ({ one }) => ({
  tenant: one(tenants, { fields: [aiFeedback.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [aiFeedback.userId], references: [users.id] }),
  conversation: one(aiConversations, {
    fields: [aiFeedback.conversationId],
    references: [aiConversations.id],
  }),
  message: one(aiMessages, { fields: [aiFeedback.messageId], references: [aiMessages.id] }),
}));

export const aiEvalCasesRelations = relations(aiEvalCases, ({ one }) => ({
  tenant: one(tenants, { fields: [aiEvalCases.tenantId], references: [tenants.id] }),
}));

export const aiEvalRunsRelations = relations(aiEvalRuns, ({ one }) => ({
  tenant: one(tenants, { fields: [aiEvalRuns.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [aiEvalRuns.createdBy], references: [users.id] }),
}));
