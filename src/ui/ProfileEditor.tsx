/**
 * Profile editor. The profile lives on this device only (localStorage).
 * It is used by on-device features directly and by cloud features only when
 * the user opts in per feature.
 */

import { useState } from 'react';
import { RotateCcw, Save, User } from 'lucide-react';
import type { CandidateProfile } from '../ai/types';
import { resetProfile, saveProfile } from '../store/profile';
import { Card, PrimaryButton, SectionHeading } from './components';

function listField(label: string, value: string, onChange: (v: string) => void, placeholder: string) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-800">{label}</span>
      <span className="mt-1 block text-xs text-stone-500">One per line.</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

export function ProfileEditor({
  profile,
  onChange,
}: {
  profile: CandidateProfile;
  onChange: (p: CandidateProfile) => void;
}) {
  const [draft, setDraft] = useState<CandidateProfile>(profile);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveProfile(draft);
    onChange(draft);
    setSaved(true);
  }

  function handleReset() {
    const sample = resetProfile();
    setDraft(sample);
    onChange(sample);
    setSaved(false);
  }

  const split = (s: string) =>
    s
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <User className="h-5 w-5" />
        </span>
        <SectionHeading
          title="My profile"
          subtitle="Stored only on this device. On-device features use it directly; cloud features only get it if you allow it, per feature."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Full name</span>
          <input
            value={draft.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Headline</span>
          <input
            value={draft.headline}
            onChange={(e) => set('headline', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-stone-800">Education</span>
          <input
            value={draft.education}
            onChange={(e) => set('education', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>
        {listField('Skills', draft.skills.join('\n'), (v) => set('skills', split(v)), 'React\nTypeScript\nCustomer support')}
        {listField('Experience', draft.experience.join('\n'), (v) => set('experience', split(v)), 'Answered customer emails for a college helpdesk')}
        {listField('Projects', draft.projects.join('\n'), (v) => set('projects', split(v)), 'Campus helpdesk site (React, Firebase)')}
        {listField('Languages', draft.languages.join('\n'), (v) => set('languages', split(v)), 'English\nHindi')}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={handleSave}>
          <Save className="h-4 w-4" /> Save profile on this device
        </PrimaryButton>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
        >
          <RotateCcw className="h-4 w-4" /> Reset to sample profile
        </button>
        {saved && <span className="text-sm font-medium text-emerald-700">Saved.</span>}
      </div>
    </Card>
  );
}
