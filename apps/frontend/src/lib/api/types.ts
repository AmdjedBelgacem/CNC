import type {
  ContentLocale,
  CurrencyCode,
  CourseContentTranslation,
  LessonContentDocument,
  LessonContentTranslation,
  LessonLocaleMetadata,
  SeriesContentTranslation,
} from '@titan/shared';

/**
 * Response shapes for the TITANS backend.
 *
 * These mirror the Drizzle schema / controller return values rather than being
 * invented, so a field that is missing here is genuinely missing from the API.
 * Everything is `| null | undefined` tolerant because several endpoints return
 * partial rows (list vs detail) and the UI must degrade instead of crashing.
 */

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  content?: string | null;
  contentBlocks?: LessonContentDocument | null;
  translations?: Partial<Record<ContentLocale, LessonContentTranslation>> | null;
  locale?: ContentLocale;
  resolvedLocale?: ContentLocale;
  availableLocales?: ContentLocale[];
  fallbackFields?: string[];
  localeMetadata?: LessonLocaleMetadata | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  videoDuration?: number | null;
  /** Lesson resources — downloads and links shown under every lesson. */
  attachments?: Attachment[] | null;
  freePreview?: boolean;
  sortOrder?: number;
  isPublished?: boolean;
  seriesId?: string;
  videoMeta?: { key: string; size: number; contentType: string; filename: string } | null;
}

export interface Series {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  sortOrder?: number;
  translations?: Partial<Record<ContentLocale, SeriesContentTranslation>> | null;
  locale?: ContentLocale;
  resolvedLocale?: ContentLocale;
  availableLocales?: ContentLocale[];
  fallbackFields?: string[];
  lessons?: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  difficulty?: number | null;
  estimatedHours?: number | null;
  priceCents?: number | null;
  currency?: string | null;
  accessMode?: string | null;
  trailerUrl?: string | null;
  translations?: Partial<Record<ContentLocale, CourseContentTranslation>> | null;
  locale?: ContentLocale;
  resolvedLocale?: ContentLocale;
  availableLocales?: ContentLocale[];
  fallbackFields?: string[];
  localeMetadata?: LessonLocaleMetadata | null;
  academyId?: string | null;
  isPublished?: boolean;
  series?: Series[];
  academy?: Academy | null;
}

export interface FxRates {
  base: CurrencyCode;
  rates: Record<string, number>;
  currencies: CurrencyCode[];
  source: 'live' | 'fallback';
  updatedAt: string;
  stale: boolean;
}

export interface Academy {
  id: string;
  slug: string;
  /** Backend column is `title` (see `AcademySummary` in @titan/shared), NOT `name`.
   *  Typing this as `name` silently rendered every academy chip and search result
   *  with an empty label. */
  title: string;
  description?: string | null;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  category?: string | null;
  courses?: Course[];
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  features?: string[] | null;
  thumbnailUrl?: string | null;
  mediaUrls?: string[] | null;
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string | null;
  trackInventory?: boolean;
  inventory?: number | null;
  allowBackorder?: boolean;
  backorderLeadDays?: number | null;
  isDigital?: boolean;
  isPublished?: boolean;
  isArchived?: boolean;
  category?: string | null;
  tags?: string[] | null;
  featured?: boolean;
  sortOrder?: number | null;
  academyId?: string | null;
  courseId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  academy?: { id: string; title: string; slug: string } | null;
  course?: { id: string; title: string; slug: string } | null;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku?: string | null;
  price?: number | null;
  inventory?: number | null;
  allowBackorder?: boolean;
  options?: Record<string, string> | null;
}

export interface EventLocation {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  url?: string;
}

export interface AppEvent {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  eventType?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: EventLocation | null;
  isVirtual?: boolean;
  maxAttendees?: number | null;
  price?: number | null;
  thumbnailUrl?: string | null;
  isPublished?: boolean;
  attendeeCount?: number;
  isRegistered?: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
  href?: string | null;
  actionUrl?: string | null;
  category?: string | null;
  readAt?: string | null;
}

export type NotificationPreferenceCategory = 'social' | 'learning' | 'commerce' | 'security';

export interface NotificationPreferences {
  inAppNotifications: Record<NotificationPreferenceCategory, boolean>;
  emailNotifications: Record<NotificationPreferenceCategory, boolean>;
}

export interface FeedAuthor {
  id: string;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  headline?: string | null;
  /** Drives the badge next to a member's name. */
  role?: string | null;
}

export interface FeedTag {
  id?: string;
  slug: string;
  label: string;
  usageCount?: number;
}

export interface FeedPost {
  id: string;
  content: string;
  mediaUrls?: string[] | null;
  isPublic?: boolean;
  createdAt?: string;
  author?: FeedAuthor | null;
  userId?: string;
  /** Upvotes minus downvotes. */
  score: number;
  upvotes: number;
  downvotes: number;
  voteCount: number;
  /** 1, -1, or 0 when the viewer has not voted. */
  myVote: number;
  commentCount: number;
  /** Normalized tags, the only tag source the app reads. */
  tags: FeedTag[];
}

