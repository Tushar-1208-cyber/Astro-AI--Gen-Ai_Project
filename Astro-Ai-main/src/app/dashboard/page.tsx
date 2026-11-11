"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { getDashboardStatsAction } from "@/lib/actions";
import { DashboardHeader } from "./components/dashboard-header";
import { DashboardSkeleton } from "./components/dashboard-skeleton";
import { DashboardMetricCards } from "./components/dashboard-metric-cards";
import { DashboardCharts } from "./components/dashboard-charts";
import { DashboardQuickActions } from "./components/dashboard-quick-actions";
import { DashboardRecentActivity, ActivityItem } from "./components/dashboard-recent-activity";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";

interface DashboardStatsState {
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
  recentActivity: ActivityItem[];
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const { authStatus, user } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStatsState>({
    totalStudents: 0,
    totalGrades: 0,
    averageGrade: null,
    hasGrades: false,
    upcomingEvents: 0,
    totalRecordings: 0,
    lessonsThisMonth: 0,
    attendanceRate: null,
    totalAttendanceSessions: 0,
    hasAttendance: false,
    recentActivity: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const toValidDate = (d: any): Date => {
    if (d instanceof Date) return d;
    if (typeof d === "string" || typeof d === "number") return new Date(d);
    if (d && typeof d.toDate === "function") return d.toDate();
    if (d && typeof d._seconds === "number") return new Date(d._seconds * 1000);
    return new Date();
  };

  const fetchDashboardData = useCallback(async () => {
    if (authStatus !== "authenticated" || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await getDashboardStatsAction();

      if (result.success && result.data) {
        const data = result.data as any;

        let recentActivity: ActivityItem[] = [];
        if (Array.isArray(data.recentActivity)) {
          recentActivity = data.recentActivity.map((act: any) => ({
            id: String(act.id || Math.random().toString(36).substring(7)),
            type: act.type,
            title: act.title,
            date: toValidDate(act.date),
          }));
        }

        setStats({
          totalStudents: data.totalStudents ?? 0,
          totalGrades: data.totalGrades ?? 0,
          averageGrade: data.averageGrade ?? null,
          hasGrades: Boolean(data.hasGrades),
          upcomingEvents: data.upcomingEvents ?? 0,
          totalRecordings: data.totalRecordings ?? 0,
          lessonsThisMonth: data.lessonsThisMonth ?? 0,
          attendanceRate: data.attendanceRate ?? null,
          totalAttendanceSessions: data.totalAttendanceSessions ?? 0,
          hasAttendance: Boolean(data.hasAttendance),
          recentActivity,
        });
      } else {
        const errMessage = result.error || "Failed to load dashboard metrics.";
        setError(errMessage);
        toast({
          title: t("dashboard_error_title") || "Dashboard Error",
          description: errMessage,
          variant: "destructive",
        });
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      const errMessage = err?.message || "An unexpected error occurred while fetching dashboard metrics.";
      setError(errMessage);
      toast({
        title: t("dashboard_error_title") || "Dashboard Error",
        description: errMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [authStatus, user, toast, t]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Loading state
  if (authStatus === "loading" || (isLoading && !stats.recentActivity.length && !stats.totalStudents)) {
    return <DashboardSkeleton />;
  }

  // Unauthenticated state
  if (authStatus !== "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md border border-border/60 shadow-lg text-center p-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription className="text-sm mt-1">
              Please sign in with your teacher credentials to access your classroom dashboard and records.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <Link href="/login">
              <Button className="w-full">Sign In to Astro AI</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header with last updated timestamp and refresh button */}
      <DashboardHeader
        userName={user?.name}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        onRefresh={fetchDashboardData}
      />

      {/* Error Banner with Retry */}
      {error && (
        <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-200">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              className="border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 h-8 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary & Secondary Classroom Metrics */}
      <DashboardMetricCards
        totalStudents={stats.totalStudents}
        totalGrades={stats.totalGrades}
        averageGrade={stats.averageGrade}
        hasGrades={stats.hasGrades}
        upcomingEvents={stats.upcomingEvents}
        totalRecordings={stats.totalRecordings}
        lessonsThisMonth={stats.lessonsThisMonth}
        attendanceRate={stats.attendanceRate}
        totalAttendanceSessions={stats.totalAttendanceSessions}
        hasAttendance={stats.hasAttendance}
      />

      {/* Interactive Charts: Attendance Pie & Grade Performance Distribution */}
      <DashboardCharts
        hasAttendance={stats.hasAttendance}
        attendanceRate={stats.attendanceRate}
        totalAttendanceSessions={stats.totalAttendanceSessions}
        hasGrades={stats.hasGrades}
        averageGrade={stats.averageGrade}
        totalGrades={stats.totalGrades}
      />

      {/* Quick Action Shortcuts */}
      <DashboardQuickActions />

      {/* Chronological Recent Activity */}
      <DashboardRecentActivity activities={stats.recentActivity} />
    </div>
  );
}
