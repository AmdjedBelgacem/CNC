import { AI_REFUSAL_NO_CONTEXT, AI_REFUSAL_NO_CONTEXT_AR, normalizeArabicText } from './ai-safety.service';
import type { AiArabicDialect, AiLocale } from './ai.types';

type ConcreteDialect = Exclude<AiArabicDialect, 'auto'>;

/**
 * Words such as "شلون" and "شنو" are shared by more than one dialect. They
 * intentionally appear in every set they belong to, so a sentence with only
 * shared markers resolves to `auto` and lets the model mirror the user instead
 * of confidently guessing the wrong region.
 */
const TOKEN_CUES: Record<Exclude<ConcreteDialect, 'msa'>, readonly string[]> = {
  egyptian: [
    'ازيك', 'ازايك', 'عايز', 'عايزه', 'عاوز', 'مش', 'ايه', 'كده', 'كدا',
    'خالص', 'دلوقتي', 'ازاي', 'بتاع', 'جامد', 'مفيش', 'ليه', 'فين', 'عشان',
    'كمان',
  ],
  gulf: [
    'شنو', 'شلون', 'وش', 'وشلون', 'الحين', 'ابغى', 'ابغي', 'حيل', 'وياك',
    'شكثر', 'يبه', 'عساك', 'ترى', 'مو', 'فين', 'عشان', 'ليش',
  ],
  levantine: [
    'شو', 'هلق', 'بدي', 'منيح', 'كتير', 'ليش', 'عنجد', 'هيك', 'شوي',
    'كمان', 'منشان', 'بحب', 'كيفك', 'فين', 'مش', 'مو',
  ],
  maghrebi: [
    'واش', 'بغيت', 'دابا', 'مزيان', 'بزاف', 'كيفاش', 'بصح', 'ديال', 'نتا',
    'نتي', 'برشا', 'علاش', 'قداش', 'نجمو', 'نحب', 'كاين', 'ياخي', 'شنو',
    'فين',
  ],
  iraqi: [
    'شنو', 'شلون', 'هسه', 'هوايه', 'ماكو', 'اكو', 'شكو', 'چان', 'چي',
    'گاعد', 'گلت', 'هذني', 'هاي', 'عبالك', 'خوش', 'مو', 'هيك',
  ],
};

/**
 * A dialect name alone ("the Egyptian dialect") is not a request to use it.
 * These patterns require an explicit instruction: "reply in Gulf Arabic",
 * "reply in Gulf Arabic", "تكلم بالمصري", or "باللهجة الشامية". A superficial
 * "use" plus "Gulf" in a sentence about a Gulf course must not switch language.
 */
