"use client";

import Link from "next/link";
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  ListTree,
  PlugZap,
  Settings,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { key: "studio", label: "Studio", icon: LayoutDashboard },
  { key: "edit", label: "Details", icon: Settings },
  { key: "curriculum", label: "Curriculum", icon: ListTree },
  { key: "assessments", label: "Assessments", icon: ClipboardCheck },
  { key: "interoperability", label: "Interop", icon: PlugZap },
  { key: "students", label: "Learners", icon: Users },
  { key: "insights", label: "Insights", icon: BarChart3 },
];

function hrefFor(courseId: string, key: string) {
  if (key === "edit") return `/dashboard/courses/${courseId}/edit`;
  return `/dashboard/courses/${courseId}/${key}`;
}

export function CourseManagementNav({ courseId }: { courseId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Course management"
      className="flex gap-2 overflow-x-auto border-b pb-3"
    >
      {items.map((item) => {
        const href = hrefFor(courseId, item.key);
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
            )}
          >
            <item.icon
              className={cn("h-4 w-4", active && "text-primary")}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
