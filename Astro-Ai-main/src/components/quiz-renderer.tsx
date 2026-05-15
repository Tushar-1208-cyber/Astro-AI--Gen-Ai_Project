
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2 } from 'lucide-react';

interface Question {
    question: string;
    options?: string[];
    a?: string;
    b?: string;
    c?: string;
    d?: string;
    answer?: string;
    correct?: string;
}

interface QuizRendererProps {
    content: any;
}

export function QuizRenderer({ content }: QuizRendererProps) {
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);

    let quizData: any = content;
    if (typeof content === 'string') {
        try {
            quizData = JSON.parse(content);
        } catch (e) {
            return <div className="whitespace-pre-wrap p-4">{content}</div>;
        }
    }

    const questions: Question[] = quizData.quiz || quizData.questions || (Array.isArray(quizData) ? quizData : []);

    if (!Array.isArray(questions) || questions.length === 0) {
        return <div className="p-4 text-muted-foreground">This content type does not support interactive mode.</div>;
    }

    const handleSubmit = () => {
        let currentScore = 0;
        questions.forEach((q, idx) => {
            if (!q) return;
            const userAns = String(answers[idx] || "").trim().toLowerCase();
            const correctAns = String(q.answer || q.correct || "").trim().toLowerCase();
            
            const optA = String(q.a || "").trim().toLowerCase();
            const optB = String(q.b || "").trim().toLowerCase();
            const optC = String(q.c || "").trim().toLowerCase();
            const optD = String(q.d || "").trim().toLowerCase();

            // SMART SCORING LOGIC
            const isMatch = 
                (userAns === correctAns && userAns !== "") || // Direct text match
                (userAns === optA && (correctAns === 'a' || correctAns === optA)) ||
                (userAns === optB && (correctAns === 'b' || correctAns === optB)) ||
                (userAns === optC && (correctAns === 'c' || correctAns === optC)) ||
                (userAns === optD && (correctAns === 'd' || correctAns === optD));

            if (isMatch) currentScore++;
        });
        setScore(currentScore);
        setSubmitted(true);
    };

    return (
        <div className="space-y-6">
            {questions.map((q, idx) => {
                const opts = q.options || [q.a, q.b, q.c, q.d].filter(Boolean) as string[];
                const isCorrect = submitted && (
                    String(answers[idx] || "").trim().toLowerCase() === String(q.answer || q.correct || "").trim().toLowerCase() ||
                    (String(answers[idx] || "").trim().toLowerCase() === String(q.a || "").trim().toLowerCase() && (q.answer === 'a' || q.correct === 'a')) ||
                    (String(answers[idx] || "").trim().toLowerCase() === String(q.b || "").trim().toLowerCase() && (q.answer === 'b' || q.correct === 'b')) ||
                    (String(answers[idx] || "").trim().toLowerCase() === String(q.c || "").trim().toLowerCase() && (q.answer === 'c' || q.correct === 'c')) ||
                    (String(answers[idx] || "").trim().toLowerCase() === String(q.d || "").trim().toLowerCase() && (q.answer === 'd' || q.correct === 'd'))
                );

                return (
                    <Card key={idx} className={submitted ? (isCorrect ? "border-green-500 bg-green-50/10" : "border-red-500 bg-red-50/10") : ""}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex gap-2">
                                <span>{idx + 1}.</span> {q.question}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {opts.length > 0 ? (
                                <RadioGroup 
                                    value={answers[idx]} 
                                    onValueChange={(val) => !submitted && setAnswers(prev => ({ ...prev, [idx]: val }))}
                                    className="space-y-3"
                                >
                                    {opts.map((opt, optIdx) => {
                                        const isThisCorrect = String(opt || "").trim().toLowerCase() === String(q.answer || q.correct || "").trim().toLowerCase() ||
                                                            (optIdx === 0 && (q.answer === 'a' || q.correct === 'a')) ||
                                                            (optIdx === 1 && (q.answer === 'b' || q.correct === 'b')) ||
                                                            (optIdx === 2 && (q.answer === 'c' || q.correct === 'c')) ||
                                                            (optIdx === 3 && (q.answer === 'd' || q.correct === 'd'));

                                        return (
                                            <div key={optIdx} className="flex items-center space-x-3 p-2 rounded-md transition-colors">
                                                <RadioGroupItem value={opt} id={`q${idx}-o${optIdx}`} disabled={submitted} />
                                                <Label htmlFor={`q${idx}-o${optIdx}`} className="flex-grow cursor-pointer text-base">
                                                    {opt}
                                                </Label>
                                                {submitted && isThisCorrect && <CheckCircle2 className="text-green-500 w-5 h-5" />}
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            ) : (
                                <div className="space-y-2">
                                    <Textarea 
                                        placeholder="Type your answer here..."
                                        value={answers[idx] || ""}
                                        onChange={(e) => !submitted && setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                                        disabled={submitted}
                                        className={submitted ? (isCorrect ? "border-green-500" : "border-red-500") : ""}
                                    />
                                    {submitted && (
                                        <p className="text-sm font-bold text-green-600">
                                            Correct Answer: {String(q.answer || q.correct || "N/A")}
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            {!submitted ? (
                <Button onClick={handleSubmit} className="w-full h-12 text-lg font-bold shadow-lg">
                    Submit Quiz
                </Button>
            ) : (
                <Card className="bg-primary text-primary-foreground border-none shadow-2xl">
                    <CardContent className="pt-6 pb-6 text-center">
                        <h3 className="text-2xl font-bold mb-2 font-headline">Quiz Completed!</h3>
                        <p className="text-4xl font-black mb-4">
                            Score: {score} / {questions.length}
                        </p>
                        <Button variant="secondary" onClick={() => { setSubmitted(false); setAnswers({}); }} className="w-full">
                            Retry Quiz
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
