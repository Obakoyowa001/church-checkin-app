'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Cloud from '@/components/Cloud';
import type { Member, SearchApiResponse } from '@/lib/types';

type Stage = { name: 'search' } | { name: 'registered'; member: Member };

const DEBOUNCE_MS = 300;

export default function UnityRegisterFlow({ formUrl }: { formUrl?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [stage, setStage] = useState<Stage>({ name: 'search' });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearchState('loading');
    try {
      const res = await fetch(`/api/unity-sunday/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
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
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  if (stage.name === 'registered') {
    const firstName = stage.member.fullName.trim().split(/\s+/)[0];
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-navy-800 px-6 py-10">
        <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-52" aria-hidden="true">
          <Cloud fill="#80ACF8" fillOpacity={0.14} flip />
        </div>

        <div className="relative w-full max-w-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.12]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12.5l5 5L20 6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p className="mt-7 text-[17px] text-white/[0.72]">You&apos;re already registered</p>
          <h1 className="display mt-2 text-[36px] leading-[0.95] text-white sm:text-[44px]">{stage.member.fullName}</h1>
          <p className="mt-4 text-[17px] text-white/[0.72]">
            See you on Unity Sunday{firstName ? `, ${firstName}` : ''}!
          </p>

          <button
            type="button"
            onClick={resetToSearch}
            className="mt-9 min-h-14 w-full rounded-full border-[1.5px] border-white/25 px-6 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
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

        <h1 className="display relative mt-4 text-[36px] leading-none text-navy-800 sm:text-[44px]">Unity Sunday</h1>
        <p className="relative mt-2 text-[17px] leading-snug text-ink-muted">
          Check if you&apos;ve already registered, or register below.
        </p>

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

      <div role="region" aria-live="polite" className="flex flex-1 flex-col gap-2 px-6 pt-4">
        {searchState === 'error' && (
          <p className="rounded-md bg-blue-100 px-4 py-4 text-center text-base font-medium text-red-500">
            Search isn&apos;t working right now. Please try again, or register below.
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
                  onClick={() => setStage({ name: 'registered', member })}
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
          <div className="flex flex-col items-center py-6 text-center">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="mb-3.5 opacity-35" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="#5C6B90" strokeWidth="1.6" />
              <path d="M21 21l-4.3-4.3" stroke="#5C6B90" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p className="text-[17px] leading-snug text-ink">
              No registration found for <strong>&ldquo;{trimmed}&rdquo;</strong>.
            </p>
            <p className="mt-1.5 text-base text-ink-muted">Register below to sign up.</p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-6 pb-6 pt-4">
        {formUrl ? (
          <a
            href={formUrl}
            className="flex min-h-16 w-full items-center justify-center gap-2.5 rounded-full bg-navy-800 px-7 shadow-level1 transition active:scale-[0.98]"
          >
            <span className="text-[17px] font-semibold text-white">Register for Unity Sunday</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : (
          <div className="flex min-h-16 w-full flex-col items-center justify-center rounded-full border-[1.5px] border-blue-100 bg-white px-6 py-3 text-center">
            <span className="text-[17px] font-semibold leading-tight text-navy-800">Registration isn&apos;t set up yet</span>
            <span className="mt-0.5 text-sm leading-tight text-ink-muted">Please see someone at the welcome desk</span>
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
