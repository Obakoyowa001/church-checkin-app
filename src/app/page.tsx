import Link from 'next/link';
import Image from 'next/image';
import Cloud from '@/components/Cloud';

// Force dynamic rendering so NEW_MEMBER_FORM_URL is read fresh on every
// request rather than baked into a statically-prerendered page at build
// time — otherwise updating the env var wouldn't take effect without a
// full rebuild.
export const dynamic = 'force-dynamic';

export default function Home() {
  const newMemberFormUrl = process.env.NEW_MEMBER_FORM_URL;

  return (
    <div className="flex min-h-dvh flex-col items-center bg-sky">
      <div className="relative flex w-full max-w-md flex-1 flex-col overflow-hidden px-6 pb-6 pt-8 sm:max-w-lg sm:px-10">
        <div className="fu-1 flex min-h-0 flex-1 items-center justify-center py-4">
          <Image
            src="/welcome-badge.png"
            alt="Welcome to Christ Tribe"
            width={500}
            height={500}
            priority
            className="h-auto w-[216px] sm:w-[260px]"
          />
        </div>

        <div className="fu-2 flex-shrink-0 text-center">
          <p className="text-[22px] font-semibold leading-snug text-navy-800 sm:text-2xl">
            Have you visited with us before?
          </p>
        </div>

        <div className="mt-6 flex flex-shrink-0 flex-col gap-3">
          {/* Glaring Prominent Unity Sunday Special Program Button */}
          <Link
            href="/unity-sunday"
            className="fu-3 group relative flex min-h-[78px] flex-col items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-[#D97706] via-[#FBBF24] to-[#F59E0B] p-[2px] shadow-[0_6px_28px_rgba(245,158,11,0.5)] transition duration-200 active:scale-[0.98] hover:shadow-[0_8px_36px_rgba(245,158,11,0.7)]"
          >
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-gradient-to-r from-[#071330] via-[#0E2459] to-[#071330] px-6 py-3.5 text-center">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                </span>
                <span className="text-[19px] font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-300 to-amber-200 sm:text-[20px] drop-shadow-sm">
                  Unity Sunday
                </span>
                <span className="rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 border border-amber-300/40">
                  Oct 4th
                </span>
              </div>
              <span className="mt-1 text-[13px] font-semibold text-amber-200/90 sm:text-sm">
                Special Program &bull; Register or Check Your Name &rarr;
              </span>
            </div>
          </Link>

          <Link
            href="/checkin"
            className="fu-4 flex min-h-[64px] flex-col items-center justify-center rounded-full bg-navy-800 px-6 py-3 text-center shadow-level1 transition active:scale-[0.98]"
          >
            <span className="text-[17px] font-semibold leading-tight text-white">I&apos;ve been here before</span>
            <span className="mt-0.5 text-sm leading-tight text-white/[0.72]">Find your name</span>
          </Link>

          {newMemberFormUrl ? (
            <a
              href={newMemberFormUrl}
              className="fu-4 flex min-h-[64px] flex-col items-center justify-center rounded-full border-[1.5px] border-blue-100 bg-white px-6 py-3 text-center transition active:scale-[0.98]"
            >
              <span className="text-[17px] font-semibold leading-tight text-navy-800">This is my first time</span>
              <span className="mt-0.5 text-sm leading-tight text-ink-muted">Fill a quick form</span>
            </a>
          ) : (
            <div className="fu-4 flex min-h-[64px] flex-col items-center justify-center rounded-full border-[1.5px] border-blue-100 bg-white px-6 py-3 text-center">
              <span className="text-[17px] font-semibold leading-tight text-navy-800">First time here?</span>
              <span className="mt-0.5 text-sm leading-tight text-ink-muted">Please see someone at the welcome desk</span>
            </div>
          )}
        </div>

        <p className="fu-4 mt-5 flex-shrink-0 text-center text-sm leading-tight">
          <span className="font-semibold text-red-500">Need help?</span>
          <span className="text-ink-muted"> Ask a team member.</span>
        </p>

        <div className="pointer-events-none absolute -bottom-12 -left-12 h-[158px] w-[220px]" aria-hidden="true">
          <Cloud fill="#80ACF8" fillOpacity={0.2} />
        </div>
      </div>
    </div>
  );
}
