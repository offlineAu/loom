import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Calendar,
  CalendarRange,
  CheckSquare,
  CreditCard,
  Gem,
  HeartHandshake,
  ListTodo,
  Package,
  PiggyBank,
  Receipt,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";

/**
 * A Tracker Template is a code-level registration of a tracker TYPE (Phase 0
 * platform architecture, "Tracker Template"). This catalog is the
 * presentation-level list of every planned tracker template; only Debt
 * Tracker is `status: "available"` in this phase. Nothing here implies a
 * database-driven CMS — new tracker types ship as code.
 */
export type TrackerCategory = "personal-finance" | "business" | "productivity";

export type TrackerTemplateStatus = "available" | "coming-soon";

export interface TrackerTemplate {
  key: string;
  label: string;
  description: string;
  category: TrackerCategory;
  status: TrackerTemplateStatus;
  icon: LucideIcon;
  href?: string;
}

export const CATEGORY_LABELS: Record<TrackerCategory, string> = {
  "personal-finance": "Personal Finance",
  business: "Business",
  productivity: "Productivity",
};

export const CATEGORY_ORDER: TrackerCategory[] = [
  "personal-finance",
  "business",
  "productivity",
];

export const TRACKER_CATALOG: TrackerTemplate[] = [
  {
    key: "debt",
    label: "Debt Tracker",
    description: "Track balances, payments, and payoff progress for every debt in one place.",
    category: "personal-finance",
    status: "available",
    icon: CreditCard,
    href: "/trackers/debt",
  },
  {
    key: "monthly-budget",
    label: "Monthly Budget Tracker",
    description: "Plan income and expenses for the month ahead.",
    category: "personal-finance",
    status: "coming-soon",
    icon: Wallet,
  },
  {
    key: "weekly-budget",
    label: "Weekly Budget Tracker",
    description: "A tighter budgeting cadence for week-to-week spending.",
    category: "personal-finance",
    status: "coming-soon",
    icon: CalendarDays,
  },
  {
    key: "couple-budget",
    label: "Couple Budget Tracker",
    description: "Shared budgeting for two, built on shared-tracker membership.",
    category: "personal-finance",
    status: "coming-soon",
    icon: HeartHandshake,
  },
  {
    key: "savings",
    label: "Savings Tracker",
    description: "Track progress toward a savings goal over time.",
    category: "personal-finance",
    status: "coming-soon",
    icon: PiggyBank,
  },
  {
    key: "wedding-budget",
    label: "Wedding Budget Tracker",
    description: "Plan and track spending across every wedding category.",
    category: "personal-finance",
    status: "coming-soon",
    icon: Gem,
  },
  {
    key: "sales",
    label: "Sales Tracker",
    description: "Log sales and keep a running view of revenue.",
    category: "business",
    status: "coming-soon",
    icon: TrendingUp,
  },
  {
    key: "business-expenses",
    label: "Business Expenses Tracker",
    description: "Track and categorize day-to-day business spending.",
    category: "business",
    status: "coming-soon",
    icon: Receipt,
  },
  {
    key: "inventory",
    label: "Inventory Tracker",
    description: "Track products, stock levels, and stock movements.",
    category: "business",
    status: "coming-soon",
    icon: Package,
  },
  {
    key: "product-costing",
    label: "Product Costing Tracker",
    description: "Break down the true cost behind each product.",
    category: "business",
    status: "coming-soon",
    icon: Tag,
  },
  {
    key: "tasks",
    label: "Task Tracker",
    description: "A simple running list of tasks and their status.",
    category: "productivity",
    status: "coming-soon",
    icon: CheckSquare,
  },
  {
    key: "weekly-todo",
    label: "Weekly To-Do Planner",
    description: "Plan tasks across the days of the week.",
    category: "productivity",
    status: "coming-soon",
    icon: ListTodo,
  },
  {
    key: "monthly-calendar",
    label: "Monthly Calendar",
    description: "A month-at-a-glance view for planning ahead.",
    category: "productivity",
    status: "coming-soon",
    icon: Calendar,
  },
  {
    key: "calendar-planner",
    label: "2026 Calendar Planner",
    description: "A full-year planner for the year ahead.",
    category: "productivity",
    status: "coming-soon",
    icon: CalendarRange,
  },
];

export function getTrackersByCategory(category: TrackerCategory): TrackerTemplate[] {
  return TRACKER_CATALOG.filter((template) => template.category === category);
}

export function getTemplateByKey(key: string): TrackerTemplate | undefined {
  return TRACKER_CATALOG.find((template) => template.key === key);
}
