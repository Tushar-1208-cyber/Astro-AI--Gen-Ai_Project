"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || user.displayName || "");
      setEmail(user.email || "");
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      toast({ title: "Profile Updated", description: "Your details have been saved successfully." });
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast({ title: "Missing Information", description: "Please enter your current password.", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: "Password Too Short", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords Do Not Match", description: "New password and confirmation do not match.", variant: "destructive" });
      return;
    }

    setIsPasswordLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Password Change Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Account</h1>
        <p className="text-muted-foreground">Manage your Astro AI account credentials and profile settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" /> Profile Information
            </CardTitle>
            <CardDescription>Update your display name and email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isProfileLoading} className="w-full">
                {isProfileLoading && <Loader2 className="mr-2 animate-spin w-4 h-4" />}
                Update Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Change Password
            </CardTitle>
            <CardDescription>Update your password with your current credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>
              <Button type="submit" disabled={isPasswordLoading} className="w-full">
                {isPasswordLoading && <Loader2 className="mr-2 animate-spin w-4 h-4" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
