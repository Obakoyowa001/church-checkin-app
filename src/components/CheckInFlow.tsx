'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckinApiResponse, Member, SearchApiResponse } from '@/lib/types';

type Stage =
  | { name: 'search' }
  | { name: 'confirm'; member: Member }
  | { name: 'checking'; member: Member }
  | { name: 'success'; member: Member; alreadyCheckedIn: boolean };

const DEBOUNCE_MS = 300;
const RESET_DELAY_MS = 4000;

export default function CheckInFlow() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [stage, setStage] = useState<Stage>({ name: 'search' });
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearchState('loading');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      const data: SearchApiResponse = await res.json();
      if (!data.success) {
        setSearchState('error');
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
      setSearchState('idle');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchState('error');
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchState('idle');
      abortRef.current?.abort();
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const resetToSearch = useCallback(() => {
    setStage({ name: 'search' });
    setQuery('');
    setResults([]);
    setSearchState('idle');
    setCheckinError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(resetToSearch, RESET_DELAY_MS);
  }, [resetToSearch]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const selectMember = (member: Member) => {
    setCheckinError(null);
    setStage({ name: 'confirm', member });
  };

  const confirmCheckin = async (member: Member) => {
    setStage({ name: 'checking', member });
    setCheckinError(null);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.memberId }),
      });
      const data: CheckinApiResponse = await res.json();
      if (!data.success) {
        setCheckinError(data.error ?? "Something went wrong — please try again, or see someone at the welcome desk.");
        setStage({ name: 'confirm', member });
        return;
      }
      setStage({ name: 'success', member, alreadyCheckedIn: !!data.alreadyCheckedIn });
      scheduleReset();
    } catch {
      setCheckinError("Couldn't reach the check-in system — please try again, or see someone at the welcome desk.");
      setStage({ name: 'confirm', member });
    }
  };

  if (stage.name === 'success') {
    const firstName = stage.member.fullName.trim().split(/\s+/)[0];
    return (
      <FullScreenMessage
        onDismiss={resetToSearch}
        icon={
          <div className="animate-check-pop flex h-28 w-28 items-center justify-center rounded-full bg-teal">
            <svg viewBox="0 0 24 24" fill="none" className="h-14 w-14 text-cream" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        }
        heading={stage.alreadyCheckedIn ? "You're already checked in" : `You're checked in, ${firstName}`}
        subheading={stage.alreadyCheckedIn ? 'Good to see you!' : 'Welcome — glad you’re here.'}
      />
    );
  }

  if (stage.name === 'confirm' || stage.name === 'checking') {
    const { member } = stage;
    const firstName = member.fullName.trim().split(/\s+/)[0];
    const isChecking = stage.name === 'checking';
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center">
          <p className="text-lg text-ink/70">Is this you?</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-teal-deep sm:text-5xl">{member.fullName}</h1>

          {checkinError && (
            <p className="mt-6 rounded-2xl bg-amber/10 px-4 py-3 text-base font-medium text-amber">
              {checkinError}
            </p>
          )}

          <button
            type="button"
            disabled={isChecking}
            onClick={() => confirmCheckin(member)}
            className="mt-10 min-h-[72px] w-full rounded-2xl bg-teal px-6 text-2xl font-semibold text-cream shadow-lg transition active:scale-[0.98] disabled:opacity-70"
          >
            {isChecking ? 'Checking you in…' : `Yes, that's me${firstName ? `, ${firstName}` : ''}`}
          </button>

          <button
            type="button"
            disabled={isChecking}
            onClick={resetToSearch}
            className="mt-4 min-h-[56px] w-full rounded-2xl border-2 border-teal/20 px-6 text-lg font-medium text-ink/70 transition active:scale-[0.98] disabled:opacity-50"
          >
            Not me — go back
          </button>
        </div>
      </div>
    );
  }

  // stage.name === 'search'
  const trimmed = query.trim();
  const showNoResults = trimmed.length >= 2 && searchState === 'idle' && results.length === 0;

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-md flex-1">
        <h1 className="text-center text-3xl font-bold text-teal-deep sm:text-4xl">Welcome!</h1>
        <p className="mt-2 text-center text-lg text-ink/70">Find your name to check in.</p>

        <div className="relative mt-8">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            inputMode="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type the first few letters of your name"
            className="min-h-[64px] w-full rounded-2xl border-2 border-teal/20 bg-white px-5 text-xl text-ink shadow-sm outline-none placeholder:text-ink/40 focus:border-teal"
          />
          {searchState === 'loading' && (
            <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2">
              <Spinner />
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {searchState === 'error' && (
            <p className="rounded-2xl bg-amber/10 px-4 py-4 text-center text-lg font-medium text-amber">
              Search isn&apos;t working right now. Please try again, or see someone at the welcome desk.
            </p>
          )}

          {results.map((member) => (
            <button
              key={member.memberId}
              type="button"
              onClick={() => selectMember(member)}
              className="min-h-[60px] w-full rounded-2xl bg-white px-5 py-4 text-left text-xl font-medium text-ink shadow-sm ring-1 ring-teal/10 transition active:scale-[0.98] active:bg-teal/5"
            >
              {member.fullName}
            </button>
          ))}

          {showNoResults && (
            <div className="rounded-2xl bg-teal/5 px-5 py-6 text-center">
              <p className="text-lg font-medium text-ink">Can&apos;t find your name?</p>
              <p className="mt-1 text-lg text-ink/70">Please see someone at the welcome desk.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-teal" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function FullScreenMessage({
  icon,
  heading,
  subheading,
  onDismiss,
}: {
  icon: React.ReactNode;
  heading: string;
  subheading: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-teal px-6 text-center">
      {icon}
      <h1 className="mt-8 max-w-sm text-3xl font-bold leading-tight text-cream sm:text-4xl">{heading}</h1>
      <p className="mt-3 text-xl text-cream/85">{subheading}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-12 min-h-[56px] rounded-2xl bg-cream/15 px-8 text-lg font-medium text-cream transition active:scale-[0.98]"
      >
        Done
      </button>
    </div>
  );
}
