"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The builder's icon set — Phosphor, filled.
//
// Filled rather than outlined because these icons are almost all small (9–17px)
// and almost all load-bearing: a 10px outline glyph in a toolbar is a few thin
// strokes that read as texture rather than as a symbol. Filled shapes survive
// that size, which matters more here than usual — the per-section toolbars are
// icon-only, so the glyph IS the label.
//
// Re-exported under the names the builder already used rather than renamed at
// every call site. Roughly five hundred usages across seventeen files stay
// exactly as they were; each file changes one import line. That also keeps the
// vocabulary in one place: if "Stay" should stop being a building, it changes
// here and everywhere at once.
//
// `weight` is applied before the spread, so any single usage can still override
// it — see Spinner below, which would be a solid disc at fill weight.
// ─────────────────────────────────────────────────────────────────────────────

// Named imports, not `import * as`. The root barrel re-exports ~1500 icons;
// pulling it in wholesale defeats tree-shaking and took the production build
// from ~30s to over ten minutes. Named imports let Next rewrite each one to
// its own module.
//
// All aliased, because half of these collide with the name this module
// re-exports them under — Phosphor's Car is exported here as Car.
import {
  AirplaneTilt as PhAirplaneTilt,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowDown as PhArrowDown,
  ArrowLeft as PhArrowLeft,
  ArrowLineLeft as PhArrowLineLeft,
  ArrowLineRight as PhArrowLineRight,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowUUpLeft as PhArrowUUpLeft,
  ArrowUUpRight as PhArrowUUpRight,
  ArrowUp as PhArrowUp,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsDownUp as PhArrowsDownUp,
  Baby as PhBaby,
  Bed as PhBed,
  BowlSteam as PhBowlSteam,
  Buildings as PhBuildings,
  Bus as PhBus,
  Calendar as PhCalendar,
  CalendarDots as PhCalendarDots,
  CalendarPlus as PhCalendarPlus,
  Car as PhCar,
  CaretDown as PhCaretDown,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  ChatText as PhChatText,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CircleNotch as PhCircleNotch,
  Clipboard as PhClipboard,
  Clock as PhClock,
  ShieldCheck as PhShieldCheck,
  Coffee as PhCoffee,
  Compass as PhCompass,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  Calculator as PhCalculator,
  CurrencyInr as PhCurrencyInr,
  DotsSixVertical as PhDotsSixVertical,
  DotsThree as PhDotsThree,
  DownloadSimple as PhDownloadSimple,
  Envelope as PhEnvelope,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  FlagPennant as PhFlagPennant,
  FloppyDisk as PhFloppyDisk,
  ForkKnife as PhForkKnife,
  FunnelSimple as PhFunnelSimple,
  Gift as PhGift,
  Image as PhImage,
  Info as PhInfo,
  Lightning as PhLightning,
  ListChecks as PhListChecks,
  ListNumbers as PhListNumbers,
  Lock as PhLock,
  MagicWand as PhMagicWand,
  MagnifyingGlass as PhMagnifyingGlass,
  MapPin as PhMapPin,
  Moon as PhMoon,
  MoonStars as PhMoonStars,
  Note as PhNote,
  Package as PhPackage,
  PaperPlaneTilt as PhPaperPlaneTilt,
  PencilSimple as PhPencilSimple,
  PencilSimpleLine as PhPencilSimpleLine,
  Percent as PhPercent,
  Phone as PhPhone,
  Plus as PhPlus,
  SignIn as PhSignIn,
  SignOut as PhSignOut,
  Sparkle as PhSparkle,
  Star as PhStar,
  Sun as PhSun,
  Ticket as PhTicket,
  Train as PhTrain,
  Trash as PhTrash,
  UploadSimple as PhUploadSimple,
  User as PhUser,
  Users as PhUsers,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  WarningOctagon as PhWarningOctagon,
  X as PhX,
  XCircle as PhXCircle,
} from "@phosphor-icons/react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";
// Phosphor has no helicopter, and every near-miss (Drone, AirplaneTakeoff)
// would say something the itinerary doesn't mean. One outline glyph among the
// filled ones is the smaller error than a wrong one.
export { Helicopter } from "lucide-react";

function filled(
  Icon: React.ComponentType<IconProps>,
  weight: IconWeight = "fill",
): React.ComponentType<IconProps> {
  const C = (props: IconProps) => <Icon weight={weight} {...props} />;
  C.displayName = `Filled(${Icon.displayName ?? "Icon"})`;
  return C;
}

