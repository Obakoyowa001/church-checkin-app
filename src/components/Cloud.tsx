import { CLOUD_PATH, CLOUD_VIEWBOX } from '@/lib/cloudShape';

// Reusable cloud-device silhouette (PRD §5). One shape, used as a solid
// fill, a faint tint, or a hairline outline depending on context.
export default function Cloud({
  className,
  style,
  fill = '#80ACF8',
  fillOpacity = 1,
  outline = false,
  flip = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  fill?: string;
  fillOpacity?: number;
  outline?: boolean;
  flip?: boolean;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox={CLOUD_VIEWBOX}
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <path
        d={CLOUD_PATH}
        fill={outline ? 'none' : fill}
        fillOpacity={outline ? undefined : fillOpacity}
        stroke={outline ? fill : undefined}
        strokeWidth={outline ? 1 : undefined}
        strokeOpacity={outline ? fillOpacity : undefined}
        transform={flip ? 'scale(-1,1) translate(-194,0)' : undefined}
      />
    </svg>
  );
}
