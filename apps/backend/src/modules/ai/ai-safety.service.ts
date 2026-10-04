import { Injectable } from '@nestjs/common';
import type { AiChatHistoryItem, AiLocale } from './ai.types';

const INJECTION_PATTERNS = [
  /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier|system|developer)/i,
  /(?:system|developer)\s+(?:prompt|message|instructions?)/i,
  /(?:reveal|show|print|repeat|expose)\s+(?:the\s+)?(?:system|developer)?\s*(?:prompt|instructions?|secrets?|credentials?)/i,
  /\b(?:jailbreak|prompt injection|developer mode|do anything now|dan mode)\b/i,
  /(?:curl|wget)\s+https?:\/\//i,
  /(?:تجاهل|تجاهلي|انس|انسى)\s+(?:كل\s+)?(?:التعليمات|الإرشادات)\s+(?:السابقة|السابقه|الأعلى|العليا)/i,
  /(?:اظهر|أظهر|اكشف|كشف|كرر)\s+(?:ال)?(?:تعليمات|بيانات)\s+(?:النظام|النظامية|المطور|الأسرار)/i,
  /(?:كسر|تجاوز)\s+(?:الحماية|القيود|ضوابط)/i,
];

const OFF_POLICY_PATTERNS = [
  /\b(?:api[_ -]?key|password|passcode|secret|credential|access token|refresh token|bearer token|private key)\b/i,
  /\b(?:social security|ssn|credit card|card number|cvv|bank account)\b/i,
  /\b(?:malware|ransomware|credential stuffing|phishing|botnet|exploit kit)\b/i,
  /\b(?:bomb|explosive|bioweapon|chemical weapon|chemical weapon|weaponize)\b/i,
  /\b(?:self[- ]?harm|suicide method)\b/i,
  /(?:مفتاح\s+(?:ال)?(?:ـ)?api|كلمة\s+المرور|الرمز\s+السري|بيانات\s+الاعتماد|رمز\s+(?:الوصول|التجديد)|مفتاح\s+خاص)/i,
  /(?:بطاقة\s+ائتمان|رقم\s+البطاقة|رمز\s+التحقق|الحساب\s+البنكي)/i,
  /(?:برمجية\s+خبيثة|فدية|خداع\s+احتيالي|استغلال)/i,
  /(?:سلاح|متفجرات|أسلحة\s+بيولوجية|أسلحة\s+كيميائية)/i,
  /(?:إيذاء\s+النفس|انتحار)/i,
];

const URL_PATTERN = /https?:\/\/[^\s<>"'`)\]]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\d(). -]{7,}\d)(?!\w)/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const HTML_PATTERN = /<[^>]*>/g;
const SCRIPT_PATTERN = /(script|style|template|svg|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi;
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SECRET_ASSIGNMENT_PATTERN = /((?:api[_ -]?key|password|passcode|secret|token|authorization|bearer|مفتاح\s+(?:ال)?(?:ـ)?api|كلمة\s+المرور|الرمز\s+السري|رمز\s+الوصول|رمز\s+التجديد)\s*[:=]\s*)([^\s,;]+)/giu;
const PROVIDER_SECRET_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,})\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const OPAQUE_SECRET_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/g;
const ARABIC_DIACRITICS_PATTERN = /[\u064B-\u065F\u0670\u0640]/g;

export function normalizeArabicText(value: string): string {
  return value
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_PATTERN, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export const AI_REFUSAL_INJECTION = 'I can only help with questions grounded in this workspace’s published learning content.';
export const AI_REFUSAL_INJECTION_AR = 'يمكنني مساعدتك فقط في الأسئلة المرتبطة بمحتوى التعلّم المنشور في مساحة العمل هذه.';
export const AI_REFUSAL_OFF_POLICY = 'I can’t help with requests for secrets, private data, or instructions outside the assistant’s scope.';
export const AI_REFUSAL_OFF_POLICY_AR = 'لا أستطيع المساعدة في طلبات الأسرار أو البيانات الخاصة أو التعليمات خارج نطاق المساعد.';
export const AI_REFUSAL_NO_CONTEXT = 'I don’t have enough verified information in the workspace to answer that question.';
export const AI_REFUSAL_NO_CONTEXT_AR = 'لا تتوفر لديّ معلومات موثّقة كافية في مساحة العمل للإجابة عن هذا السؤال.';

export function sanitizePublicText(value: unknown, maxLength = 20000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_PATTERN, ' ')
    .replace(SCRIPT_PATTERN, ' ')
    .replace(HTML_PATTERN, ' ')
    .replace(URL_PATTERN, ' ')
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(PHONE_PATTERN, '[redacted-phone]')
    .replace(UUID_PATTERN, '[redacted-id]')
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1[redacted]')
    .replace(PROVIDER_SECRET_PATTERN, '[redacted-secret]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(OPAQUE_SECRET_PATTERN, '[redacted-secret]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeRetrievedText(value: unknown, maxLength = 20000): string {
  let output = sanitizePublicText(value, maxLength);
  for (const pattern of INJECTION_PATTERNS) output = output.replace(pattern, '[redacted instruction]');
  return output;
}

export function sanitizeUserText(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_PATTERN, ' ')
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1[redacted]')
    .replace(PROVIDER_SECRET_PATTERN, '[redacted-secret]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(OPAQUE_SECRET_PATTERN, '[redacted-secret]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function redactAssistantOutput(value: string, secrets: string[] = []): string {
  let output = value;
  for (const secret of secrets) {
    if (secret.length >= 8) output = output.split(secret).join('[redacted]');
  }
  return output
    .replace(PROVIDER_SECRET_PATTERN, '[redacted-secret]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(OPAQUE_SECRET_PATTERN, '[redacted-secret]')
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .slice(0, 20000);
}

@Injectable()
export class AiSafetyService {
  inspect(message: string, history: AiChatHistoryItem[] = [], locale: AiLocale = 'en'): { allowed: boolean; refusal: string; reason?: string } {
    const combined = normalizeArabicText([message, ...history.map((item) => item.content)].join('\n'));
    if (INJECTION_PATTERNS.some((pattern) => pattern.test(combined))) {
      return {
        allowed: false,
        refusal: locale === 'ar' ? AI_REFUSAL_INJECTION_AR : AI_REFUSAL_INJECTION,
        reason: 'prompt_injection',
      };
    }
    if (OFF_POLICY_PATTERNS.some((pattern) => pattern.test(combined))) {
      return {
        allowed: false,
        refusal: locale === 'ar' ? AI_REFUSAL_OFF_POLICY_AR : AI_REFUSAL_OFF_POLICY,
        reason: 'off_policy',
      };
    }
    return { allowed: true, refusal: '' };
  }

  sanitizeMessage(value: unknown): string {
    return sanitizeUserText(value);
  }

  sanitizeHistory(history: AiChatHistoryItem[] = []): AiChatHistoryItem[] {
    return history
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({ role: item.role, content: sanitizeUserText(item.content, 2000) }))
      .filter((item) => item.content.length > 0)
      .slice(-12);
  }
}
