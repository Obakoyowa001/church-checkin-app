'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CaretRight, CheckCircle, MagnifyingGlass } from '@phosphor-icons/react';
import CheckBadge from '@/components/CheckBadge';
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-brand-deeper via-brand-deep to-brand-mid px-6 text-center">
        <CheckBadge size={180} />
        <h1 className="animate-text-rise mt-8 max-w-sm font-display text-2xl font-semibold leading-tight text-cream sm:max-w-md sm:text-3xl">
          {stage.alreadyCheckedIn ? "You're already checked in" : `You're checked in, ${firstName}`}
        </h1>
        <p className="animate-text-rise mt-2 text-lg text-cream/75" style={{ animationDelay: '0.1s' }}>
          {stage.alreadyCheckedIn ? 'Good to see you!' : 'Welcome — glad you’re here.'}
        </p>
        <button
          type="button"
          onClick={resetToSearch}
          className="animate-text-rise mt-10 min-h-[52px] rounded-2xl bg-cream/15 px-8 text-base font-semibold text-cream transition active:scale-[0.98]"
          style={{ animationDelay: '0.1s' }}
        >
          Done
        </button>
      </div>
    );
  }

  if (stage.name === 'confirm' || stage.name === 'checking') {
    const { member } = stage;
    const firstName = member.fullName.trim().split(/\s+/)[0];
    const isChecking = stage.name === 'checking';
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center sm:max-w-lg">
          <p className="text-lg text-ink/60">Is this you?</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-brand-deep sm:text-5xl">
            {member.fullName}
          </h1>

          {checkinError && (
            <p className="mt-6 rounded-2xl bg-accent/10 px-4 py-3 text-base font-medium text-accent">{checkinError}</p>
          )}

          <button
            type="button"
            disabled={isChecking}
            onClick={() => confirmCheckin(member)}
            className="mt-10 flex min-h-[68px] w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-deep px-6 text-xl font-bold text-cream shadow-lg shadow-brand-deep/30 transition active:scale-[0.98] disabled:opacity-70"
          >
            <CheckCircle size={22} weight="bold" color="#3D66D6" />
            {isChecking ? 'Checking you in…' : `Yes, that's me${firstName ? `, ${firstName}` : ''}`}
          </button>

          <button
            type="button"
            disabled={isChecking}
            onClick={resetToSearch}
            className="mt-4 min-h-[52px] w-full rounded-2xl border border-brand-deep/15 px-6 text-base font-semibold text-ink/60 transition active:scale-[0.98] disabled:opacity-50"
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
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:items-center sm:px-8">
      <div className="mx-auto w-full max-w-md flex-1 sm:max-w-xl">
        <Link href="/" className="inline-flex items-center gap-1 text-base font-medium text-ink/45">
          <ArrowLeft size={16} weight="bold" />
          Home
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold text-brand-deep sm:text-4xl">Welcome back!</h1>
        <p className="mt-1.5 text-base text-ink/55 sm:text-lg">Find your name to check in.</p>

        <div className="relative mt-6">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            inputMode="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type the first few letters of your name"
            className="min-h-[60px] w-full rounded-2xl border-2 border-brand/30 bg-white pl-5 pr-12 text-lg text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-brand"
          />
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            {searchState === 'loading' ? <Spinner /> : <MagnifyingGlass size={20} color="#3D66D6" />}
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {searchState === 'error' && (
            <p className="rounded-2xl bg-accent/10 px-4 py-4 text-center text-base font-medium text-accent">
              Search isn&apos;t working right now. Please try again, or see someone at the welcome desk.
            </p>
          )}

          {results.map((member) => (
            <button
              key={member.memberId}
              type="button"
              onClick={() => selectMember(member)}
              className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 text-left shadow-sm ring-1 ring-brand-deep/10 transition active:scale-[0.98] active:bg-brand-tint"
            >
              <span className="text-lg font-semibold text-ink sm:text-xl flex-grow">{member.fullName}</span>
              <CaretRight size={16} weight="bold" className="flex-shrink-0 opacity-30" />
            </button>
          ))}

          {showNoResults && (
            <div className="rounded-2xl bg-brand-tint px-5 py-6 text-center">
              <p className="text-lg font-semibold text-ink">Can&apos;t find your name?</p>
              <p className="mt-1 text-base text-ink/60">Please see someone at the welcome desk.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
