import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { aiEvalCases, aiEvalRuns } from '../../database/schema/ai-learning';
import { AiChatService, type AiSourceRefInput } from './ai-chat.service';
import { AiFeedbackService } from './ai-feedback.service';
import type { AiChatMode } from './dto/ai.dto';
import { AI_PROMPT_VERSION } from './ai.types';

export interface AiEvalCaseInput {
  slug: string;
  question: string;
  mode?: AiChatMode;
  expectKeywords?: string[];
  forbidKeywords?: string[];
  minCitations?: number;
  expectRefusal?: boolean;
  expectWeb?: boolean;
  sourceRef?: Record<string, unknown> | null;
  enabled?: boolean;
}

export interface AiEvalCaseResult {
  slug: string;
  passed: boolean;
  score: number;
  citations: number;
  usedWeb: boolean;
  latencyMs: number;
  missingKeywords: string[];
  leakedKeywords: string[];
  refused: boolean;
  answer: string;
  error?: string;
}

export interface AiEvalRunSummary {
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
  createdAt: Date;
}

const REFUSAL_MARKERS = [
  'cannot verify',
  'not documented',
  'do not have',
  "don't have",
  'no information',
  'unavailable',
  'unable to verify',
  'not in the provided',
  'insufficient',
  'unknown',
  'لا يمكن التحقق',
  'غير متوفر',
  'لا تتوفر',
];

/**
 * Scores the assistant against a fixed case set.
 *
 * This exists because the alternative is guessing. Changing a prompt, swapping a
 * model or enabling web search is only safe if the same questions can be asked
 * before and after and the answers compared. Groundedness here is a proxy —
 * keyword and citation coverage, not a trained judge — which is enough to catch
 * the regressions that actually bite: an answer that stopped citing, started
 * inventing, or quietly stopped refusing.
 */
@Injectable()
export class AiEvalService {
  private readonly logger = new Logger(AiEvalService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly chat: AiChatService,
    private readonly feedback: AiFeedbackService,
  ) {}

  async listCases(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.drizzle.db
      .select()
      .from(aiEvalCases)
      .where(eq(aiEvalCases.tenantId, tenantId))
      .orderBy(desc(aiEvalCases.updatedAt));
  }

  async upsertCase(tenantId: string, input: AiEvalCaseInput): Promise<{ id: string }> {
    const existing = await this.drizzle.db
      .select({ id: aiEvalCases.id })
      .from(aiEvalCases)
      .where(and(eq(aiEvalCases.tenantId, tenantId), eq(aiEvalCases.slug, input.slug)))
      .limit(1);

    const values = {
      tenantId,
      slug: input.slug,
      question: input.question,
      mode: (input.mode ?? 'general') as string,
      expectKeywords: input.expectKeywords ?? [],
      forbidKeywords: input.forbidKeywords ?? [],
      minCitations: Math.min(Math.max(Number(input.minCitations ?? 0), 0), 20),
      expectRefusal: Boolean(input.expectRefusal),
      expectWeb: Boolean(input.expectWeb),
      sourceRef: input.sourceRef ?? null,
      enabled: input.enabled ?? true,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      await this.drizzle.db.update(aiEvalCases).set(values).where(eq(aiEvalCases.id, existing[0].id));
      return { id: existing[0].id };
    }
    const [created] = await this.drizzle.db.insert(aiEvalCases).values(values).returning({ id: aiEvalCases.id });
    return { id: created!.id };
  }

  async deleteCase(tenantId: string, id: string): Promise<void> {
    await this.drizzle.db
      .delete(aiEvalCases)
      .where(and(eq(aiEvalCases.id, id), eq(aiEvalCases.tenantId, tenantId)));
  }

  async listRuns(tenantId: string, limit = 10): Promise<AiEvalRunSummary[]> {
    const rows = await this.drizzle.db
      .select()
      .from(aiEvalRuns)
      .where(eq(aiEvalRuns.tenantId, tenantId))
      .orderBy(desc(aiEvalRuns.createdAt))
      .limit(Math.min(Math.max(limit, 1), 50));
    return rows as unknown as AiEvalRunSummary[];
  }

