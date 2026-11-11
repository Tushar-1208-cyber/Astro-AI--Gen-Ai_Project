"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Users,
  BookOpen,
  CheckCircle,
  BarChart3,
  Calendar,
  Sparkles,
  Video,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";

export function DashboardQuickActions() {
  const { t } = useLanguage();

  const actions = [
    {
      title: t("dashboard_action_takeAttendance") || "Take Attendance",
      description: "AI camera or manual roll-call",
      icon: CheckCircle,
      href: "/attendance",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white",
    },
    {
      title: t("dashboard_action_recordGrade") || "Record Grades",
      description: "Log scores and tracking curves",
      icon: BarChart3,
      href: "/grade-tracking",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white",
    },
    {
      title: t("dashboard_action_createLessonPlan") || "AI Lesson Planner",
      description: "Generate structured plans instantly",
      icon: BookOpen,
      href: "/lesson-planner",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white",
    },
    {
      title: t("dashboard_action_scheduleLesson") || "Schedule Lesson",
      description: "Calendar deadlines & lectures",
      icon: Calendar,
      href: "/calendar",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white",
    },
    {
      title: t("dashboard_action_askAstro") || "Ask Astro AI",
      description: "Academic AI mentor assistant",
      icon: Sparkles,
      href: "/ask-astro",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white",
    },
    {
      title: t("dashboard_action_smartClass") || "Smart Class Library",
      description: "Recordings & video research",
      icon: Video,
      href: "/smart-class",
      badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500 group-hover:text-white",
    },
    {
      title: t("dashboard_action_studentRoster") || "Student Roster",
      description: "Manage enrolled student profiles",
      icon: Users,
      href: "/student-roster",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("dashboard_quickActions") || "Quick Tools & Actions"}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fast shortcuts to launch primary educator workflows and tools.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {actions.map((action, idx) => (
          <Link key={idx} href={action.href} className="group focus:outline-none">
            <Card className="h-full border border-border/60 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40 relative overflow-hidden group-hover:-translate-y-0.5">
              <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1 pr-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg transition-colors duration-200 ${action.badgeColor}`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">
                      {action.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground pt-1 line-clamp-1">
                    {action.description}
                  </CardDescription>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
