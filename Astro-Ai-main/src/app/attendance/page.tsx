"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Camera,
  Users,
  ListChecks,
  CheckSquare,
  Square,
  Search,
  AlertCircle,
  VideoOff,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { recognizeStudentsAction, submitAttendanceAction, getStudentsAction } from "@/lib/actions";

export default function AttendancePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [lastPhoto, setLastPhoto] = useState<string>("");
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { authStatus, user } = useAuth();

  const fetchStudents = useCallback(async () => {
    try {
      const result = await getStudentsAction();
      if (result.success && result.data) {
        setAllStudents(result.data.map((s: any) => ({ id: s.id, name: s.name })));
      } else if (!result.success) {
        toast({
          title: "Roster Error",
          description: result.error || "Failed to load student roster.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Roster Error",
        description: error instanceof Error ? error.message : "Failed to load student roster.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (authStatus === "authenticated") fetchStudents();
  }, [authStatus, fetchStudents]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasCameraPermission(true);
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    getCameraPermission();
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleTakeAttendance = async () => {
    if (!videoRef.current || !canvasRef.current || !user) return;

    setIsLoading(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext("2d");
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoDataUri = canvas.toDataURL("image/jpeg");
      setLastPhoto(photoDataUri);

      const result = await recognizeStudentsAction({ photoDataUri });

      if (result.success && "data" in result) {
        const recognizedNames = result.data.presentStudents;
        const newAttendance: Record<string, boolean> = { ...attendance };
        allStudents.forEach((s) => {
          if (recognizedNames.includes(s.name)) {
            newAttendance[s.id] = true;
          }
        });
        setAttendance(newAttendance);
        toast({
          title: "Scan Complete",
          description: `${recognizedNames.length} student(s) recognized via facial analysis.`,
        });
      } else {
        toast({
          title: "Recognition Note",
          description:
            "error" in result && result.error
              ? result.error
              : "No students recognized from camera snapshot. You can mark attendance manually below.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Scan Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to process image scan. You can mark attendance manually.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const presentStudents = allStudents.filter((s) => attendance[s.id]);
      const presentStudentIds = presentStudents.map((s) => s.id);
      const presentNames = presentStudents.map((s) => s.name);

      const result = await submitAttendanceAction(presentNames, lastPhoto, presentStudentIds);

      if (result.success) {
        toast({
          title: "Attendance Recorded",
          description: `Successfully saved session with ${presentStudentIds.length} student(s) marked present.`,
        });
        setAttendance({});
      } else {
        toast({
          title: "Submission Error",
          description: result.error || "Failed to submit attendance.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "Failed to submit attendance.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAttendance = (id: string) => {
    setAttendance((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    allStudents.forEach((s) => {
      next[s.id] = true;
    });
    setAttendance(next);
  };

  const clearAll = () => {
    setAttendance({});
  };

  const filteredStudents = useMemo(() => {
    if (!searchFilter.trim()) return allStudents;
    const q = searchFilter.toLowerCase().trim();
    return allStudents.filter((s) => s.name.toLowerCase().includes(q));
  }, [allStudents, searchFilter]);

  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-3xl font-bold font-headline">
            {t("pageHeader_attendance") || "Attendance Management"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pageDescription_attendance") ||
              "Track and manage student presence with multimodal AI face scanning and instant manual roll-call override."}
          </p>
        </div>
        <Badge variant="outline" className="text-xs self-start sm:self-auto py-1 px-3">
          {allStudents.length} Enrolled Roster Student{allStudents.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Camera Feed Card */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {t("cameraView_title") || "Camera View"}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("cameraView_description") || "Take a class snapshot to automatically identify enrolled students."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden border border-border/60 flex items-center justify-center">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${hasCameraPermission === false ? "hidden" : ""}`}
                autoPlay
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {hasCameraPermission === false && (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <VideoOff className="h-10 w-10 text-muted-foreground/60" />
                  <p className="text-sm font-semibold">Camera Access Unavailable</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Please allow browser camera permissions, or use manual roll-call on the right.
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleTakeAttendance}
              disabled={isLoading || hasCameraPermission !== true || allStudents.length === 0}
              className="w-full gap-2 h-10"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>{t("analyzing_button") || "Analyzing Classroom..."}</span>
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  <span>{t("takeAttendance_button") || "Scan Classroom Faces"}</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Attendance Roll-Call Card */}
        <Card className="border border-border/60 shadow-sm flex flex-col min-h-[500px]">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-emerald-600" />
                {t("attendanceList_title") || "Attendance Roll-Call"}
              </CardTitle>
              <Badge variant="secondary" className="font-semibold text-xs">
                {presentCount} / {allStudents.length} {t("studentsPresent_text") || "Present"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Toggle checkmarks for present students or scan classroom with camera.
            </CardDescription>

            {/* Quick action buttons & Search */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter student list..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  disabled={allStudents.length === 0}
                  className="h-8 text-xs gap-1"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={presentCount === 0}
                  className="h-8 text-xs gap-1"
                >
                  <Square className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
            <div className="flex-1 max-h-[340px] overflow-y-auto space-y-2 pr-1">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const isPresent = Boolean(attendance[student.id]);
                  return (
                    <div
                      key={student.id}
                      onClick={() => toggleAttendance(student.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        isPresent
                          ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm"
                          : "bg-muted/30 border-border/40 hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                            isPresent
                              ? "bg-emerald-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {student.name.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-foreground">
                          {student.name}
                        </span>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                          isPresent
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-muted-foreground/40 bg-background"
                        }`}
                      >
                        {isPresent && <ListChecks className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                  <Users className="h-8 w-8 opacity-40" />
                  <p className="text-sm">
                    {searchFilter ? "No matching students found." : "No enrolled students in roster."}
                  </p>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2 h-10 mt-auto"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || allStudents.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Submitting Attendance...</span>
                </>
              ) : (
                <>
                  <ListChecks className="h-4 w-4" />
                  <span>Submit Attendance ({presentCount} Present)</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
