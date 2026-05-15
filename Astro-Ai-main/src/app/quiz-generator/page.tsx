
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateQuizAction, textToSpeechAction } from '@/lib/actions';
import { Loader2, Volume2, FileText, Wand2, Mic, MicOff, Check, XIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { GenerateQuizOutput } from '@/ai/flows/generate-quiz';
import { useLanguage } from '@/context/language-context';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type QuizType = 'multiple-choice' | 'short-answer' | 'true-false';

export default function QuizGeneratorPage() {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizType, setQuizType] = useState<QuizType>('multiple-choice');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [quiz, setQuiz] = useState<GenerateQuizOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState<number | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();

  const speechRecognition = useSpeechRecognition({
      lang: language,
      onResult: setTopic,
      onError: (error) => {
          toast({ title: "Speech Recognition Error", description: error, variant: "destructive" });
      }
  });

  const toggleListening = () => {
      if (speechRecognition.isListening) {
          speechRecognition.stopListening();
      } else {
          speechRecognition.startListening();
      }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if(speechRecognition.isListening) speechRecognition.stopListening();
    if (!topic.trim()) {
      toast({
        title: 'Topic is empty',
        description: 'Please enter a topic for the quiz.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setQuiz(null);
    setUserAnswers({});
    setShowResults(false);

    const result = await generateQuizAction({ topic, numQuestions, quizType });

    if (result.success && result.data) {
      setQuiz(result.data as GenerateQuizOutput);
    } else {
      toast({
        title: 'Error Generating Quiz',
        description: 'error' in result ? result.error : 'An unknown error occurred.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleAnswerChange = (index: number, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [index]: answer }));
  };

  const handleQuizSubmit = () => {
    setShowResults(true);
    const score = quiz?.questions.reduce((acc, q, index) => {
        return acc + (userAnswers[index] === q.answer ? 1 : 0);
    }, 0);
    
    toast({
        title: "Quiz Completed!",
        description: `You scored ${score} out of ${quiz?.questions.length}.`,
    });
  };

  const handlePlayAudio = async (text: string, index: number) => {
    setIsAudioLoading(index);
    setAudioSrc(null);
    try {
      const result = await textToSpeechAction({ text });
      if (result.success && result.data) {
        setAudioSrc(result.data.audioDataUri);
      } else {
        toast({
          title: 'Error Generating Audio',
          description: 'error' in result ? result.error : 'Could not generate audio.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while generating audio.',
        variant: 'destructive',
      });
    } finally {
      setIsAudioLoading(null);
    }
  };
  
  const renderQuestion = (q: any, index: number) => {
    const isCorrect = userAnswers[index] === q.answer;
    const showCorrect = showResults && !isCorrect;

    switch (quiz?.quizType) {
        case 'multiple-choice':
            return (
                <RadioGroup 
                    value={userAnswers[index]} 
                    onValueChange={(val) => handleAnswerChange(index, val)}
                    disabled={showResults}
                >
                  {q.options?.map((option: string, i: number) => (
                    <div key={i} className={cn(
                        "flex items-center space-x-2 p-2 rounded-md transition-colors",
                        showResults && option === q.answer && "bg-green-100 dark:bg-green-900/30",
                        showResults && userAnswers[index] === option && option !== q.answer && "bg-red-100 dark:bg-red-900/30"
                    )}>
                      <RadioGroupItem value={option} id={`q${index}-o${i}`} />
                      <Label htmlFor={`q${index}-o${i}`} className="flex-grow cursor-pointer">{option}</Label>
                      {showResults && option === q.answer && <Check className="w-4 h-4 text-green-600" />}
                      {showResults && userAnswers[index] === option && option !== q.answer && <XIcon className="w-4 h-4 text-red-600" />}
                    </div>
                  ))}
                </RadioGroup>
            );
        case 'true-false':
            return (
                <RadioGroup 
                    className="flex gap-4" 
                    value={userAnswers[index]} 
                    onValueChange={(val) => handleAnswerChange(index, val)}
                    disabled={showResults}
                >
                    <div className={cn(
                        "flex items-center space-x-2 p-2 rounded-md transition-colors",
                        showResults && q.answer === "True" && "bg-green-100 dark:bg-green-900/30",
                        showResults && userAnswers[index] === "True" && q.answer !== "True" && "bg-red-100 dark:bg-red-900/30"
                    )}>
                      <RadioGroupItem value="True" id={`q${index}-true`} />
                      <Label htmlFor={`q${index}-true`} className="flex items-center gap-2 cursor-pointer">
                        <Check className="text-green-500 w-4 h-4"/>True
                      </Label>
                    </div>
                    <div className={cn(
                        "flex items-center space-x-2 p-2 rounded-md transition-colors",
                        showResults && q.answer === "False" && "bg-green-100 dark:bg-green-900/30",
                        showResults && userAnswers[index] === "False" && q.answer !== "False" && "bg-red-100 dark:bg-red-900/30"
                    )}>
                      <RadioGroupItem value="False" id={`q${index}-false`} />
                      <Label htmlFor={`q${index}-false`} className="flex items-center gap-2 cursor-pointer">
                        <XIcon className="text-red-500 w-4 h-4"/>False
                      </Label>
                    </div>
                </RadioGroup>
            );
        case 'short-answer':
            return (
                <div className="space-y-2">
                    <Textarea 
                        placeholder="Type your answer here..." 
                        value={userAnswers[index] || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        disabled={showResults}
                        className={cn(
                            showResults && isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/10",
                            showResults && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-900/10"
                        )}
                    />
                    {showResults && !isCorrect && (
                        <p className="text-sm text-green-600 font-medium">Correct answer: {q.answer}</p>
                    )}
                </div>
            );
        default:
            return null;
    }
  }


  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Quiz Maker</h1>
          <p className="text-muted-foreground">Create quizzes on any topic in seconds.</p>
        </div>
        {quiz && showResults && (
            <Badge variant="outline" className="text-lg py-1 px-4 border-primary text-primary">
                Score: {quiz.questions.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0)} / {quiz.questions.length}
            </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Wand2 /> Quiz Settings
            </CardTitle>
            <CardDescription>Define the topic and format of your quiz.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., The Solar System"
                    className="flex-grow"
                  />
                  {speechRecognition.hasPermission && (
                      <Button type="button" size="icon" variant={speechRecognition.isListening ? "destructive" : "outline"} onClick={toggleListening}>
                          {speechRecognition.isListening ? <MicOff /> : <Mic />}
                          <span className="sr-only">{speechRecognition.isListening ? "Stop listening" : "Start listening"}</span>
                      </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="numQuestions">Number of Questions</Label>
                    <Input
                    id="numQuestions"
                    type="number"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    min="1"
                    max="20"
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="quizType">Question Type</Label>
                    <Select value={quizType} onValueChange={(value: QuizType) => setQuizType(value)}>
                        <SelectTrigger id="quizType">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                            <SelectItem value="short-answer">Short Answer</SelectItem>
                            <SelectItem value="true-false">True/False</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 animate-spin" />}
                {isLoading ? 'Generating Quiz...' : 'Generate New Quiz'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:sticky lg:top-8 max-h-[calc(100vh-4rem)]">
          <CardHeader>
            <CardTitle className="font-headline flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText /> Generated Quiz
                </div>
                {quiz && <Badge>{quiz.title}</Badge>}
            </CardTitle>
            <CardDescription>Your quiz questions will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow overflow-hidden flex flex-col">
            {isLoading && (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            {quiz && (
              <div className="flex flex-col h-full">
                <div className="space-y-6 overflow-y-auto pr-2 flex-grow">
                    {quiz.questions.map((q, index) => (
                    <div key={index} className={cn(
                        "p-4 border rounded-lg space-y-3 transition-all",
                        showResults && userAnswers[index] === q.answer && "border-green-500 shadow-sm bg-green-50/30",
                        showResults && userAnswers[index] !== q.answer && "border-red-500 shadow-sm bg-red-50/30"
                    )}>
                        <div className="flex items-start justify-between">
                        <p className="font-semibold flex-grow pr-2">{index + 1}. {q.question}</p>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handlePlayAudio(q.question, index)}
                            disabled={isAudioLoading !== null}
                        >
                            {isAudioLoading === index ? <Loader2 className="animate-spin" /> : <Volume2 />}
                            <span className="sr-only">Read question</span>
                        </Button>
                        </div>
                        <div>
                            {renderQuestion(q, index)}
                        </div>
                    </div>
                    ))}
                </div>
                {!showResults && (
                    <div className="pt-6 border-t mt-4">
                        <Button onClick={handleQuizSubmit} className="w-full" size="lg">
                            Submit Quiz
                        </Button>
                    </div>
                )}
                {showResults && (
                    <div className="pt-6 border-t mt-4">
                        <Button onClick={() => setQuiz(null)} variant="outline" className="w-full">
                            Clear and Start Over
                        </Button>
                    </div>
                )}
                {audioSrc && <audio src={audioSrc} autoPlay onEnded={() => setAudioSrc(null)} />}
              </div>
            )}
            {!isLoading && !quiz && (
              <div className="flex items-center justify-center h-full min-h-[200px] text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <p>Your generated quiz will be displayed here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
