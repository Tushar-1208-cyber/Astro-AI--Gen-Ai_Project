
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Users, ListChecks } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/context/language-context";
import { useAuth } from '@/context/auth-context';
import { recognizeStudentsAction, submitAttendanceAction, getStudentsAction } from "@/lib/actions";

export default function AttendancePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<{id: string, name: string}[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [lastPhoto, setLastPhoto] = useState<string>("");
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { authStatus, user } = useAuth();

  useEffect(() => {
    async function fetchStudents() {
      const result = await getStudentsAction();
      if (result.success) {
        setAllStudents(result.data.map((s: any) => ({ id: s.id, name: s.name })));
      }
    }
    if (authStatus === 'authenticated') fetchStudents();
  }, [authStatus]);

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
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleTakeAttendance = async () => {
    if (!videoRef.current || !canvasRef.current || !user) return;

    setIsLoading(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoDataUri = canvas.toDataURL('image/jpeg');
    setLastPhoto(photoDataUri);
    
    const result = await recognizeStudentsAction({ photoDataUri });

    if (result.success && 'data' in result) {
      const recognizedNames = result.data.presentStudents;
      const newAttendance: Record<string, boolean> = { ...attendance };
      allStudents.forEach(s => {
        if (recognizedNames.includes(s.name)) {
          newAttendance[s.id] = true;
        }
      });
      setAttendance(newAttendance);
      toast({ title: "Scan Complete", description: `${recognizedNames.length} students recognized.` });
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const presentNames = allStudents.filter(s => attendance[s.id]).map(s => s.name);
    
    const result = await submitAttendanceAction(presentNames, lastPhoto);
    
    if (result.success) {
      toast({ title: "Success", description: "Attendance submitted successfully!" });
      setAttendance({}); 
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const toggleAttendance = (id: string) => {
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">{t('pageHeader_attendance')}</h1>
        <p className="text-muted-foreground">{t('pageDescription_attendance')}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><Camera /> {t('cameraView_title')}</CardTitle>
            <CardDescription>{t('cameraView_description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative w-full aspect-video bg-secondary rounded-md overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
            </div>
            <Button onClick={handleTakeAttendance} disabled={isLoading || hasCameraPermission !== true} className="w-full" size="lg">
              {isLoading ? <><Loader2 className="mr-2 animate-spin" /> {t('analyzing_button')}</> : <><Users className="mr-2" /> {t('takeAttendance_button')}</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><ListChecks /> {t('attendanceList_title')}</CardTitle>
            <CardDescription>{t('attendanceList_description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col h-full min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-24"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>
            ) : (
                <div className="flex flex-col h-full space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold">{Object.values(attendance).filter(Boolean).length} / {allStudents.length} {t('studentsPresent_text')}</h3>
                    </div>
                    <Separator />
                    <div className="flex-grow max-h-[350px] overflow-y-auto space-y-2 pr-2">
                        {allStudents.map((student) => (
                            <div key={student.id} onClick={() => toggleAttendance(student.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${attendance[student.id] ? 'bg-primary/10 border-primary shadow-sm' : 'bg-secondary/30 border-transparent hover:border-muted'}`}
                            >
                                <span className="font-medium">{student.name}</span>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${attendance[student.id] ? 'bg-primary border-primary text-white' : 'border-muted-foreground'}`}>
                                    {attendance[student.id] && <ListChecks className="w-4 h-4" />}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button className="w-full mt-4" size="lg" onClick={handleSubmit} disabled={isSubmitting || allStudents.length === 0}>
                        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <ListChecks className="mr-2" />} Submit Attendance
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