export interface FeedComment {
  id: string;
  content: string;
  createdAt?: string;
  author?: FeedAuthor | null;
  userId?: string;
  parentId?: string | null;
  depth: number;
  score: number;
  myVote: number;
  /** Soft-deleted: the slot stays, the body and author are withheld. */
  isRemoved: boolean;
  editedAt?: string | null;
  replies: FeedComment[];
}

/** Public profile returned by `GET /social/profile/:userId`. */
export interface Profile {
  id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  location: string | null;
  portfolioEnabled: boolean;
  language: string | null;
  timezone: string | null;
  accountStatus: string;
  isVerified: boolean;
  verifiedAt?: string | null;
  /** Only elevated roles are surfaced; a plain student is null. */
  role: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  links: { website: string | null; github: string | null; linkedin: string | null };
  company: string | null;
  skills: string[];
  isPrivate: boolean;
  isSelf: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  stats: ProfileStats;
  learning: ProfileLearning;
  portfolioItems: PortfolioItem[];
}

export interface ProfileStats {
  followers: number;
  following: number;
  posts: number;
  likes: number;
  comments: number;
}

export interface ProfileLearning {
  enrollments: number;
  completed: number;
  certificates: number;
  lessonsCompleted: number;
  watchTimeSeconds: number;
  quizAttempts: number;
}

export interface PortfolioItem {
  id: string;
  userId?: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  projectUrl: string | null;
  tags: string[] | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileCourse {
  id: string;
  courseId: string;
  status: string | null;
  startedAt: string | null;
  completedAt: string | null;
  certificateId: string | null;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  watchTimeSeconds: number;
  course: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    thumbnailUrl: string | null;
    difficulty: number | null;
    estimatedHours: number | null;
    trailerUrl: string | null;
  } | null;
}

export interface ProfileCertificate {
  id: string;
  certificateNumber: string;
  courseId: string;
  issuedAt: string;
  expiresAt: string | null;
  pdfUrl: string | null;
  revokedAt: string | null;
  course: { id: string; slug: string; title: string } | null;
}

export interface ProfileLearningRecord {
  enrollments: ProfileCourse[];
  certificates: ProfileCertificate[];
}

export interface ProfileConnection {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  followedAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId?: string;
  progress?: number;
  completed?: boolean;
  enrolledAt?: string;
  lastAccessedAt?: string;
  course?: Course;
}

export interface CourseProgress {
  enrollmentId?: string;
  courseId?: string;
  percent?: number;
  total?: number;
  completed?: number;
  completedLessonIds?: string[];
  progress?: number;
  completedLessons?: number;
  totalLessons?: number;
  lessons?: Record<string, { completed?: boolean; watchTimeSeconds?: number }>;
}

export interface PlaybackInfo {
  /** Signed, time-limited URL returned by the paywalled playback endpoint. */
  url?: string | null;
  lessonId?: string | null;
  playbackId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  provider?: string | null;
  signedUrl?: string | null;
}

export type SearchResultType =
  | 'course'
  | 'series'
  | 'lesson'
  | 'user'
  | 'product'
  | 'post'
  | 'event'
  | 'academy'
  | 'page'
  | 'order'
  | 'certificate';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl?: string | null;
  score?: number | null;
  meta?: Record<string, unknown> | null;
}

export type SearchResult = SearchResultItem;

export interface SearchResponse {
  query?: string;
  results?: SearchResultItem[];
  items?: SearchResultItem[];
  data?: SearchResponse | SearchResultItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  limit?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  nextPage?: number | null;
  counts?: Partial<Record<SearchResultType, number>>;
  types?: SearchResultType[];
  engine?: string | null;
}

export interface SearchResults extends SearchResponse {
  courses?: Course[];
  products?: Product[];
  posts?: FeedPost[];
  events?: AppEvent[];
  people?: FeedAuthor[];
  academies?: Academy[];
}

export interface AnalyticsOverview {
  totalUsers?: number;
  activeLearners?: number;
  enrollments?: number;
  revenue?: number;
  completionRate?: number;
  deltas?: Record<string, number>;
  series?: { date: string; value: number }[];
}

export interface AnalyticsSeries {
  points?: { date: string; value: number }[];
  total?: number;
}

export interface AnalyticsActivityItem {
  id?: string;
  action?: string;
  actor?: string;
  entity?: string;
  createdAt?: string;
}

export interface AnalyticsTrends {
  enrollments?: AnalyticsSeries;
  revenue?: AnalyticsSeries;
  signups?: AnalyticsSeries;
}

export interface AnalyticsBreakdowns {
  byCategory?: { label: string; value: number }[];
  byLevel?: { label: string; value: number }[];
}

export interface AnalyticsInsights {
  highlights?: string[];
  completionRate?: number;
  avgWatchTime?: number;
}