  /**
   * Run every enabled case and store the result. Answers are requested with
   * `persist: false` semantics by passing no conversation id, so an eval never
   * pollutes a member's real history.
   */
  async run(
    tenantId: string,
    label: string,
    options: { userId?: string; limit?: number } = {},
  ): Promise<AiEvalRunSummary> {
    const started = Date.now();
    const cases = (await this.drizzle.db
      .select()
      .from(aiEvalCases)
      .where(and(eq(aiEvalCases.tenantId, tenantId), eq(aiEvalCases.enabled, true)))
      .limit(Math.min(Math.max(options.limit ?? 25, 1), 100))) as unknown as Array<{
      slug: string;
      question: string;
      mode: string;
      expectKeywords: string[] | null;
      forbidKeywords: string[] | null;
      minCitations: number;
      expectRefusal: boolean;
      expectWeb: boolean;
      sourceRef: Record<string, unknown> | null;
    }>;

    const results: AiEvalCaseResult[] = [];
    let model: string | null = null;
    let sawWeb = false;

    for (const testCase of cases) {
      const caseStarted = Date.now();
      try {
        // No conversation id is passed, so the turn is answered but never stored:
        // an eval must not appear in a member's real history.
        const outcome = await this.chat.chat(
          tenantId,
          {
            message: testCase.question,
            mode: (testCase.mode as AiChatMode) ?? 'general',
            sourceRef: (testCase.sourceRef as AiSourceRefInput | null) ?? null,
            history: [],
          },
          options.userId ? { id: options.userId, tenantId } : null,
          {},
        );
        const latencyMs = Date.now() - caseStarted;
        const answer = String(outcome.answer ?? '');
        const citations = outcome.citations?.length ?? 0;
        const usedWeb = outcome.usedWeb === true;
        if (outcome.mode) model = model ?? null;
        if (usedWeb) sawWeb = true;

        const lowered = answer.toLowerCase();
        const missingKeywords = (testCase.expectKeywords ?? []).filter(
          (word) => !lowered.includes(String(word).toLowerCase()),
        );
        const leakedKeywords = (testCase.forbidKeywords ?? []).filter((word) =>
          lowered.includes(String(word).toLowerCase()),
        );
        const refused = REFUSAL_MARKERS.some((marker) => lowered.includes(marker));

        const checks: boolean[] = [];
        if (missingKeywords.length === 0) checks.push(true);
        if (leakedKeywords.length === 0) checks.push(true);
        if (citations >= (testCase.minCitations ?? 0)) checks.push(true);
        if (testCase.expectRefusal) checks.push(refused);
        else if (testCase.expectWeb) checks.push(usedWeb);
        else checks.push(!refused);

        results.push({
          slug: testCase.slug,
          passed: checks.every(Boolean),
          score: Number((checks.filter(Boolean).length / Math.max(checks.length, 1)).toFixed(4)),
          citations,
          usedWeb,
          latencyMs,
          missingKeywords,
          leakedKeywords,
          refused,
          answer: answer.slice(0, 800),
        });
      } catch (error) {
        results.push({
          slug: testCase.slug,
          passed: false,
          score: 0,
          citations: 0,
          usedWeb: false,
          latencyMs: Date.now() - caseStarted,
          missingKeywords: [],
          leakedKeywords: [],
          refused: false,
          answer: '',
          error: error instanceof Error ? error.message : 'run_failed',
        });
      }
    }

    const total = results.length;
    const passed = results.filter((row) => row.passed).length;
    const mean = (values: number[]) =>
      values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) : 0;
    const refusalCases = results.filter((row) =>
      cases.some((testCase) => testCase.slug === row.slug && testCase.expectRefusal),
    );
    const citationTargetMet = results.filter((row) => {
      const testCase = cases.find((entry) => entry.slug === row.slug);
      return testCase ? row.citations >= (testCase.minCitations ?? 0) : true;
    });

    const summary = {
      label: label.slice(0, 120),
      model,
      promptVersion: AI_PROMPT_VERSION,
      webEnabled: sawWeb,
      totalCases: total,
      passedCases: passed,
      score: mean(results.map((row) => row.score)),
      citationCoverage: total ? Number((citationTargetMet.length / total).toFixed(4)) : 0,
      groundedness: mean(results.map((row) => (row.missingKeywords.length === 0 && row.leakedKeywords.length === 0 ? 1 : 0))),
      refusalAccuracy: refusalCases.length
        ? Number((refusalCases.filter((row) => row.refused).length / refusalCases.length).toFixed(4))
        : 1,
      avgLatencyMs: total ? Math.round(results.reduce((sum, row) => sum + row.latencyMs, 0) / total) : 0,
      details: results,
    };

    const [created] = await this.drizzle.db
      .insert(aiEvalRuns)
      .values({
        tenantId,
        label: summary.label,
        model,
        promptVersion: summary.promptVersion,
        webEnabled: summary.webEnabled,
        totalCases: summary.totalCases,
        passedCases: summary.passedCases,
        score: summary.score,
        citationCoverage: summary.citationCoverage,
        groundedness: summary.groundedness,
        refusalAccuracy: summary.refusalAccuracy,
        avgLatencyMs: summary.avgLatencyMs,
        details: results,
        createdBy: options.userId ?? null,
      })
      .returning();

    this.logger.log(
      `Eval run "${summary.label}" for tenant ${tenantId}: ${passed}/${total} passed, score ${summary.score}, ${Date.now() - started}ms`,
    );
    return { ...summary, id: created!.id, createdAt: created!.createdAt } as AiEvalRunSummary;
  }

  /** Latest score plus the run before it, for a before/after read in the UI. */
  async latestComparison(tenantId: string): Promise<{
    current: AiEvalRunSummary | null;
    previous: AiEvalRunSummary | null;
    feedback: { total: number; score: number } | null;
  }> {
    const runs = await this.listRuns(tenantId, 2);
    const summary = await this.feedback.summary(tenantId);
    return {
      current: runs[0] ?? null,
      previous: runs[1] ?? null,
      feedback: { total: summary.total, score: summary.score },
    };
  }
}