const DIRECT_DIALECT_REQUESTS: Array<{ dialect: ConcreteDialect; pattern: RegExp }> = [
  { dialect: 'msa', pattern: /(?:^|\s)بالفصحي(?:ه)?(?=\s|$)/u },
  { dialect: 'egyptian', pattern: /(?:^|\s)بالمصري(?:ه)?(?=\s|$)/u },
  { dialect: 'gulf', pattern: /(?:^|\s)بالخليجي(?:ه)?(?=\s|$)/u },
  { dialect: 'levantine', pattern: /(?:^|\s)بالشامي(?:ه)?(?=\s|$)/u },
  { dialect: 'maghrebi', pattern: /(?:^|\s)بالمغربي(?:ه)?(?=\s|$)/u },
  { dialect: 'iraqi', pattern: /(?:^|\s)بالعراقي(?:ه)?(?=\s|$)/u },
  { dialect: 'msa', pattern: /(?:^|\s)بال(?:لهجه|عاميه|عربي)\s+(?:الفصحي|الفصحه)(?=\s|$)/u },
  { dialect: 'egyptian', pattern: /(?:^|\s)بال(?:لهجه|عاميه|عربي)\s+المصري(?:ه)?(?=\s|$)/u },
  { dialect: 'gulf', pattern: /(?:^|\s)بال(?:لهجه|عاميه|عربي)\s+الخليجي(?:ه)?(?=\s|$)/u },
  { dialect: 'levantine', pattern: /(?:^|\s)بال(?:لهجه|عاميه|عربي)\s+الشامي(?:ه)?(?=\s|$)/u },
  { dialect: 'maghrebi', pattern: /(?:^|\s)بال(?:لهجه|عاميه|عربي)\s+المغربي(?:ه)?(?=\s|$)/u },
  { dialect: 'iraqi', pattern: /(?:^|\s)بال(?:لهجه|عاميه|عربي)\s+العراقي(?:ه)?(?=\s|$)/u },
  {
    dialect: 'msa',
    pattern: /(?:تكلم|تحدث|اتكلم|كلمني|احكيلي|جاوبني|رد علي|رد عليا)\s+(?:معايا\s+)?(?:ب|في\s+)?(?:ال)?(?:فصحي|فصحه)(?=\s|$)/u,
  },
  {
    dialect: 'egyptian',
    pattern: /(?:تكلم|تحدث|اتكلم|كلمني|احكيلي|جاوبني|رد علي|رد عليا)\s+(?:معايا\s+)?(?:ب|في\s+)?(?:ال)?مصري(?:ه)?(?=\s|$)/u,
  },
  {
    dialect: 'gulf',
    pattern: /(?:تكلم|تحدث|اتكلم|كلمني|احكيلي|جاوبني|رد علي|رد عليا)\s+(?:معايا\s+)?(?:ب|في\s+)?(?:ال)?خليجي(?:ه)?(?=\s|$)/u,
  },
  {
    dialect: 'levantine',
    pattern: /(?:تكلم|تحدث|اتكلم|كلمني|احكيلي|جاوبني|رد علي|رد عليا)\s+(?:معايا\s+)?(?:ب|في\s+)?(?:ال)?شامي(?:ه)?(?=\s|$)/u,
  },
  {
    dialect: 'maghrebi',
    pattern: /(?:تكلم|تحدث|اتكلم|كلمني|احكيلي|جاوبني|رد علي|رد عليا)\s+(?:معايا\s+)?(?:ب|في\s+)?(?:ال)?مغربي(?:ه)?(?=\s|$)/u,
  },
  {
    dialect: 'iraqi',
    pattern: /(?:تكلم|تحدث|اتكلم|كلمني|احكيلي|جاوبني|رد علي|رد عليا)\s+(?:معايا\s+)?(?:ب|في\s+)?(?:ال)?عراقي(?:ه)?(?=\s|$)/u,
  },
  {
    dialect: 'msa',
    pattern: /\b(?:speak|talk|reply|respond|answer|write)\s+(?:to me\s+)?(?:(?:in|with)\s+)?(?:the\s+)?(?:modern standard|standard|msa)(?:\s+arabic)?\b/u,
  },
  {
    dialect: 'egyptian',
    pattern: /\b(?:speak|talk|reply|respond|answer|write)\s+(?:to me\s+)?(?:(?:in|with)\s+)?(?:the\s+)?egyptian(?:\s+(?:arabic|dialect))?\b/u,
  },
  {
    dialect: 'gulf',
    pattern: /\b(?:speak|talk|reply|respond|answer|write)\s+(?:to me\s+)?(?:(?:in|with)\s+)?(?:the\s+)?(?:gulf|khaleeji)(?:\s+(?:arabic|dialect))?\b/u,
  },
  {
    dialect: 'levantine',
    pattern: /\b(?:speak|talk|reply|respond|answer|write)\s+(?:to me\s+)?(?:(?:in|with)\s+)?(?:the\s+)?(?:levantine|shami|syrian|lebanese|jordanian|palestinian)(?:\s+(?:arabic|dialect))?\b/u,
  },
  {
    dialect: 'maghrebi',
    pattern: /\b(?:speak|talk|reply|respond|answer|write)\s+(?:to me\s+)?(?:(?:in|with)\s+)?(?:the\s+)?(?:maghrebi|moroccan|darija)(?:\s+(?:arabic|dialect))?\b/u,
  },
  {
    dialect: 'iraqi',
    pattern: /\b(?:speak|talk|reply|respond|answer|write)\s+(?:to me\s+)?(?:(?:in|with)\s+)?(?:the\s+)?iraqi(?:\s+(?:arabic|dialect))?\b/u,
  },
  {
    dialect: 'msa',
    pattern: /\b(?:use|in)\s+(?:the\s+)?(?:modern standard|standard|msa)\s+(?:arabic|dialect)\b/u,
  },
  {
    dialect: 'egyptian',
    pattern: /\b(?:use|in)\s+(?:the\s+)?egyptian\s+(?:arabic|dialect)\b/u,
  },
  {
    dialect: 'gulf',
    pattern: /\b(?:use|in)\s+(?:the\s+)?(?:gulf|khaleeji)\s+(?:arabic|dialect)\b/u,
  },
  {
    dialect: 'levantine',
    pattern: /\b(?:use|in)\s+(?:the\s+)?(?:levantine|shami)\s+(?:arabic|dialect)\b/u,
  },
  {
    dialect: 'maghrebi',
    pattern: /\b(?:use|in)\s+(?:the\s+)?(?:maghrebi|moroccan|darija)\s+(?:arabic|dialect)\b/u,
  },
  {
    dialect: 'iraqi',
    pattern: /\b(?:use|in)\s+(?:the\s+)?iraqi\s+(?:arabic|dialect)\b/u,
  },
];

function hasCue(tokens: string[], cue: string): boolean {
  return tokens.some((token) => token === cue || (cue.length >= 4 && token.startsWith(cue)));
}

