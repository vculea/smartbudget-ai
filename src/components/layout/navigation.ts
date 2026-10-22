import {
  ArrowLeftRight,
  LayoutDashboard,
  Settings,
  Sparkles,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Tranzacții", icon: ArrowLeftRight },
  { to: "/budgets", label: "Bugete", icon: Wallet },
  { to: "/goals", label: "Obiective", icon: Target },
  { to: "/categories", label: "Categorii", icon: Tags },
  { to: "/ai-insights", label: "AI Coach", icon: Sparkles },
  { to: "/settings/ai", label: "Setări AI", icon: Settings },
];
