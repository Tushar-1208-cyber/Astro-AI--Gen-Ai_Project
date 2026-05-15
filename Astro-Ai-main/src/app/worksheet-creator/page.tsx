
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createWorksheetAction, textToSpeechAction } from '@/lib/actions';
import { Loader2, Volume2, FileText, Wand2, Mic, MicOff, Check, XIcon, Printer, Download, GraduationCap } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

export default function WorksheetCreatorPage() {
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState(5);
  const [numQuestions, setNumQuestions] = useState(5);
  const [worksheet, setWorksheet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState<number | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);

  const speechRecognition = useSpeechRecognition({
      lang: language,
      onResult: setTopic,
      onError: (error) => {
          toast({ title: "Speech Recognition Error", description: error, variant: "destructive" });
      }
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if(speechRecognition.isListening) speechRecognition.stopListening();
    if (!topic.trim()) {
      toast({ title: 'Topic is empty', description: 'Please enter a topic.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setWorksheet(null);

    const result = await createWorksheetAction({ topic, gradeLevel, numQuestions });

    if (result.success && result.data) {
      setWorksheet(result.data);
      toast({ title: "Worksheet Ready!", description: `Generated ${result.data.questions.length} questions.` });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to generate.', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePlayAudio = async (text: string, index: number) => {
    setIsAudioLoading(index);
    const result = await textToSpeechAction({ text });
    if (result.success && result.data) {
        setAudioSrc(result.data.audioDataUri);
    }
    setIsAudioLoading(null);
  };
  
  const renderQuestionInput = (q: any, index: number) => {
    switch (q.type) {
        case 'multiple-choice':
            return (
                <RadioGroup className="mt-3 ml-4">
                  {q.options.map((option: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`q${index}-o${i}`} />
                      <Label htmlFor={`q${index}-o${i}`} className="text-sm cursor-pointer">{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
            );
        case 'true-false':
            return (
                <RadioGroup className="flex gap-6 mt-3 ml-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="True" id={`q${index}-true`} />
                      <Label htmlFor={`q${index}-true`} className="flex items-center gap-2 cursor-pointer"><Check className="w-4 h-4 text-green-500"/>True</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="False" id={`q${index}-false`} />
                      <Label htmlFor={`q${index}-false`} className="flex items-center gap-2 cursor-pointer"><XIcon className="w-4 h-4 text-red-500"/>False</Label>
                    </div>
                </RadioGroup>
            );
        default:
            return <Textarea placeholder="Write your answer here..." className="mt-3 bg-muted/50 border-dashed" />;
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-4xl font-black font-headline tracking-tight text-primary">Worksheet Maker</h1>
            <p className="text-muted-foreground text-lg">Turn any topic into a professional classroom worksheet in seconds.</p>
        </div>
        <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}><Wand2 className="w-4 h-4 mr-2" /> New</Button>
            {worksheet && <Button size="sm" onClick={handlePrint} className="bg-primary hover:bg-primary/90"><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Settings Panel */}
        <div className="lg:col-span-4 print:hidden">
            <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
              <div className="h-2 bg-primary w-full" />
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-2xl">
                  <GraduationCap className="text-primary" /> Setup
                </CardTitle>
                <CardDescription>Configure your worksheet parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="topic" className="font-bold">Topic or Subject</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Quantum Physics, Ancient Rome"
                        className="h-12 border-primary/20 focus-visible:ring-primary"
                      />
                      <Button type="button" size="icon" variant={speechRecognition.isListening ? "destructive" : "secondary"} onClick={() => speechRecognition.isListening ? speechRecognition.stopListening() : speechRecognition.startListening()} className="h-12 w-12 shrink-0">
                          {speechRecognition.isListening ? <MicOff className="animate-pulse" /> : <Mic />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="gradeLevel" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Grade Level</Label>
                        <Input id="gradeLevel" type="number" value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))} min="1" max="12" className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="numQuestions" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Total Questions</Label>
                        <Input id="numQuestions" type="number" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} min="1" max="15" className="bg-muted/50" />
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    {isLoading ? <><Loader2 className="mr-2 animate-spin" /> Crafting...</> : <><Wand2 className="mr-2" /> Generate Now</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
        </div>

        {/* Display Panel */}
        <div className="lg:col-span-8">
            <Card className="border-2 border-primary/5 shadow-2xl min-h-[600px] print:border-none print:shadow-none">
              <CardHeader className="border-b bg-muted/30 print:bg-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg"><FileText className="text-primary w-6 h-6" /></div>
                        <div>
                            <CardTitle className="font-headline text-2xl">{worksheet?.title || "Worksheet Preview"}</CardTitle>
                            <CardDescription>Created with Astro AI Assistant</CardDescription>
                        </div>
                    </div>
                    {worksheet && (
                        <div className="flex flex-col items-end gap-1">
                            <Badge className="bg-primary/90">Grade {gradeLevel}</Badge>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">{new Date().toLocaleDateString()}</span>
                        </div>
                    )}
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative">
                        <Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" />
                        <FileText className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="font-headline text-xl animate-pulse text-muted-foreground">Brainstorming questions...</p>
                  </div>
                )}
                
                {worksheet && (
                  <div className="space-y-8 print:space-y-6" id="worksheet-content">
                    {worksheet.questions.map((q: any, index: number) => (
                      <div key={index} className="group relative space-y-2 p-4 rounded-xl transition-colors hover:bg-muted/30 print:p-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-grow">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-[10px] font-bold">{index + 1}</span>
                                <Badge variant="secondary" className="text-[10px] uppercase tracking-tighter h-5">{(q.type || 'task').replace('-', ' ')}</Badge>
                             </div>
                             <p className="text-lg font-medium leading-tight">{q.question}</p>
                          </div>
                          
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handlePlayAudio(q.question, index)}
                            disabled={isAudioLoading === index}
                            className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {isAudioLoading === index ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                          </Button>
                        </div>
                        
                        <div className="pl-8">
                            {renderQuestionInput(q, index)}
                        </div>
                        
                        {index < worksheet.questions.length - 1 && <Separator className="mt-8 opacity-50 print:mt-4" />}
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && !worksheet && (
                  <div className="flex flex-col items-center justify-center py-40 text-center space-y-6">
                    <div className="p-6 bg-muted rounded-full border-2 border-dashed border-muted-foreground/20">
                        <FileText className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                    <div className="space-y-2 max-w-sm">
                        <h3 className="text-xl font-bold">No Worksheet Generated</h3>
                        <p className="text-muted-foreground">Select a topic on the left to create an interactive learning guide for your students.</p>
                    </div>
                  </div>
                )}
              </CardContent>
              {worksheet && (
                <div className="p-6 bg-muted/10 border-t text-center text-[10px] text-muted-foreground italic print:block hidden">
                    Property of Astro AI Educational Suite. All rights reserved.
                </div>
              )}
            </Card>
        </div>
      </div>
      
      {audioSrc && <audio src={audioSrc} autoPlay onEnded={() => setAudioSrc(null)} />}
      
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #worksheet-content, #worksheet-content * { visibility: visible; }
          #worksheet-content { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
