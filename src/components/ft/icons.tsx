import type { SVGProps } from "react";

/**
 * The icon set drawn for the redesign. Plain strokes at 24x24 so every
 * one inherits `currentColor` and sizes with width/height.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function Svg({ size = 24, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 18V6H2v12h2" />
    <path d="M14 9h4l4 4v5h-2" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
    <path d="M9 18h6" />
  </Svg>
);
export const ClipboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1" />
    <path d="M9 11h6M9 15h4" />
  </Svg>
);
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);
export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </Svg>
);
export const RupeeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10" />
  </Svg>
);
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const MinusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const BackIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg strokeWidth={2.8} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2 21h20L12 3Z" />
    <path d="M12 10v4M12 17.5v.5" />
  </Svg>
);
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const MicIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
  </Svg>
);
export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
    <circle cx="12" cy="13" r="4" />
  </Svg>
);
export const PrinterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </Svg>
);
export const WhatsAppIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z" />
    <path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1.2-1.2 1.8.9-.4 1.6c-3.6.4-7.8-3.8-7.4-7.4l1.6-.4.9 1.8Z" />
  </Svg>
);
export const FileIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H6v18h12V7Z" />
    <path d="M14 3v4h4M9 13h6M9 17h6" />
  </Svg>
);
export const SpeakerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9h4l5-4v14l-5-4H4Z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
/** A tied sack: the physical bag everyone handles. */
export const SackIcon = ({ fill = "none", ...p }: IconProps) => (
  <Svg {...p} fill={fill}>
    <path d="M8 4h8l-1.5 3h-5Z" />
    <path d="M9.5 7C5 9 4 13 4 16a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5c0-3-1-7-5.5-9" />
  </Svg>
);
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const XIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

/* Product pictograms for the count tiles; picked by product category. */
export const ProductDotsIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <circle cx="8" cy="9" r="2.5" />
    <circle cx="15" cy="8" r="2.5" />
    <circle cx="11" cy="15" r="2.5" />
    <circle cx="17" cy="15" r="2" />
  </Svg>
);
export const ProductBiscuitIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M12 10h.01M17 10h.01M7 14h.01M12 14h.01M17 14h.01" />
  </Svg>
);
export const ProductBarIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="3" y="7" width="18" height="10" rx="5" />
    <path d="M8 12h8" />
  </Svg>
);
export const ProductWaferIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 8v8M11 8v8M15 8v8" />
  </Svg>
);
export const ProductGridIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 10h16M4 15h16M10 4v16M15 4v16" />
  </Svg>
);
export const ProductBlockIcon = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M5 9h14M5 15h14M12 3v18" />
  </Svg>
);
/** Own godown / warehouse. */
export const WarehouseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21V9l9-5 9 5v12" />
    <path d="M7 21v-8h10v8" />
    <path d="M7 17h10" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);
export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Svg>
);
export const BuildingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V5l8-2v18M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01M3 21h18" />
  </Svg>
);
export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </Svg>
);
export const PeopleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3 6" />
  </Svg>
);
export const ShopIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9h16l-1-5H5L4 9Z" />
    <path d="M5 9v11h14V9M9 20v-6h6v6" />
  </Svg>
);
export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Svg>
);
export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
