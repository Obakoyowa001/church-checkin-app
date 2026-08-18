import { BADGE_INNER_PATH, BADGE_OUTER_PATH } from '@/lib/badgeShapes';

// Same scalloped badge shape as WelcomeBadge, but with a drawn-in
// checkmark instead of lettering — used on the check-in success screen
// so it reads as a continuation of the same brand moment, not a
// generic checkmark-in-a-circle.
export default function CheckBadge({ size = 180 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 300 300" className="absolute inset-0 animate-badge-pop">
        <path d={BADGE_OUTER_PATH} fill="#3D66D6" />
        <path d={BADGE_INNER_PATH} fill="#122761" />
        <path
          className="animate-draw-check"
          d="M108 152 L138 182 L196 118"
          stroke="#FBF8F3"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      <svg
        className="absolute top-1.5 right-0 animate-sparkle-pop-1"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#EFB239" />
      </svg>
      <svg
        className="absolute bottom-5 -left-1.5 animate-sparkle-pop-2"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#E8582C" />
      </svg>
      <svg
        className="absolute top-8 -left-3.5 animate-sparkle-pop-3"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#EFB239" />
      </svg>
    </div>
  );
}
