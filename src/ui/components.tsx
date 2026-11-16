/**
 * Shared UI pieces: inference badges, cards, section headings.
 * Two font families (Fraunces display, Inter UI), one brass accent, Lucide
 * icons only, no emoji in the UI.
 */

import { Cloud, Cpu, Loader2 } from 'lucide-react';
import type { InferenceSourceLabel } from '../ai/types';

function isMockSource(source: InferenceSourceLabel): boolean {
  return source === 'mock-on-device' || source === 'mock-cloud';
}

function isOnDeviceSource(source: InferenceSourceLabel): boolean {
  return source === 'on-device' || source === 'mock-on-device';
}

/**
 * The inference badge. Every AI result in the app carries one, plus latency,
 * so the hybrid split is visible at a glance. In demo mode a small "demo"
 * chip is added so the badge never pretends a real model ran.
 */
export function SourceBadge({
  source,
  latencyMs,
  fallback,
}: {
  source: InferenceSourceLabel;
  latencyMs: number;
  fallback?: boolean;
}) {
  const onDevice = isOnDeviceSource(source);
  const demo = isMockSource(source);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
          onDevice
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-sky-100 text-sky-800'
        }`}
      >
        {onDevice ? <Cpu className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
        {onDevice ? 'On-device' : 'Cloud'}
        {demo && <span className="font-medium opacity-70">· demo</span>}
      </span>
      <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
        {latencyMs.toLocaleString()} ms
      </span>
      {fallback && (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
          cloud fallback
        </span>
      )}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-xl font-semibold text-stone-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
