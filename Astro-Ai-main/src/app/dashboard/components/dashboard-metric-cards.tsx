"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  BarChart3,
  CheckCircle,
  Calendar,
  BookOpen,
  Video,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";

export interface DashboardMetricCardsProps {
  totalStudents: number;
  totalGrades: number;
  averageGrade: number | null;
  hasGrades: boolean;
  upcomingEvents: number;
  totalRecordings: number;
  lessonsThisMonth: number;
  attendanceRate: number | null;
  totalAttendanceSessions: number;
  hasAttendance: boolean;
}

export function DashboardMetricCards({
  totalStudents,
  totalGrades,
  averageGrade,
  hasGrades,
  upcomingEvents,
  totalRecordings,
  lessonsThisMonth,
  attendanceRate,
  totalAttendanceSessions,
  hasAttendance,
}: DashboardMetricCardsProps) {
  const { t } = useLanguage();

  const notAvailableText = t("dashboard_notAvailable") || "N/A";

  const getGradePerformanceBadge = () => {
    if (!hasGrades || averageGrade === null) return null;
    if (averageGrade >= 80) {
      return (
        <Badge variant="outline" className="text-[11px] font-medium border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20">
          <TrendingUp className="h-3 w-3 mr-1 inline text-emerald-500" />
          Excellent
        </Badge>
      );
    }
    if (averageGrade >= 70) {
      return (
        <Badge variant="outline" className="text-[11px] font-medium border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20">
          Good
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[11px] font-medium border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20">
        <AlertCircle className="h-3 w-3 mr-1 inline text-amber-500" />
        Needs Work
      </Badge>
    );
  };

  const getAttendanceBadge = () => {
    if (!hasAttendance || attendanceRate === null) return null;
    if (attendanceRate >= 80) {
      return (
        <Badge variant="outline" className="text-[11px] font-medium border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20">
          On Track
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[11px] font-medium border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20">
        Attention
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Primary Metrics (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Students */}
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard_totalStudents") || "Total Students"}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalStudents > 0
                ? (t("dashboard_totalStudents_desc") || "Enrolled in active roster")
                : "No students registered"}
            </p>
          </CardContent>
        </Card>

        {/* Class Average Grade */}
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard_avgGrade") || "Class Average Grade"}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold tracking-tight">
                {hasGrades && averageGrade !== null ? `${averageGrade}%` : notAvailableText}
              </div>
              {getGradePerformanceBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasGrades
                ? `${totalGrades} submissions recorded`
                : (t("dashboard_avgGrade_desc") || "Across verified graded assignments")}
            </p>
          </CardContent>
        </Card>

        {/* Average Attendance Rate */}
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard_attendanceRate") || "Average Attendance Rate"}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold tracking-tight">
                {hasAttendance && attendanceRate !== null ? `${attendanceRate}%` : notAvailableText}
              </div>
              {getAttendanceBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasAttendance
                ? attendanceRate !== null
                  ? `${totalAttendanceSessions} sessions recorded`
                  : "Historical roster unavailable"
                : (t("dashboard_attendanceRate_desc") || "Across completed attendance sessions")}
            </p>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard_upcomingEvents") || "Upcoming Events"}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{upcomingEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingEvents > 0
                ? (t("dashboard_upcomingEvents_desc") || "On your academic calendar")
                : "No upcoming events scheduled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics (2 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Lessons This Month */}
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard_lessonsThisMonth") || "Lessons This Month"}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{lessonsThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard_lessonsThisMonth_desc") || "Curriculum lessons scheduled this month"}
            </p>
          </CardContent>
        </Card>

        {/* Class Recordings */}
        <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard_totalRecordings") || "Class Recordings"}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Video className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{totalRecordings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard_totalRecordings_desc") || "Smart Class video archive"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
