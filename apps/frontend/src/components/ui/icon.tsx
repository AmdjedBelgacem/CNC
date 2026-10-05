import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Book,
  BookOpen,
  Bot,
  Box,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  CloudCog,
  Cog,
  Cpu,
  Eye,
  Factory,
  Gauge,
  Globe,
  GraduationCap,
  Grid2x2,
  Hammer,
  IdCard,
  LayoutList,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  Monitor,
  Moon,
  PackageCheck,
  Plus,
  Radar,
  Radio,
  Rocket,
  Ruler,
  School,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Star,
  Ticket,
  Trophy,
  Truck,
  Terminal,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Every icon in the product comes from lucide-react.
 *
 * The builder stores Material Symbols ligature names in saved layouts, so those
 * strings are still the canonical key — this map translates them to the lucide
 * equivalent. `resolveIcon()` never returns undefined: an unknown key falls back
 * to CircleHelp so a stale layout renders a placeholder instead of crashing.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // Material Symbols names persisted in builder layouts
  search: Search,
  expand_more: ChevronDown,
  groups: Users,
  group: Users,
  verified: BadgeCheck,
  verified_user: ShieldCheck,
  public: Users,
  monetization_on: TrendingUp,
  trending_up: TrendingUp,
  precision_manufacturing: Factory,
  settings_suggest: Settings2,
  robot_2: Bot,
  biotech: Sparkles,
  history_edu: BookOpen,
  terminal: Terminal,
  add: Plus,
  arrow_forward: ArrowRight,
  arrow_upward: ArrowUp,
  factory: Factory,
  cog: Cog,
  cpu: Cpu,
  rocket: Rocket,
  'graduation-cap': GraduationCap,
  moon: Moon,
  school: School,
  book: Book,
  wrench: Wrench,
  check: BadgeCheck,
  star: Star,
  bolt: Zap,
  menu: Menu,
  // Baroot CNC Solutions landing glyphs
  view_in_ar: Box,
  tune: SlidersHorizontal,
  speed: Gauge,
  radar: Radar,
  architecture: Ruler,
  memory: Cpu,
  sensors: Radio,
  cloud_sync: CloudCog,
  language: Globe,
  north_east: TrendingUp,
  // Literal names used directly in admin screens
  badge: IdCard,
  admin_panel_settings: ShieldCheck,
  shield_lock: ShieldCheck,
  lock_clock: Lock,
  view_list: LayoutList,
  grid_view: Grid2x2,
  person_add: UserPlus,
  edit: SquarePen,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  more_horiz: Menu,
  visibility: Eye,
  gauge: Gauge,
  hammer: Hammer,
  // Redesigned marketing sections
  local_shipping: Truck,
  inventory_2: PackageCheck,
  forum: MessageCircle,
  emoji_events: Trophy,
  event: CalendarDays,
  event_available: CalendarCheck,
  confirmation_number: Ticket,
  monitor: Monitor,
  location_on: MapPin,
  clock: Clock,
  auto_awesome: Sparkles,
  radio: Radio,
  calendar: Calendar,
};

export function resolveIcon(name?: string | null): LucideIcon {
  if (!name) return CircleHelp;
  return ICON_MAP[name] ?? CircleHelp;
}

export interface IconProps {
  /** Material Symbols / ICON_KEYS name stored in content or passed by a screen. */
  name?: string | null;
  className?: string;
  /** Rendered size in px; ignored when `className` sets its own size. */
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, className, size, strokeWidth, style }: IconProps) {
  const Cmp = resolveIcon(name);
  return (
    <Cmp
      className={className}
      style={style}
      {...(size ? { size } : {})}
      {...(strokeWidth ? { strokeWidth } : {})}
      aria-hidden="true"
    />
  );
}

export default Icon;
