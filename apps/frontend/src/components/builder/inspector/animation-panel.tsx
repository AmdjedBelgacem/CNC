'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { m, MotionConfig, useReducedMotion, type Variants } from 'framer-motion';
import { useGetPuck } from '@measured/puck';
import {
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Hand,
  Pause,
  Play,
  Repeat,
  Repeat2,
  RotateCcw,
  ScanEye,
  Sparkles,
  Timer,
  Waves,
  Workflow,
} from 'lucide-react';
import { create } from 'zustand';
import {
  findNodeById,
  NODE_ANIMATION_EASES,
  NODE_ANIMATION_HOVERS,
  NODE_ANIMATION_LOOPS,
  NODE_ANIMATION_PRESSES,
  NODE_ANIMATION_PROP_KEYS,
  NODE_ANIMATION_RANGES,
  NODE_ANIMATION_TYPES,
  type NodeAnimationRangeKey,
  type PageLayout,
} from '@titan/shared';
import { coerceLocale, dirFor } from '@/i18n/config';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  cascadeDelay,
  entranceCurve,
  entranceLength,
  entranceVariants,
  hoverTarget,
  isSpringEase,
  pressTarget,
  readNodeAnimation,
  type NodeEntrance,
} from '@/lib/builder/node-animation';
import { LoopLayer } from '@/components/builder/animation';
import { collectPreviewTargets, useAnimationPreview } from './animation-preview';
import { FieldRow, SegmentedControl, SelectControl, SliderControl, ToggleControl } from './controls';
import { useDebouncedValue } from './use-debounced-value';

/**
 * The inspector's Animation tab.
 *
 * Reads and writes the flat `anim*` props on the selected node. Start-state and spring props stay
 * unset until the admin moves them, so each slider shows the current preset's real value, and
 * picking another preset clears them rather than carrying stale numbers across.
 */

/** `fadeScale` is the same motion as `scaleIn`, so it stays valid but is not offered twice. */
const PICKER_TYPES = NODE_ANIMATION_TYPES.filter((type) => type !== 'fadeScale');
const START_STATE_KEYS = ['animDistance', 'animScale', 'animRotate', 'animBlur', 'animFromOpacity'];
const SPRING_KEYS = ['animStiffness', 'animDamping', 'animMass'];
const SPEEDS = [1, 0.5, 0.25];
const LONG_RUN_SECONDS = 1.5;
/** How long after the last edit the canvas replays, so a slider drag is not a stream of restarts. */
const LIVE_REPLAY_MS = 260;

const useAnimationClipboard = create<{
  value: Record<string, unknown> | null;
  set: (value: Record<string, unknown>) => void;
}>((set) => ({ value: null, set: (value) => set({ value }) }));

