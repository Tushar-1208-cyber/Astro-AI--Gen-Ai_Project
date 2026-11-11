"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Calendar,
  Video,
  CheckCircle,
  BookOpen,
  Activity,
  Clock,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { useLanguage } from "@/context/language-context";

export interface ActivityItem {
  id: string;
  type: "lesson" | "grade" | "event" | "recording" | "attendance";
  title: string;
  date: Date;
  icon?: any;
  color?: string;
}

interface DashboardRecentActivityProps {
  activities: ActivityItem[];
}

export function DashboardRecentActivity({ activities }: DashboardRecentActivityProps) {
  const { t } = useLanguage();

  const getActivityVisuals = (type: string) => {
    switch (type) {
      case "grade":
        return {
          icon: BarChart3,
          textColor: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-500/10",
          badge: "Grade",
        };
      case "event":
        return {
          icon: Calendar,
          textColor: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-500/10",
          badge: "Calendar",
        };
      case "recording":
        return {
          icon: Video,
          textColor: "text-purple-600 dark:text-purple-400",
          bgColor: "bg-purple-500/10",
          badge: "Smart Class",
        };
      case "attendance":
        return {
          icon: CheckCircle,
          textColor: "text-teal-600 dark:text-teal-400",
          bgColor: "bg-teal-500/10",
          badge: "Attendance",
        };
      case "lesson":
        return {
          icon: BookOpen,
          textColor: "text-indigo-600 dark:text-indigo-400",
          bgColor: "bg-indigo-500/10",
          badge: "Lesson",
        };
      default:
        return {
          icon: Activity,
          textColor: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-500/10",
          badge: "Activity",
        };
    }
  };

  const formatActivityTime = (date: Date) => {
    try {
      if (isToday(date)) {
        return `Today at ${format(date, "HH:mm")}`;
      }
      if (isTomorrow(date)) {
        return `Tomorrow at ${format(date, "HH:mm")}`;
      }
      return format(date, "MMM d, yyyy · HH:mm");
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("dashboard_recentActivity") || "Recent Classroom Activity"}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audited chronological events across your active classroom sessions.
        </p>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Latest Updates</CardTitle>
              <CardDescription className="text-xs">
                Most recent 6 records across attendance, grades, calendar, and media
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              {activities.length} item{activities.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {activities.length > 0 ? (
            <div className="divide-y divide-border/30">
              {activities.map((activity) => {
                const visuals = getActivityVisuals(activity.type);
                const IconComponent = visuals.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3.5 py-3 first:pt-1 last:pb-1"
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${visuals.bgColor} ${visuals.textColor}`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {activity.title}
                        </p>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 shrink-0 font-normal">
                          {visuals.badge}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3 inline text-muted-foreground/60" />
                        <span>{formatActivityTime(activity.date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">
                {t("dashboard_noRecentActivity") || "No recent activity recorded yet."}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Activities will appear here automatically when you mark attendance, assign grades, plan lessons, or upload recordings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
