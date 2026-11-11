"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/context/language-context";

interface DashboardHeaderProps {
  userName?: string;
  lastUpdated: Date;
  isLoading: boolean;
  onRefresh: () => void;
}

export function DashboardHeader({
  userName,
  lastUpdated,
  isLoading,
  onRefresh,
}: DashboardHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t("dashboard_title") || "Teacher Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard_welcome") || "Welcome back"}
          {userName ? `, ${userName}` : ""}!{" "}
          {t("dashboard_subtitle") || "Here is your classroom overview and performance analytics."}
        </p>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-normal">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{format(lastUpdated, "HH:mm:ss")}</span>
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>{t("dashboard_refresh") || "Refresh"}</span>
        </Button>
      </div>
    </div>
  );
}
