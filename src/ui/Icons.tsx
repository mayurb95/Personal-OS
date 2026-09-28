/** Line icons drawn to match iOS SF Symbols weight. All use currentColor. */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" strokeWidth={2.4} />
  </Svg>
)
export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)
export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" strokeWidth={2.2} />
  </Svg>
)
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
)
export const Trash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7M10 10.5v5.5M14 10.5v5.5" />
  </Svg>
)
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Svg>
)
export const Flag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 21V4.5M5.5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0" />
  </Svg>
)
export const Repeat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4" />
  </Svg>
)
export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.3V4.5a1 1 0 011-1h7.8l8.2 8.2-8.8 8.8-8.2-8.2z" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" />
  </Svg>
)
export const Folder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7a2 2 0 012-2h4l2 2.5h7a2 2 0 012 2V17a2 2 0 01-2 2h-13a2 2 0 01-2-2V7z" />
  </Svg>
)
export const Inbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 13.5l2.7-8h11.6l2.7 8V18a2 2 0 01-2 2h-13a2 2 0 01-2-2v-4.5zM3.5 13.5h5l1 2.5h5l1-2.5h5" />
  </Svg>
)
export const Sun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Svg>
)
export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)
export const Moon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" />
  </Svg>
)
export const Archive = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
    <path d="M5 9v9.5a1.5 1.5 0 001.5 1.5h11a1.5 1.5 0 001.5-1.5V9M10 13h4" />
  </Svg>
)
export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.4} />
  </Svg>
)
export const Grid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
)
export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.7-7 9-4.1-1.3-7-4.7-7-9V6.3l7-2.8z" />
    <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
  </Svg>
)
export const Ellipsis = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
)
export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.8" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4.8" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4.8" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)
export const Flame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.3 2.6-5 3.4-8.4 2 1.3 2.6 3.4 2.6 3.4S14 8 13.6 3c3.3 2.2 4.4 6.4 4.4 9.6 0 5-2.4 8.4-6 8.4z" />
  </Svg>
)
