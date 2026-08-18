'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Cloud from '@/components/Cloud';
import ConfirmationSequence from '@/components/ConfirmationSequence';
import type { CheckinApiResponse, Member, SearchApiResponse } from '@/lib/types';

type Stage =
  | { name: 'search' }
  | { name: 'confirm'; member: Member }
  | { name: 'confirming'; member: Member; revealed: boolean; alreadyCheckedIn: boolean };

const DEBOUNCE_MS = 300;
const RESET_DELAY_MS = 4000;
// Lets the navy takeover / cloud sweep actually land before the name and
// checkmark appear, so a fast API response doesn't cut the moment short.
const MIN_SEQUENCE_MS = 900;

export default function CheckInFlow({ newMemberFormUrl }: { newMemberFormUrl?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [stage, setStage] = useState<Stage>({ name: 'search' });
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkedInAt, setCheckedInAt] = useState<string>('');

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
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
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
    setCheckinError(null);
    setStage({ name: 'confirming', member, revealed: false, alreadyCheckedIn: false });
    const startedAt = Date.now();
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
      // Success: let the entrance animation finish landing before revealing
      // the name, even if the API answered almost instantly.
      const wait = MIN_SEQUENCE_MS - (Date.now() - startedAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setCheckedInAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      setStage({ name: 'confirming', member, revealed: true, alreadyCheckedIn: !!data.alreadyCheckedIn });
      scheduleReset();
    } catch {
      setCheckinError("Couldn't reach the check-in system — please try again, or see someone at the welcome desk.");
      setStage({ name: 'confirm', member });
    }
  };

  if (stage.name === 'confirm') {
    const { member } = stage;
    const firstName = member.fullName.trim().split(/\s+/)[0];
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-sky px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <p className="text-[17px] text-ink-muted">Is this you?</p>
          <h1 className="display mt-3 text-[36px] leading-[0.95] text-navy-800 sm:text-[44px]">{member.fullName}</h1>

          {checkinError && (
            <p className="mt-6 rounded-md bg-blue-100 px-4 py-3 text-base font-medium text-red-500">{checkinError}</p>
          )}

          <button
            type="button"
            onClick={() => confirmCheckin(member)}
            className="mt-9 flex min-h-16 w-full items-center justify-center gap-2.5 rounded-full bg-navy-800 px-6 shadow-level1 transition active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12.5l5 5L20 6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[17px] font-semibold text-white">
              Yes, that&apos;s me{firstName ? `, ${firstName}` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCheckinError(null);
              setStage({ name: 'search' });
            }}
            className="mt-3 min-h-14 w-full rounded-full border-[1.5px] border-blue-100 px-6 text-base font-semibold text-ink-muted transition active:scale-[0.98]"
          >
            Not me — go back
          </button>
        </div>
      </div>
    );
  }

  if (stage.name === 'confirming') {
    const firstName = stage.member.fullName.trim().split(/\s+/)[0];
    return (
      <ConfirmationSequence
        fullName={stage.member.fullName}
        firstName={firstName}
        revealed={stage.revealed}
        alreadyCheckedIn={stage.alreadyCheckedIn}
        timeLabel={checkedInAt}
        onDismiss={resetToSearch}
      />
    );
  }

  // stage.name === 'search'
  const trimmed = query.trim();
  const showNoResults = trimmed.length >= 2 && searchState === 'idle' && results.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-sky">
      <div className="relative flex-shrink-0 overflow-hidden px-6 pt-6">
        <div className="pointer-events-none absolute -right-10 -top-8 h-36 w-52" aria-hidden="true">
          <Cloud fill="#80ACF8" fillOpacity={0.2} flip />
        </div>

        <Link href="/" className="relative inline-flex items-center gap-1 text-sm font-medium text-ink-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="#5C6B90" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Home
        </Link>

        <h1 className="display relative mt-4 text-[36px] leading-none text-navy-800 sm:text-[44px]">Welcome back!</h1>
        <p className="relative mt-2 text-[17px] leading-snug text-ink-muted">Find your name to check in.</p>

        <div className="relative mt-5">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            inputMode="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing…"
            className="h-14 w-full rounded-sm border-2 border-transparent bg-blue-100 pl-11 pr-4 font-sans text-base text-ink outline-none placeholder:text-ink-muted focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(88,142,238,0.20)]"
          />
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50">
            {searchState === 'loading' ? <Spinner /> : <SearchIcon />}
          </div>
        </div>
      </div>

      <div role="region" aria-live="polite" className="flex flex-1 flex-col gap-2 px-6 pb-6 pt-4">
        {searchState === 'error' && (
          <p className="rounded-md bg-blue-100 px-4 py-4 text-center text-base font-medium text-red-500">
            Search isn&apos;t working right now. Please try again, or see someone at the welcome desk.
          </p>
        )}

        {checkinError && (
          <p className="rounded-md bg-blue-100 px-4 py-4 text-center text-base font-medium text-red-500">
            {checkinError}
          </p>
        )}

        {!trimmed && searchState === 'idle' && (
          <p className="text-sm leading-snug text-ink-muted">Type the first few letters of your first or last name.</p>
        )}

        {results.length > 0 && (
          <>
            <p className="mb-1 text-sm text-ink-muted">
              {results.length} result{results.length === 1 ? '' : 's'}
            </p>
            <div className="flex flex-col gap-0.5 overflow-hidden rounded-md shadow-level1">
              {results.map((member, i) => (
                <button
                  key={member.memberId}
                  type="button"
                  onClick={() => selectMember(member)}
                  className="row-in flex min-h-16 items-center border-none bg-white px-5 text-left"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="flex-grow text-[19px] text-ink">
                    <MatchHighlight fullName={member.fullName} query={trimmed} />
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 opacity-30" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="#0B1B3D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}

        {showNoResults && (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="mb-3.5 opacity-35" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="#5C6B90" strokeWidth="1.6" />
              <path d="M21 21l-4.3-4.3" stroke="#5C6B90" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p className="text-[17px] leading-snug text-ink">
              No one found matching <strong>&ldquo;{trimmed}&rdquo;</strong>.
            </p>

            {newMemberFormUrl ? (
              <a
                href={newMemberFormUrl}
                className="mt-6 flex min-h-16 w-full items-center justify-center gap-2.5 rounded-full bg-navy-800 px-7 shadow-level1"
              >
                <span className="text-[17px] font-semibold text-white">Register as a new guest</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : (
              <p className="mt-4 text-base text-ink-muted">Please see someone at the welcome desk.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Bolds the portion of fullName that matches the typed query (case-
// insensitive, first occurrence) — mirrors the design's highlighted-prefix
// treatment without assuming the match is always at the start of the name.
function MatchHighlight({ fullName, query }: { fullName: string; query: string }) {
  if (!query) return <span className="font-semibold">{fullName}</span>;
  const idx = fullName.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span className="font-semibold">{fullName}</span>;
  const before = fullName.slice(0, idx);
  const match = fullName.slice(idx, idx + query.length);
  const after = fullName.slice(idx + query.length);
  return (
    <>
      {before && <span className="font-semibold">{before}</span>}
      <span className="font-semibold text-blue-500">{match}</span>
      {after && <span className="font-semibold">{after}</span>}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="#5C6B90" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="#5C6B90" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-[18px] w-[18px] animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
