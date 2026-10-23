import { normalizeArabicText, sanitizeRetrievedText } from './ai-safety.service';
import type { AiLocale } from './ai.types';

export type AiSiteCatalogGroupKey = 'academies' | 'courses' | 'products' | 'events';

export interface AiSiteCatalogItem {
  title: string;
  href: string;
  meta?: string;
}

export interface AiSiteCatalogGroup {
  key: AiSiteCatalogGroupKey;
  href: string;
  total: number;
  items: AiSiteCatalogItem[];
}

export interface AiSiteCatalog {
  groups: AiSiteCatalogGroup[];
}

// Strong cues are unambiguous site navigation/inventory language. Weak words
// such as "product", "feed", "account", "support", and "verify" are common in
// machining questions ("product quality", "feed rate", "account for wear"), so
// they only count when paired with a site/owner cue below.
const SITE_INTENT_PATTERNS = [
  /\b(?:academ(?:y|ies)|courses?|lessons?|store|shop|buy|sell|prices?|pricing|checkout|cart|events?|community|titan\s*tv|certificates?|sign\s*up|signup|register|log\s*in|login|polic(?:y|ies)|refund|shipping|website|site|catalog(?:ue)?|browse)\b/iu,
  /\b(?:what|which)\s+(?:products?|courses?|events?|academies?|groups?)\b/iu,
  /\b(?:show|list|see|browse)\s+(?:me\s+)?(?:the\s+)?(?:products?|courses?|events?|academies?|groups?)\b/iu,
  /\b(?:do|does)\s+you\s+(?:sell|have|offer|stock|carry)\b/iu,
  /\bwhat\s+(?:do|can)\s+you\s+(?:offer|have|sell|stock|carry)\b/iu,
  /\b(?:your|our)\s+(?:products?|prices?|pricing|catalog|store|shop|site|platform|workspace|account|profile|feed|groups?)\b/iu,
  /\b(?:the|this)\s+(?:store|shop|site|platform|workspace|catalog)\b/iu,
  /\b(?:my|your)\s+(?:account|profile|cart|orders?)\b/iu,
  /\b(?:create|open|make|set\s+up)\s+(?:an?\s+)?account\b/iu,
  /\b(?:verify|check)\s+(?:a\s+)?certificate\b/iu,
  /\bcontact\s+(?:us|you|support)\b|\bsupport\s+(?:page|team|center)\b/iu,
  /\b(?:community|site|home)\s+feed\b/iu,
  /\b(?:community\s+groups?|groups?\s+(?:page|section|listing))\b/iu,
  /\bwhere\s+(?:can|do)\s+i\s+(?:learn|sign\s*up|get\s+started|browse)\b/iu,
  /\bwhat(?:['’]s| is)\s+available\s*\?*\s*$/iu,
  /\b(?:price|prices|pricing|cost)\s+(?:of|for)\s+(?:the\s+)?(?:products?|courses?|events?|academies?|items?)\b/iu,
];
const ARABIC_SITE_INTENT_PATTERNS = [
  /(?:اكاديم|دورات|دوره|كورس|دروس|درس|منتجات|متجر|ستور|شراء|اشتري|بيع|سعر|اسعار|فعاليات|فعاليه|مجتمع|شهاده|شهادات|تسجيل|اشتراك|سياسه|سياسات|استرجاع|شحن|الموقع|موقعكم|موقعنا|الالكتروني|منصه|مساحه العمل|تصفح|اقسام|قسم|سله|عربه|كيف اسجل|كيف اشترك|ماذا عندكم|ماذا لديكم|شو عندكم|شنو عندكم|وش عندكم|واش عندكم|عندكم)/u,
  /(?:حسابي|حسابك|انشاء حساب|انشئ حساب|انشي حساب|عمل حساب|اسوي حساب|سوي حساب|افتح حساب|تسجيل حساب|اعدادات الحساب|صفحه الحساب|حساب المستخدم)/u,
  /(?:دعم فني|فريق الدعم|صفحه الدعم|مركز الدعم|تواصل مع الدعم)/u,
  /(?:تواصل معنا|صفحه التواصل|بيانات التواصل)/u,
  /(?:مجموعات المجتمع|مجموعه المجتمع|صفحه المجموعات|مجموعاتي)/u,
  /(?:تكلفه\s+(?:ال)?(?:منتج|دوره|كورس|اشتراك|شحن))/u,
];

const SECTION_ORDER = [
  'home',
  'academies',
  'courses',
  'store',
  'events',
  'community',
  'groups',
  'learning',
  'titanTv',
  'myLearning',
  'search',
  'aiChat',
  'partners',
  'account',
  'cart',
  'signup',
  'login',
  'verify',
  'about',
  'privacy',
  'terms',
  'refunds',
] as const;

type SectionKey = (typeof SECTION_ORDER)[number];

const SECTION_HREFS: Record<SectionKey, string> = {
  home: '/',
  academies: '/academy',
  courses: '/courses',
  store: '/products',
  events: '/events',
  community: '/feed',
  groups: '/groups',
  learning: '/learn',
  titanTv: '/titan-tv',
  myLearning: '/learning',
  search: '/search',
  aiChat: '/ai/chat',
  partners: '/partners',
  account: '/account',
  cart: '/cart',
  signup: '/register',
  login: '/login',
  verify: '/verify',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
  refunds: '/refunds',
};

const SECTION_LABELS: Record<AiLocale, Record<SectionKey, string>> = {
  en: {
    home: 'Home',
    academies: 'Academies',
    courses: 'Courses',
    store: 'Store',
    events: 'Events',
    community: 'Community',
    groups: 'Groups',
    learning: 'Learning guides',
    titanTv: 'TITAN TV',
    myLearning: 'My learning',
    search: 'Search',
    aiChat: 'AI chat',
    partners: 'Partners',
    account: 'Account',
    cart: 'Cart',
    signup: 'Sign up',
    login: 'Sign in',
    verify: 'Verify a certificate',
    about: 'About',
    privacy: 'Privacy',
    terms: 'Terms',
    refunds: 'Refunds',
  },
  ar: {
    home: 'الرئيسية',
    academies: 'الأكاديميات',
    courses: 'الدورات',
    store: 'المتجر',
    events: 'الفعاليات',
    community: 'المجتمع',
    groups: 'المجموعات',
    learning: 'مسارات التعلم',
    titanTv: 'TITAN TV',
    myLearning: 'تعلّمي',
    search: 'البحث',
    aiChat: 'محادثة الذكاء الاصطناعي',
    partners: 'الشركاء',
    account: 'حسابي',
    cart: 'السلة',
    signup: 'إنشاء حساب',
    login: 'تسجيل الدخول',
    verify: 'التحقق من الشهادة',
    about: 'من نحن',
    privacy: 'الخصوصية',
    terms: 'الشروط',
    refunds: 'الاسترداد',
  },
};

const GROUP_LABELS: Record<AiLocale, Record<AiSiteCatalogGroupKey, string>> = {
  en: {
    academies: 'Academies',
    courses: 'Courses',
    products: 'Products',
    events: 'Upcoming events',
  },
  ar: {
    academies: 'الأكاديميات',
    courses: 'الدورات',
    products: 'المنتجات',
    events: 'الفعاليات القادمة',
  },
};

/**
 * Whether the question is about the site's own map/catalog rather than a
 * technical topic. This is intentionally broader than the entity words: "where
 * do I sign up?" and "do you sell end mills?" must be able to use the live
 * published directory even when no document matches.
 */
export function isSiteDirectoryQuestion(message: string): boolean {
  const normalized = normalizeArabicText(message);
  return (
    SITE_INTENT_PATTERNS.some((pattern) => pattern.test(message)) ||
    ARABIC_SITE_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function safeHref(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/';
  return value.slice(0, 500);
}

/**
 * Renders the live directory as a compact, prompt-safe block. Every title is
 * sanitised because it is workspace content, not an instruction. Links are
 * internal paths only; the model may repeat them but cannot turn the directory
 * into an external redirect.
 */
export function buildSiteDirectoryContext(catalog: AiSiteCatalog, locale: AiLocale): string {
  const ar = locale === 'ar';
  const labels = SECTION_LABELS[locale];
  const lines = [
    ar
      ? 'دليل الموقع الموثّق (عناصر منشورة فقط، محدّث عند الطلب):'
      : 'Verified site directory (published items only, refreshed per request):',
    `${ar ? 'الأقسام' : 'Sections'}: ${SECTION_ORDER.map(
      (key) => `${labels[key]} (${SECTION_HREFS[key]})`,
    ).join(' · ')}`,
  ];

  for (const group of catalog.groups) {
    const label = GROUP_LABELS[locale][group.key];
    const href = safeHref(group.href);
    if (group.total <= 0) {
      lines.push(`${label}: ${ar ? 'لا توجد عناصر منشورة حاليًا' : 'no published items yet'} (${href})`);
      continue;
    }
    lines.push(`${label} — ${group.total} ${ar ? 'منشور' : 'published'} (${href}):`);
    for (const item of group.items) {
      const title = sanitizeRetrievedText(item.title, 300) || (ar ? 'بدون عنوان' : 'Untitled');
      const meta = item.meta ? ` — ${sanitizeRetrievedText(item.meta, 240)}` : '';
      lines.push(`- ${title} — ${safeHref(item.href)}${meta}`);
    }
    const remaining = group.total - group.items.length;
    if (remaining > 0) {
      lines.push(ar ? `- و${remaining} أخرى — افتح رابط القسم` : `- ${remaining} more — open the section link`);
    }
  }

  return lines.join('\n');
}