export interface TopCourse {
  id?: string;
  title?: string;
  slug?: string;
  enrollments?: number;
  revenue?: number;
  completionRate?: number;
}

/** Paginated envelope used by /feed and /events. */
export interface Paged<T> {
  items?: T[];
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

export type AiProviderName = 'openai-compatible';

export interface AiPublicConfig {
  enabled: boolean;
  publicEnabled: boolean;
  status: string;
}

export interface AiMaskedSettings {
  provider: AiProviderName;
  baseUrl: string;
  primaryModel: string;
  fallbackModel: string | null;
  enabled: boolean;
  publicEnabled: boolean;
  retrievalTopK: number;
  retrievalMinScore: number;
  maxContextChars: number;
  systemStyle: string | null;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  embeddingModel: string | null;
  embeddingBaseUrl: string | null;
  status: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  encryptionConfigured: boolean;
  lastTestedAt: string | null;
  lastErrorCode: string | null;
  lastIndexedAt: string | null;
  lastIndexDocuments: number;
  lastIndexChunks: number;
  lastIndexEmbeddedChunks: number;
  lastIndexError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AiCorpusStats {
  documents: number;
  chunks: number;
  embeddedChunks: number;
}

export interface AiAdminStatus extends AiMaskedSettings {
  corpus?: AiCorpusStats;
}

export interface AiSettingsUpdate {
  provider?: AiProviderName;
  baseUrl?: string;
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string | null;
  enabled?: boolean;
  publicEnabled?: boolean;
  retrievalTopK?: number;
  retrievalMinScore?: number;
  maxContextChars?: number;
  systemStyle?: string | null;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  embeddingModel?: string | null;
  embeddingBaseUrl?: string | null;
}

export interface AiLessonContext {
  courseId: string;
  lessonId: string;
}

export interface AiChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatCitation {
  sourceType: string;
  sourceId: string;
  title: string;
  href: string;
}

export type AiChatMode = 'general' | 'fact_check' | 'ask_post' | 'ask_lesson';
export type AiConversationSource = 'general' | 'lesson' | 'post' | 'admin_test';

/** What a conversation is grounded in. Always treated as untrusted DATA. */
export interface AiSourceRef {
  type: string;
  id: string;
  href?: string | null;
  title?: string | null;
  author?: string | null;
  excerpt?: string | null;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  source: string;
  sourceRef: AiSourceRef | null;
  status: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string | null;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: unknown[] | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiConversation extends AiConversationSummary {
  messages: AiMessage[];
}

export interface AiChatRequest {
  message: string;
  history?: AiChatHistoryItem[];
  conversationId?: string;
  pageContext?: AiLessonContext;
  locale?: 'en' | 'ar';
  mode?: AiChatMode;
  sourceRef?: AiSourceRef;
}

export interface AiChatResponse {
  requestId: string;
  answer: string;
  citations: AiChatCitation[];
  /** Present once the thread is persisted (authenticated chat). */
  conversationId?: string;
  mode?: AiChatMode;
  /** True only when external web evidence actually informed this answer. */
  usedWeb?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export type AiWebSearchProvider = 'brave' | 'tavily' | 'serper' | 'none';

export interface AiWebSearchSettings {
  provider: AiWebSearchProvider;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyConfigured: boolean;
  maxResults: number;
  timeoutMs: number;
  allowedDomains: string[];
  allowedModes: string[];
  cacheTtlSeconds: number;
  status: string;
  lastTestedAt: string | null;
  lastErrorCode: string | null;
}

export interface AiWebSearchSettingsUpdate {
  provider: AiWebSearchProvider;
  apiKey?: string;
  clearApiKey?: boolean;
  enabled?: boolean;
  maxResults?: number;
  timeoutMs?: number;
  allowedDomains?: string[];
  allowedModes?: string[];
  cacheTtlSeconds?: number;
}

export interface AiFeedbackSummary {
  total: number;
  helpful: number;
  unhelpful: number;
  score: number;
  webAnswered: number;
  webHelpfulRate: number | null;
}

export interface AiEvalCase {
  id: string;
  slug: string;
  question: string;
  mode: string;
  expectKeywords: string[];
  forbidKeywords: string[];
  minCitations: number;
  expectRefusal: boolean;
  expectWeb: boolean;
  enabled: boolean;
}

export interface AiEvalRun {
  id: string;
  label: string;
  model: string | null;
  promptVersion: string | null;
  webEnabled: boolean;
  totalCases: number;
  passedCases: number;
  score: number;
  citationCoverage: number;
  groundedness: number;
  refusalAccuracy: number;
  avgLatencyMs: number;
  createdAt: string;
}

export interface AiLearningSnapshot {
  current: AiEvalRun | null;
  previous: AiEvalRun | null;
  feedback: { total: number; score: number } | null;
}

export interface AiTestResponse {
  ok: true;
  latencyMs: number;
}