interface AnimationPanelProps {
  nodeId: string;
  props: Record<string, unknown>;
  hasSlots: boolean;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function AnimationPanel({ nodeId, props, hasSlots, onUpdate }: AnimationPanelProps) {
  const t = useTranslations('builder.animPanel');
  const dir = dirFor(coerceLocale(useLocale()));
  const getPuck = useGetPuck();
  const clipboard = useAnimationClipboard();
  const [liveCanvas, setLiveCanvas] = useState(true);

  const config = useMemo(() => readNodeAnimation(props), [props]);
  const entrance = config.entrance;
  const animSignature = useMemo(
    () => JSON.stringify(NODE_ANIMATION_PROP_KEYS.map((key) => props[key] ?? null)),
    [props],
  );
  const type = props.animType === 'fadeScale' ? 'scaleIn' : (props.animType ?? 'none');
  const cascades = Boolean(hasSlots && entrance && config.stagger > 0);

  const preview = useAnimationPreview();
  const playOnCanvas = () => {
    const data = getPuck().appState.data as unknown as PageLayout;
    const targets = collectPreviewTargets(
      nodeId,
      (id) => findNodeById(data, id)?.props as Record<string, unknown> | undefined,
      hasSlots,
    );
    useAnimationPreview.getState().play(nodeId, targets, dir);
  };

  // Hand the node back clean when the admin selects another element or leaves this tab.
  useEffect(() => () => useAnimationPreview.getState().stop(), [nodeId]);

  // Replays on the real block as the settings change. Skips the first render, so opening the tab
  // does not set the canvas moving.
  const lastSignature = useRef(animSignature);
  useEffect(() => {
    if (lastSignature.current === animSignature) return;
    lastSignature.current = animSignature;
    if (!liveCanvas || !entrance) return;
    const timer = setTimeout(playOnCanvas, LIVE_REPLAY_MS);
    return () => clearTimeout(timer);
    // `playOnCanvas` reads the latest data when it fires; only a settings change should re-arm it.
  }, [animSignature]);

  const options = <T extends string>(values: readonly T[], group: string) =>
    values.map((value) => ({ value, label: (t as unknown as (key: string) => string)(`${group}.${value}`) }));

  const pickType = (next: string) => {
    const cleared = Object.fromEntries(START_STATE_KEYS.map((key) => [key, undefined]));
    onUpdate({ ...cleared, animType: next });
  };
  const pickEase = (next: string) => {
    const cleared = Object.fromEntries(SPRING_KEYS.map((key) => [key, undefined]));
    onUpdate({ ...cleared, animEase: next });
  };
  const copy = () => {
    const picked = NODE_ANIMATION_PROP_KEYS.filter((key) => props[key] !== undefined).map((key) => [key, props[key]]);
    clipboard.set(Object.fromEntries(picked));
  };
  const blank = () => Object.fromEntries(NODE_ANIMATION_PROP_KEYS.map((key) => [key, undefined]));

  const slider = (
    key: NodeAnimationRangeKey,
    label: string,
    value: number,
    extra: { suffix?: string; factor?: number; hint?: string } = {},
  ) => (
    <AnimSlider
      key={key}
      rangeKey={key}
      label={label}
      value={value}
      dirty={props[key] !== undefined}
      onReset={() => onUpdate({ [key]: undefined })}
      onChange={(next) => onUpdate({ [key]: next })}
      {...extra}
    />
  );

  const runLength = entrance ? entrance.delay + entranceLength(entrance) : 0;
  const unit = t('secondsUnit');

  return (
    <div>
      <div className="sticky top-0 z-20 space-y-2 border-b border-border/60 bg-card px-3.5 py-3">
        <Stage
          config={config}
          signature={animSignature}
          cascades={cascades}
          dir={dir}
          hint={t('stageHint')}
        />
        {entrance && (
          <Transport
            hasRun={preview.nodeId === nodeId}
            status={preview.nodeId === nodeId ? preview.status : 'idle'}
            onPlay={playOnCanvas}
            liveCanvas={liveCanvas}
            onToggleLive={() => setLiveCanvas((value) => !value)}
          />
        )}
      </div>

      <Section title={t('sections.entrance')} icon={Sparkles}>
        <div className="grid grid-cols-3 gap-1.5 px-3.5 pb-3">
          {PICKER_TYPES.map((value) => (
            <EntranceTile
              key={value}
              type={value}
              label={t(`entrance.${value}`)}
              active={type === value}
              dir={dir}
              onPick={() => pickType(value)}
            />
          ))}
        </div>
      </Section>

      {entrance && (
        <>
          <Section title={t('sections.startState')} icon={Waves}>
            {entrance.axis && slider('animDistance', t('distance'), entrance.distance, { suffix: 'px' })}
            {slider('animScale', t('scale'), entrance.scale)}
            {slider('animRotate', t('rotate'), entrance.rotate, { suffix: '°' })}
            {slider('animBlur', t('blur'), entrance.blur, { suffix: 'px' })}
            {slider('animFromOpacity', t('fromOpacity'), entrance.fromOpacity, { suffix: '%', factor: 100 })}
          </Section>

          <Section title={t('sections.timing')} icon={Timer}>
            <div className="grid grid-cols-4 gap-1.5 px-3.5 pb-2">
              {NODE_ANIMATION_EASES.map((value) => (
                <EaseTile
                  key={value}
                  ease={value}
                  label={t(`ease.${value}`)}
                  active={entrance.ease === value}
                  onPick={() => pickEase(value)}
                />
              ))}
            </div>
            <CurveGraph entrance={entrance} label={t('total', { seconds: runLength.toFixed(2), unit })} />
            {slider('animDelay', t('delay'), entrance.delay, { suffix: unit })}
            {entrance.spring ? (
              <>
                {slider('animStiffness', t('stiffness'), entrance.spring.stiffness)}
                {slider('animDamping', t('damping'), entrance.spring.damping)}
                {slider('animMass', t('mass'), entrance.spring.mass)}
              </>
            ) : (
              slider('animDuration', t('duration'), entrance.duration, { suffix: unit })
            )}
            {runLength > LONG_RUN_SECONDS && (
              <p className="px-3.5 pb-2 text-2xs leading-snug text-warning">{t('longRun')}</p>
            )}
          </Section>

          <Section title={t('sections.trigger')} icon={ScanEye}>
            <FieldRow label={t('startWhen')}>
              <SegmentedControl
                value={config.onLoad ? 'load' : 'view'}
                onChange={(next) => onUpdate({ animTrigger: next })}
                options={[
                  { value: 'view', label: t('trigger.view') },
                  { value: 'load', label: t('trigger.load') },
                ]}
              />
            </FieldRow>
            {!config.onLoad && (
              <>
                {slider('animViewAmount', t('viewAmount'), config.viewAmount, {
                  suffix: '%',
                  factor: 100,
                  hint: t('viewAmountHint'),
                })}
                <FieldRow label={t('repeat')} hint={t('repeatHint')}>
                  <ToggleControl value={config.repeat} onChange={(next) => onUpdate({ animRepeat: next })} />
                </FieldRow>
              </>
            )}
          </Section>

          {hasSlots && (
            <Section title={t('sections.cascade')} icon={Workflow}>
              {slider('animStagger', t('stagger'), config.stagger, { suffix: unit, hint: t('staggerHint') })}
            </Section>
          )}
        </>
      )}

      <Section title={t('sections.interaction')} icon={Hand}>
        <FieldRow label={t('hoverLabel')}>
          <SelectControl
            value={config.hover}
            onChange={(next) => onUpdate({ animHover: next })}
            options={options(NODE_ANIMATION_HOVERS, 'hover')}
          />
        </FieldRow>
        <FieldRow label={t('pressLabel')}>
          <SelectControl
            value={config.press}
            onChange={(next) => onUpdate({ animPress: next })}
            options={options(NODE_ANIMATION_PRESSES, 'press')}
          />
        </FieldRow>
      </Section>

      <Section title={t('sections.loop')} icon={Repeat2}>
        <FieldRow label={t('loopLabel')}>
          <SelectControl
            value={config.loop}
            onChange={(next) => onUpdate({ animLoop: next })}
            options={options(NODE_ANIMATION_LOOPS, 'loopKind')}
          />
        </FieldRow>
        {config.loop !== 'none' && (
          <>
            {slider('animLoopDuration', t('loopDuration'), config.loopDuration, { suffix: unit })}
            {config.loop !== 'spin' && slider('animLoopAmount', t('loopAmount'), config.loopAmount, { suffix: '×' })}
          </>
        )}
      </Section>

      <div className="flex items-center gap-1.5 px-3.5 py-3">
        <FooterButton icon={ClipboardCopy} label={t('copy')} onClick={copy} />
        <FooterButton
          icon={ClipboardPaste}
          label={t('paste')}
          disabled={!clipboard.value}
          onClick={() => clipboard.value && onUpdate({ ...blank(), ...clipboard.value })}
        />
        <FooterButton icon={RotateCcw} label={t('resetAll')} onClick={() => onUpdate(blank())} />
      </div>
    </div>
  );
}

/* ── Layout pieces ───────────────────────────────────────────────────────── */

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <m.span
          className="inline-flex"
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={spring.snappy}
        >
          <ChevronDown className="size-3.5" />
        </m.span>
        <Icon className="size-3.5" /> {title}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function FooterButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1.5 text-2xs font-medium text-muted-foreground shadow-xs transition hover:bg-muted hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function AnimSlider({
  rangeKey,
  label,
  value,
  dirty,
  onReset,
  onChange,
  suffix,
  hint,
  factor = 1,
}: {
  rangeKey: NodeAnimationRangeKey;
  label: string;
  value: number;
  dirty: boolean;
  onReset: () => void;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: string;
  /** Display multiplier, so a 0–1 fraction can read as a percentage. */
  factor?: number;
}) {
  const range = NODE_ANIMATION_RANGES[rangeKey];
  const shown = Math.round(value * factor * 1000) / 1000;
  const { local, update, flush } = useDebouncedValue(shown, (next) => onChange(next / factor));
  return (
    <FieldRow label={label} hint={hint} dirty={dirty} onReset={onReset}>
      <SliderControl
        value={local}
        onChange={update}
        min={range.min * factor}
        max={range.max * factor}
        step={range.step * factor}
        suffix={suffix}
        onPointerUp={flush}
      />
    </FieldRow>
  );
}

/* ── Stage: a live sample that uses the same variants as the public site ─── */

function StageContent({
  variants,
  whileHover,
  whileTap,
  children,
}: {
  variants?: Variants;
  whileHover?: ReturnType<typeof hoverTarget>;
  whileTap?: ReturnType<typeof pressTarget>;
  children: ReactNode;
}) {
  return (
    <m.div
      variants={variants}
      initial={variants ? 'hidden' : false}
      animate={variants ? 'visible' : undefined}
      whileHover={whileHover}
      whileTap={whileTap}
    >
      {children}
    </m.div>
  );
}

function Stage({
  config,
  signature,
  cascades,
  dir,
  hint,
}: {
  config: ReturnType<typeof readNodeAnimation>;
  signature: string;
  cascades: boolean;
  dir: 'ltr' | 'rtl';
  hint: string;
}) {
  const prefersReduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  const entrance = config.entrance;
  const whileHover = hoverTarget(config, dir);
  const whileTap = pressTarget(config);
  const card = (className: string) => (
    <div className={cn('rounded-lg border border-primary/25 bg-primary/10 shadow-xs', className)} />
  );
  return (
    <MotionConfig reducedMotion={prefersReduced ? 'user' : 'never'}>
      <button
        type="button"
        title={hint}
        aria-label={hint}
        onClick={() => setReplay((value) => value + 1)}
        className="flex h-24 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-border/70 bg-surface-sunken/60"
      >
        <div key={`${signature}-${replay}`} className="flex items-center gap-2">
          {cascades && entrance ? (
            [0, 1, 2].map((index) => (
              <StageContent
                key={index}
                variants={entranceVariants(entrance, {
                  dir,
                  extraDelay: cascadeDelay(index, config.stagger),
                })}
                whileHover={whileHover}
                whileTap={whileTap}
              >
                <LoopLayer config={config}>{card('h-12 w-12')}</LoopLayer>
              </StageContent>
            ))
          ) : (
            <StageContent
              variants={entrance ? entranceVariants(entrance, { dir }) : undefined}
              whileHover={whileHover}
              whileTap={whileTap}
            >
              <LoopLayer config={config}>{card('h-12 w-24')}</LoopLayer>
            </StageContent>
          )}
        </div>
      </button>
    </MotionConfig>
  );
}

/* ── Transport: drives the real block on the canvas ──────────────────────── */

function Transport({
  hasRun,
  status,
  onPlay,
  liveCanvas,
  onToggleLive,
}: {
  hasRun: boolean;
  status: 'idle' | 'playing' | 'paused';
  onPlay: () => void;
  liveCanvas: boolean;
  onToggleLive: () => void;
}) {
  const t = useTranslations('builder.animPanel');
  const time = useAnimationPreview((s) => s.time);
  const total = useAnimationPreview((s) => s.total);
  const speed = useAnimationPreview((s) => s.speed);
  const loop = useAnimationPreview((s) => s.loop);
  const { pause, resume, seek, setSpeed, setLoop } = useAnimationPreview.getState();
  const button =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-xs transition hover:bg-muted hover:text-foreground active:scale-95 aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary';
  const isPlaying = status === 'playing';
  const main = isPlaying ? pause : status === 'paused' ? resume : onPlay;
  const mainLabel = isPlaying ? t('pause') : status === 'paused' ? t('resume') : t('play');
  const position = hasRun ? time : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={t('timeline')}
          min={0}
          max={hasRun && total > 0 ? total : 1}
          step={0.01}
          value={position}
          disabled={!hasRun}
          onChange={(event) => seek(Number(event.target.value))}
          className="inspector-slider h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {position.toFixed(2)} / {(hasRun ? total : 0).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={main} aria-label={mainLabel} title={mainLabel} className={button}>
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="flip-rtl size-3.5" />}
        </button>
        <button type="button" onClick={onPlay} aria-label={t('replay')} title={t('replay')} className={button}>
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setLoop(!loop)}
          aria-pressed={loop}
          aria-label={t('loopPreview')}
          title={t('loopPreview')}
          className={button}
        >
          <Repeat className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleLive}
          aria-pressed={liveCanvas}
          aria-label={t('liveCanvas')}
          title={t('liveCanvas')}
          className={button}
        >
          <ScanEye className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <SegmentedControl
            value={speed}
            onChange={(next) => setSpeed(next as number)}
            options={SPEEDS.map((value) => ({ value, label: `${value}×` }))}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Pickers ─────────────────────────────────────────────────────────────── */

