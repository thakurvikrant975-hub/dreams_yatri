import {
  Navigation,
  Shield,
  RefreshCw,
  FileText,
  CreditCard,
  AlertCircle,
  Camera,
  Wifi,
} from "lucide-react";

export const ISSUE_CATEGORIES = [
  {
    icon: Navigation,
    title: "Transfer & Transport",
    desc: "Cab not arrived, route changes, driver issues, vehicle problems.",
    action: "Get help",
    href: "tel:+917023907099",
  },
  {
    icon: Shield,
    title: "Hotel & Accommodation",
    desc: "Room issues, check-in problems, hotel not as booked, amenity concerns.",
    action: "Get help",
    href: "tel:+917023907099",
  },
  {
    icon: RefreshCw,
    title: "Cancellations & Refunds",
    desc: "Trip cancellation, refund status, date change requests, amendment fees.",
    action: "Get help",
    href: "mailto:support@dreamsyatri.com",
  },
  {
    icon: FileText,
    title: "Documents & Vouchers",
    desc: "Missing hotel vouchers, guide confirmation, permit documents, booking proof.",
    action: "Get help",
    href: "mailto:support@dreamsyatri.com",
  },
  {
    icon: CreditCard,
    title: "Payments & Billing",
    desc: "Payment not reflected, duplicate charge, invoice request, GST certificate.",
    action: "Get help",
    href: "mailto:support@dreamsyatri.com",
  },
  {
    icon: AlertCircle,
    title: "On-Trip Emergency",
    desc: "Medical emergency, natural disruption, safety concern, immediate assistance needed.",
    action: "Call now",
    href: "tel:+917023907099",
  },
  {
    icon: Camera,
    title: "Itinerary Changes",
    desc: "Add/remove activities, extend stay, change hotel preference, route modification.",
    action: "Get help",
    href: "tel:+917023907023",
  },
  {
    icon: Wifi,
    title: "Connectivity & Guides",
    desc: "Local guide not available, SIM or data issues, language barrier at destination.",
    action: "Get help",
    href: "tel:+917023907099",
  },
];