export function detectExplicitDialectRequest(value: string): ConcreteDialect | null {
  const normalized = normalizeArabicText(value).trim();
  if (!normalized) return null;
  for (const entry of DIRECT_DIALECT_REQUESTS) {
    if (entry.pattern.test(normalized)) return entry.dialect;
  }
  return null;
}

/**
 * Detects the dialect the member is writing in.
 *
 * This is deliberately a hint, not a verdict: the model sees the actual
 * message too. `auto` is returned for a genuine tie between dialects (mostly
 * shared Gulf/Iraqi words) so the prompt can ask the model to mirror the user
 * rather than naming a region the text does not prove.
 */
export function detectArabicDialect(value: string): AiArabicDialect {
  const explicit = detectExplicitDialectRequest(value);
  if (explicit) return explicit;
  const normalized = normalizeArabicText(value).trim();
  if (!normalized) return 'msa';

  const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const ranked = (Object.entries(TOKEN_CUES) as Array<[Exclude<ConcreteDialect, 'msa'>, readonly string[]]>)
    .map(([dialect, cues]) => ({
      dialect,
      score: cues.filter((cue) => hasCue(tokens, cue)).length,
    }))
    .sort((left, right) => right.score - left.score);

  const topScore = ranked[0]?.score ?? 0;
  if (topScore <= 0) return 'msa';
  const leaders = ranked.filter((entry) => entry.score === topScore);
  return leaders.length === 1 ? leaders[0]!.dialect : 'auto';
}

/**
 * Resolves an explicit request in the current message first, then the saved
 * picker preference, then dialect markers. A member who chose Gulf keeps it
 * across neutral turns; saying "reply in Egyptian" in the message still wins.
 */
export function resolveArabicDialect(
  requested: AiArabicDialect | undefined,
  message: string,
): AiArabicDialect {
  const explicit = detectExplicitDialectRequest(message);
  if (explicit) return explicit;
  if (requested && requested !== 'auto') return requested;
  return detectArabicDialect(message);
}

export function buildDialectInstruction(dialect: AiArabicDialect): string {
  if (dialect === 'auto') {
    return 'Match the Arabic dialect used in the user\'s message (for example Egyptian, Gulf, Levantine, Maghrebi, or Iraqi). If the user writes Modern Standard Arabic, reply in Modern Standard Arabic. If the dialect is mixed or unclear, use the closest natural Arabic dialect rather than switching to English.';
  }
  if (dialect === 'egyptian') {
    return 'Use natural Egyptian Arabic (اللهجة المصرية العامية) as spoken in Cairo. Prefer Egyptian vocabulary and grammar such as إيه، ازاي، عايز، دلوقتي instead of their Modern Standard Arabic equivalents.';
  }
  if (dialect === 'gulf') {
    return 'Use natural Gulf Arabic (اللهجة الخليجية). Prefer vocabulary such as شنو، وين، شلون، أبغى، الحين instead of their Modern Standard Arabic equivalents.';
  }
  if (dialect === 'levantine') {
    return 'Use natural Levantine Arabic (اللهجة الشامية). Prefer vocabulary such as شو، كيف، بدي، هلق، منيح instead of their Modern Standard Arabic equivalents.';
  }
  if (dialect === 'maghrebi') {
    return 'Use natural Maghrebi Arabic (الدارجة المغربية/اللهجة المغاربية). Prefer vocabulary such as واش، كيفاش، بغيت، دابا، مزيان and avoid Eastern-Arabic dialect markers.';
  }
  if (dialect === 'iraqi') {
    return 'Use natural Iraqi Arabic (اللهجة العراقية). Prefer vocabulary such as شنو، شلون، هسة، أكو، ماكو instead of their Modern Standard Arabic equivalents.';
  }
  return 'Use Modern Standard Arabic (العربية الفصحى) in a clear, natural register.';
}

export function noContextRefusal(locale: AiLocale, dialect: AiArabicDialect): string {
  if (locale === 'en') return AI_REFUSAL_NO_CONTEXT;
  if (dialect === 'egyptian') {
    return 'معنديش معلومات موثّقة كافية في مساحة العمل عشان أجاوب على السؤال ده.';
  }
  if (dialect === 'gulf') {
    return 'ما عندي معلومات موثّقة كافية في مساحة العمل عشان أجاوب على هالسؤال.';
  }
  if (dialect === 'levantine') {
    return 'ما عندي معلومات موثّقة كافية بمساحة العمل لأجاوب على هالسؤال.';
  }
  if (dialect === 'maghrebi') {
    return 'ما عنديش معلومات موثّقة كافية فمساحة العمل باش نجاوب على هاد السؤال.';
  }
  if (dialect === 'iraqi') {
    return 'ما عندي معلومات موثّقة كافية بمساحة العمل حتى أجاوب على هذا السؤال.';
  }
  return AI_REFUSAL_NO_CONTEXT_AR;
}