const tileClass = (active: boolean) =>
  cn(
    'flex min-w-0 flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-center text-2xs font-medium transition active:scale-[0.97]',
    active
      ? 'border-primary/50 bg-primary/10 text-foreground'
      : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
  );

function EntranceTile({
  type,
  label,
  active,
  dir,
  onPick,
}: {
  type: string;
  label: string;
  active: boolean;
  dir: 'ltr' | 'rtl';
  onPick: () => void;
}) {
  const [run, setRun] = useState(0);
  // A smaller travel than the real default, so the demo fits inside its tile.
  const entrance = useMemo(
    () => readNodeAnimation({ animType: type, animDistance: type === 'none' ? undefined : 6 }).entrance,
    [type],
  );
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      onMouseEnter={() => setRun((value) => value + 1)}
      className={tileClass(active)}
    >
      <span className="flex h-6 w-6 items-center justify-center">
        <m.span
          key={run}
          className={cn('block size-4 rounded-[4px]', entrance ? 'bg-primary/70' : 'border border-dashed border-border-strong')}
          variants={entrance ? entranceVariants(entrance, { dir }) : undefined}
          initial={entrance && run > 0 ? 'hidden' : false}
          animate={entrance ? 'visible' : undefined}
        />
      </span>
      <span className="w-full truncate">{label}</span>
    </button>
  );
}

