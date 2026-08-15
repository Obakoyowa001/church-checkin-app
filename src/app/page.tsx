import Link from 'next/link';

// Force dynamic rendering so NEW_MEMBER_FORM_URL is read fresh on every
// request rather than baked into a statically-prerendered page at build
// time — otherwise updating the env var wouldn't take effect without a
// full rebuild.
export const dynamic = 'force-dynamic';

export default function Home() {
  const newMemberFormUrl = process.env.NEW_MEMBER_FORM_URL;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-teal-deep sm:text-4xl">Welcome!</h1>
        <p className="mt-2 text-lg text-ink/70">Have you visited with us before?</p>

        <div className="mt-10 flex flex-col gap-5">
          <Link
            href="/checkin"
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-3xl bg-teal px-6 py-6 text-cream shadow-lg transition active:scale-[0.98]"
          >
            <CheckBadgeIcon />
            <span className="text-2xl font-semibold">I&apos;ve been here before</span>
            <span className="text-base text-cream/80">Find your name and check in</span>
          </Link>

          {newMemberFormUrl ? (
            <a
              href={newMemberFormUrl}
              className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-3xl bg-amber px-6 py-6 text-cream shadow-lg transition active:scale-[0.98]"
            >
              <SparkleIcon />
              <span className="text-2xl font-semibold">This is my first time</span>
              <span className="text-base text-cream/80">Fill out a quick guest form</span>
            </a>
          ) : (
            <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-3xl bg-amber/10 px-6 py-6 text-center">
              <SparkleIcon className="text-amber" />
              <span className="text-xl font-semibold text-ink">First time here?</span>
              <span className="text-base text-ink/70">Please see someone at the welcome desk.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
      <path
        d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-9 w-9 ${className}`} aria-hidden="true">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
