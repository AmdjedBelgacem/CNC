'use client';

import { create } from 'zustand';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { readApiError } from '@/lib/api-error';
import { builderActions } from '../builder-actions';

/**
 * Conversation and run state for the AI builder.
 *
 * Lives in a module store, not in the panel, so closing the panel mid-build does not lose the
 * run: polling continues and the result still lands on the canvas. Conversations are kept per
 * page, because "make it darker" only means something next to the page it was said about.
 */

export interface AiStep {
  key: string;
  label: string;
  state: 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
}

export interface AiUsage {
  calls: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
}

export interface UserTurn {
  id: string;
  role: 'user';
  text: string;
  images: string[];
  codeChars: number;
  scope?: string;
}

export interface AssistantTurn {
  id: string;
  role: 'assistant';
  status: 'running' | 'done' | 'error';
  steps: AiStep[];
  reply?: string;
  intent?: 'edit' | 'build' | 'new_page' | 'answer';
  warnings?: string[];
  usage?: AiUsage;
  model?: string;
  error?: string;
  changed?: number;
  elapsedMs?: number;
  createdPage?: { slug: string; title: string };
  /** The layout this run replaced, for Undo. Absent when nothing was applied. */
  previous?: unknown;
  undone?: boolean;
  /** Set when the result could not be applied because a different page is open. */
  notApplied?: boolean;
}

export type Turn = UserTurn | AssistantTurn;

export interface RunInput {
  slug: string;
  text: string;
  images: string[];
  code: string;
  selectedId?: string;
  scope?: string;
  /** Read at the moment the result arrives, so a page switch mid-run is detected. */
  currentSlug: () => string;
}

interface ChatState {
  conversations: Record<string, Turn[]>;
  running: Record<string, boolean>;
  send: (input: RunInput) => Promise<void>;
  undo: (slug: string, turnId: string) => void;
  clear: (slug: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function patchTurn(slug: string, id: string, patch: Partial<AssistantTurn>) {
  useAiChat.setState((state) => ({
    conversations: {
      ...state.conversations,
      [slug]: (state.conversations[slug] ?? []).map((turn) =>
        turn.id === id && turn.role === 'assistant' ? { ...turn, ...patch } : turn,
      ),
    },
  }));
}

export const useAiChat = create<ChatState>((set, get) => ({
  conversations: {},
  running: {},

  async send(input) {
    const { slug } = input;
    if (get().running[slug]) return;
    const history = (get().conversations[slug] ?? [])
      .slice(-8)
      .map((turn) =>
        turn.role === 'user'
          ? { role: 'user' as const, content: turn.text.slice(0, 3500) }
          : { role: 'assistant' as const, content: (turn.reply ?? turn.error ?? '').slice(0, 3500) },
      )
      .filter((turn) => turn.content);

    const user: UserTurn = {
      id: uid(),
      role: 'user',
      text: input.text,
      images: input.images,
      codeChars: input.code.length,
      scope: input.scope,
    };
    const assistant: AssistantTurn = {
      id: uid(),
      role: 'assistant',
      status: 'running',
      steps: [{ key: 'start', label: 'Starting', state: 'running' }],
    };
    set((state) => ({
      running: { ...state.running, [slug]: true },
      conversations: { ...state.conversations, [slug]: [...(state.conversations[slug] ?? []), user, assistant] },
    }));

    try {
      const response = await apiProxyFetch('/api/proxy/builder/ai/runs', {
        method: 'POST',
        body: JSON.stringify({
          prompt: input.text,
          pageSlug: slug,
          layout: builderActions.current?.getLiveLayout() ?? undefined,
          selectedId: input.selectedId,
          images: input.images.length ? input.images : undefined,
          code: input.code.trim() ? input.code : undefined,
          history: history.length ? history : undefined,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, 'The AI builder could not start'));
      const { id } = (await response.json()) as { id: string };

      // Poll. Fast at first (plans land in a few seconds), then easing off for long builds.
      for (let attempt = 0; ; attempt += 1) {
        await sleep(attempt < 10 ? 900 : 1600);
        const poll = await apiProxyFetch(`/api/proxy/builder/ai/runs/${id}`);
        if (!poll.ok) throw new Error(await readApiError(poll, 'Lost track of the AI run'));
        const job = (await poll.json()) as {
          status: 'running' | 'done' | 'error';
          steps: AiStep[];
          error?: string;
          elapsedMs: number;
          result?: {
            intent: AssistantTurn['intent'];
            reply: string;
            layout?: unknown;
            createdPage?: { slug: string; title: string };
            changed: number;
            warnings: string[];
            usage: AiUsage;
            model: string;
          };
        };
        patchTurn(slug, assistant.id, { steps: job.steps, elapsedMs: job.elapsedMs });
        if (job.status === 'running') continue;
        if (job.status === 'error' || !job.result) throw new Error(job.error || 'The AI run failed');

        const result = job.result;
        let previous: unknown;
        let notApplied = false;
        if (result.layout) {
          if (input.currentSlug() === slug && builderActions.current) {
            previous = builderActions.current.applyAiLayout(result.layout);
          } else {
            notApplied = true;
          }
        }
        patchTurn(slug, assistant.id, {
          status: 'done',
          reply: result.reply,
          intent: result.intent,
          warnings: result.warnings,
          usage: result.usage,
          model: result.model,
          changed: result.changed,
          createdPage: result.createdPage,
          previous,
          notApplied,
        });
        break;
      }
    } catch (error) {
      patchTurn(slug, assistant.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'The AI run failed',
        steps: (get().conversations[slug]?.find((turn) => turn.id === assistant.id) as AssistantTurn | undefined)?.steps.map(
          (step) => (step.state === 'running' ? { ...step, state: 'error' as const } : step),
        ),
      });
    } finally {
      set((state) => ({ running: { ...state.running, [slug]: false } }));
    }
  },

  undo(slug, turnId) {
    const turn = get().conversations[slug]?.find((item) => item.id === turnId);
    if (!turn || turn.role !== 'assistant' || turn.previous === undefined || turn.undone) return;
    builderActions.current?.applyAiLayout(turn.previous);
    patchTurn(slug, turnId, { undone: true });
  },

  clear(slug) {
    set((state) => ({ conversations: { ...state.conversations, [slug]: [] } }));
  },
}));

/**
 * Downscales a picture in the browser before upload.
 *
 * Phone screenshots are routinely 3-6 MB; the vision model needs nowhere near that much detail
 * to read a layout, and the API body limit is 2 MB. 1600px wide JPEG keeps text legible.
 */
export async function prepareImage(file: Blob): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error('Use a PNG, JPEG, WebP or GIF picture');
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const maxHeight = 4000;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process pictures');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.86, 0.75, 0.62, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length < 850_000) return url;
  }
  throw new Error('That picture is too detailed to send; crop it to one section');
}