// ── Navigation and chrome ───────────────────────────────────────────────────
export const ArrowLeft = filled(PhArrowLeft);
export const ArrowRight = filled(PhArrowRight);
export const ArrowUp = filled(PhArrowUp);
export const ArrowDown = filled(PhArrowDown);
export const ArrowUpDown = filled(PhArrowsDownUp);
export const ChevronDown = filled(PhCaretDown);
export const ChevronDownIcon = filled(PhCaretDown);
export const ChevronRight = filled(PhCaretRight);
export const ChevronUp = filled(PhCaretUp);
export const MoreHorizontal = filled(PhDotsThree, "bold");
export const GripVertical = filled(PhDotsSixVertical);
export const X = filled(PhX, "bold");
export const XIcon = filled(PhX, "bold");
export const XCircle = filled(PhXCircle);
export const Search = filled(PhMagnifyingGlass, "bold");
export const SearchIcon = filled(PhMagnifyingGlass, "bold");
export const Sliders = filled(PhFunnelSimple);
export const ExternalLink = filled(PhArrowSquareOut);
export const Plus = filled(PhPlus, "bold");

// Collapse/expand: Phosphor's SidebarSimple is the same glyph whichever way a
// panel is going, which is the one thing these buttons need to distinguish.
// A line-arrow says which direction the panel travels.
export const PanelLeftClose = filled(PhArrowLineLeft, "bold");
export const PanelLeftOpen = filled(PhArrowLineRight, "bold");
export const PanelRightClose = filled(PhArrowLineRight, "bold");
export const PanelRightOpen = filled(PhArrowLineLeft, "bold");

// ── Status ──────────────────────────────────────────────────────────────────
export const AlertCircle = filled(PhWarningCircle);
export const AlertTriangle = filled(PhWarning);
export const AlertOctagon = filled(PhWarningOctagon);
export const CheckCircle = filled(PhCheckCircle);
export const CheckIcon = filled(PhCheck, "bold");
export const Info = filled(PhInfo);
export const Lock = filled(PhLock);
export const Clock = filled(PhClock);
/** Costing's own banner — "this is with you for review". */
export const ShieldCheck = filled(PhShieldCheck);
export const ChatText = filled(PhChatText);
/** Bold, not fill: a filled CircleNotch is a solid disc with no gap to spin. */
export const Loader2 = filled(PhCircleNotch, "bold");

// ── Actions ─────────────────────────────────────────────────────────────────
export const Pencil = filled(PhPencilSimple);
export const PencilLine = filled(PhPencilSimpleLine);
export const Trash2 = filled(PhTrash);
export const Copy = filled(PhCopy);
export const ClipboardPaste = filled(PhClipboard);
export const Download = filled(PhDownloadSimple, "bold");
export const Upload = filled(PhUploadSimple, "bold");
export const Save = filled(PhFloppyDisk);
export const Send = filled(PhPaperPlaneTilt);
export const Repeat = filled(PhArrowsClockwise, "bold");
export const RotateCcw = filled(PhArrowCounterClockwise, "bold");
export const Undo2 = filled(PhArrowUUpLeft, "bold");
export const Redo2 = filled(PhArrowUUpRight, "bold");
export const Wand2 = filled(PhMagicWand);
export const LogIn = filled(PhSignIn);
export const LogOut = filled(PhSignOut);
export const Eye = filled(PhEye);
export const EyeOff = filled(PhEyeSlash);

// ── Travel ──────────────────────────────────────────────────────────────────
export const Hotel = filled(PhBuildings);
export const BedDouble = filled(PhBed);
export const Car = filled(PhCar);
export const Bus = filled(PhBus);
export const Plane = filled(PhAirplaneTilt);
export const TrainFront = filled(PhTrain);
export const MapPin = filled(PhMapPin);
export const Compass = filled(PhCompass);
export const Milestone = filled(PhFlagPennant);
export const Ticket = filled(PhTicket);
export const Package = filled(PhPackage);
export const Gift = filled(PhGift);
export const Sparkles = filled(PhSparkle);
export const Star = filled(PhStar);
export const Zap = filled(PhLightning);

// ── People and money ────────────────────────────────────────────────────────
export const User = filled(PhUser);
export const Users = filled(PhUsers);
export const Baby = filled(PhBaby);
export const IndianRupee = filled(PhCurrencyInr, "bold");
export const Calculator = filled(PhCalculator);
export const Percent = filled(PhPercent, "bold");
export const CreditCard = filled(PhCreditCard);
export const Mail = filled(PhEnvelope);
export const Phone = filled(PhPhone);

// ── Dates and time of day ───────────────────────────────────────────────────
export const Calendar = filled(PhCalendar);
export const CalendarDays = filled(PhCalendarDots);
export const CalendarPlus = filled(PhCalendarPlus);
export const Sun = filled(PhSun);
export const Moon = filled(PhMoon);
export const MoonStar = filled(PhMoonStars);

// ── Food ────────────────────────────────────────────────────────────────────
export const Coffee = filled(PhCoffee);
export const Soup = filled(PhBowlSteam);
export const Utensils = filled(PhForkKnife);
export const UtensilsCrossed = filled(PhForkKnife);

// ── Misc ────────────────────────────────────────────────────────────────────
export const StickyNote = filled(PhNote);
export const ListChecks = filled(PhListChecks);
export const ListOrdered = filled(PhListNumbers);
export const Image = filled(PhImage);
export const ImageIcon = filled(PhImage);