function curvePath(samples: number[], width: number, height: number): string {
  const top = Math.max(1, ...samples);
  const bottom = Math.min(0, ...samples);
  const span = top - bottom || 1;
  return samples
    .map((value, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = height - ((value - bottom) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function EaseTile({
  ease,
  label,
  active,
  onPick,
}: {
  ease: string;
  label: string;
  active: boolean;
  onPick: () => void;
}) {
  const samples = useMemo(() => {
    const entrance = readNodeAnimation({ animType: 'fade', animEase: ease }).entrance;
    return entrance ? entranceCurve(entrance, 24) : [];
  }, [ease]);
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      onClick={onPick}
      className={tileClass(active)}
    >
      <svg viewBox="0 0 40 20" className="h-5 w-10 overflow-visible" aria-hidden="true">
        <path
          d={curvePath(samples, 40, 20)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={isSpringEase(ease) ? 'text-primary' : undefined}
        />
      </svg>
      <span className="w-full truncate">{label}</span>
    </button>
  );
}

function CurveGraph({ entrance, label }: { entrance: NodeEntrance; label: string }) {
  const samples = useMemo(() => entranceCurve(entrance), [entrance]);
  const top = Math.max(1, ...samples);
  const bottom = Math.min(0, ...samples);
  const targetY = 56 - ((1 - bottom) / (top - bottom || 1)) * 56;
  return (
    <div className="px-3.5 pb-1">
      <div className="rounded-lg border border-border/70 bg-surface-sunken/60 px-2.5 py-2">
        <svg viewBox="0 0 240 56" className="h-14 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
          <line
            x1="0"
            x2="240"
            y1={targetY}
            y2={targetY}
            stroke="currentColor"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            className="text-border-strong"
          />
          <path
            d={curvePath(samples, 240, 56)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
          />
        </svg>
        <p className="mt-1 text-end font-mono text-2xs tabular-nums text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
