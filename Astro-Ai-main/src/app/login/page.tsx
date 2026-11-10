"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Phone, AlertCircle, Shield } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/context/auth-context';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="mr-2">
    <path fill="currentColor" d="M21.35 11.1H12.18V13.83H18.69C18.36 17.64 15.19 19.27 12.19 19.27C8.36 19.27 5.03 16.25 5.03 12.55C5.03 8.85 8.34 5.82 12.19 5.82C14.03 5.82 15.63 6.42 16.89 7.57L19.31 5.18C17.22 3.23 14.81 2 12.19 2C6.92 2 2.73 6.38 2.73 11.99C2.73 17.6 6.92 22 12.19 22C17.6 22 21.54 18.33 21.54 12.25C21.54 11.88 21.49 11.49 21.35 11.1Z" />
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { refreshUser } = useAuth();
  const [logoBounce, setLogoBounce] = useState(false);

  useEffect(() => {
    setLogoBounce(true);
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({ title: 'Login Successful', description: 'Welcome back to Astro AI!' });
        if (refreshUser) {
          await refreshUser();
        }
        router.push('/');
        router.refresh();
      } else {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 bg-gradient-to-b from-background to-secondary/20">
      <Card className="w-full max-w-lg shadow-xl rounded-2xl border bg-card backdrop-blur-md">
        <CardHeader className="flex flex-col items-center gap-2 pb-2 text-center">
          <div className="w-20 h-20 mb-2 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
            <span className="text-4xl">🌌</span>
          </div>
          <CardTitle className="text-3xl font-headline font-bold">Astro AI</CardTitle>
          <CardDescription className="text-base">Secure Gen-AI Educational Platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">
                <KeyRound className="w-4 h-4 mr-2" /> Email
              </TabsTrigger>
              <TabsTrigger value="phone">
                <Phone className="w-4 h-4 mr-2" /> Phone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 pt-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="teacher@school.edu"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full font-semibold" disabled={isLoading} size="lg">
                  {isLoading && <Loader2 className="mr-2 animate-spin w-4 h-4" />}
                  Sign In
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Additional Sign-in Methods</span>
                </div>
              </div>

              {/* Disabled Google Login button with honest explanation */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full opacity-60 cursor-not-allowed" disabled={true}>
                  <GoogleIcon />
                  Sign in with Google (Coming Soon)
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  OAuth single sign-on is queued for an upcoming release. Please use email credentials.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="phone" className="space-y-4 pt-4">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Phone OTP Login Temporarily Disabled
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To ensure complete data isolation and avoid unverified third-party tokens, phone authentication is currently undergoing migration to our unified MongoDB session system.
                </p>
                <p className="text-xs font-medium">
                  Please use the <strong>Email</strong> tab to log in securely.
                </p>
              </div>

              <div className="space-y-2 opacity-50">
                <Label htmlFor="disabled-phone">Phone Number</Label>
                <Input id="disabled-phone" type="tel" placeholder="+91 98765 43210" disabled />
              </div>

              <Button disabled className="w-full cursor-not-allowed">
                <Phone className="w-4 h-4 mr-2" /> Phone Sign-in Offline
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account yet?{' '}
            <Link href="/signup" className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80">
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
