"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import {
  addStudentAction,
  getStudentsAction,
  deleteStudentAction,
  updateStudentAction,
} from "@/lib/actions";
import {
  Loader2,
  Trash2,
  UserPlus,
  Upload,
  Users,
  Search,
  Edit2,
  Eye,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import type { Student } from "@/lib/firestore";

const STUDENTS_PER_PAGE = 8;

export default function StudentRosterPage() {
  const { t } = useLanguage();
  const { authStatus, user } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Add Form State
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhoto, setNewStudentPhoto] = useState<string | null>(null);
  const [newStudentFileName, setNewStudentFileName] = useState("");

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Details Modal State
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getStudentsAction();
      if (result.success && result.data) {
        setStudents(result.data);
        setLastFetchTime(Date.now());
      } else {
        toast({
          title: "Error",
          description: result.error || "Could not load students.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load students.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchStudents();
    } else if (authStatus !== "loading") {
      setIsLoading(false);
    }
  }, [authStatus, fetchStudents]);

  // Handle Photo selection for adding
  const handleAddFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewStudentFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewStudentPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Photo selection for editing
  const handleEditFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Student Handler
  const handleAddStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newStudentName.trim() || !newStudentPhoto || !user) {
      toast({
        title: "Missing Information",
        description: "Please provide a student name and photo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const addResult = await addStudentAction({
        name: newStudentName.trim(),
        photoDataUri: newStudentPhoto,
      });

      if (addResult.success && addResult.data) {
        setStudents(addResult.data);
        setNewStudentName("");
        setNewStudentPhoto(null);
        setNewStudentFileName("");
        toast({ title: "Success", description: "Student added to the roster." });
      } else {
        toast({
          title: "Error",
          description: addResult.error || "Failed to add student.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add student.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Student Handler
  const handleDeleteStudent = async (id: string, name: string) => {
    if (!user) return;
    const originalStudents = [...students];
    setStudents(students.filter((s) => s.id !== id));

    try {
      const deleteResult = await deleteStudentAction(id);
      if (deleteResult.success && deleteResult.data) {
        toast({ title: "Success", description: `Student ${name} removed.` });
        setStudents(deleteResult.data);
      } else {
        toast({
          title: "Error",
          description: deleteResult.error || "Failed to remove student.",
          variant: "destructive",
        });
        setStudents(originalStudents);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove student.",
        variant: "destructive",
      });
      setStudents(originalStudents);
    }
  };

  // Open Edit Modal
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditPhoto(null);
    setEditFileName("");
  };

  // Save Edit Student Handler
  const handleSaveEdit = async () => {
    if (!editingStudent || !editName.trim()) {
      toast({ title: "Validation Error", description: "Name cannot be empty.", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const payload: Partial<Omit<Student, "id" | "uid">> = {
        name: editName.trim(),
      };
      if (editPhoto) {
        payload.photoDataUri = editPhoto;
      }

      const result = await updateStudentAction(editingStudent.id, payload);
      if (result.success && result.data) {
        setStudents(result.data);
        setEditingStudent(null);
        toast({ title: "Success", description: "Student record updated." });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update student.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update student.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered & Paginated students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * STUDENTS_PER_PAGE;
    return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-3xl font-bold font-headline">
            {t("studentRoster") || "Student Roster"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("studentRoster_desc") || "Manage your student database, profiles, and attendance recognition portraits."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {students.length} Total Student{students.length === 1 ? "" : "s"}
          </Badge>
          <Button
            onClick={fetchStudents}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="h-8 gap-1.5"
          >
            {isLoading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Add New Student Form */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Add New Student
              </CardTitle>
              <CardDescription className="text-xs">
                Upload a clear facial portrait for AI face recognition attendance.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAddStudent}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student-name" className="text-xs font-semibold">
                    Student Full Name
                  </Label>
                  <Input
                    id="student-name"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="e.g., Alex Johnson"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo-upload" className="text-xs font-semibold">
                    Portrait Photo
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAddFileChange}
                      className="hidden"
                      required
                    />
                    <Button asChild variant="outline" size="sm" className="w-full h-9">
                      <Label htmlFor="photo-upload" className="cursor-pointer gap-2">
                        <Upload className="h-4 w-4" />
                        Choose Photo
                      </Label>
                    </Button>
                  </div>
                  {newStudentFileName && (
                    <p className="text-xs text-muted-foreground truncate">{newStudentFileName}</p>
                  )}
                </div>

                {newStudentPhoto && (
                  <div className="mt-3 border rounded-lg p-2 bg-muted/30 flex justify-center">
                    <div className="relative h-40 w-40 rounded-md overflow-hidden">
                      <Image
                        src={newStudentPhoto}
                        alt="New student preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2">
                <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
                  {isSubmitting ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Adding to Roster..." : "Enroll Student"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right Column: Search, Roster Grid & Pagination */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-headline text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Enrolled Class Roster
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Showing {filteredStudents.length} of {students.length} student{students.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex flex-col justify-center items-center h-56 space-y-3">
                  <Loader2 className="animate-spin text-primary h-8 w-8" />
                  <p className="text-xs text-muted-foreground">Loading roster...</p>
                </div>
              ) : paginatedStudents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {paginatedStudents.map((student) => (
                    <Card
                      key={student.id}
                      className="overflow-hidden group border border-border/60 hover:shadow-md transition-all duration-200"
                    >
                      <CardContent className="p-0">
                        <div className="relative aspect-square w-full bg-muted">
                          {student.photoDataUri ? (
                            <Image
                              src={student.photoDataUri}
                              alt={`Portrait of ${student.name}`}
                              fill
                              className="object-cover transition-transform group-hover:scale-105 duration-200"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                              <Users className="h-10 w-10 opacity-40" />
                            </div>
                          )}

                          {/* Hover action overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => setViewingStudent(student)}
                              title="View Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => openEditModal(student)}
                              title="Edit Student"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => handleDeleteStudent(student.id, student.name)}
                              title="Delete Student"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="p-3 flex flex-col items-start space-y-1">
                        <p className="font-semibold text-sm truncate w-full text-foreground">
                          {student.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate w-full">
                          ID: {student.id.substring(0, 8)}...
                        </p>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-56 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg space-y-2">
                  <Users className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">
                    {searchQuery ? "No matching students found" : "No students in roster"}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {searchQuery
                      ? `No student matching "${searchQuery}". Clear your search query to see all students.`
                      : "Enroll your first student using the form on the left to start tracking attendance and grades."}
                  </p>
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-border/40 mt-6">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2">{currentPage}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Student Dialog */}
      <Dialog open={Boolean(editingStudent)} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student Record</DialogTitle>
            <DialogDescription className="text-xs">
              Update student name or upload a new photo for attendance recognition.
            </DialogDescription>
          </DialogHeader>

          {editingStudent && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-xs font-semibold">
                  Student Name
                </Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Student name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Replace Photo (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleEditFileChange}
                    className="hidden"
                  />
                  <Button asChild variant="outline" size="sm" className="w-full h-9">
                    <Label htmlFor="edit-photo-input" className="cursor-pointer gap-2">
                      <Upload className="h-4 w-4" />
                      Choose New Photo
                    </Label>
                  </Button>
                </div>
                {editFileName && (
                  <p className="text-xs text-muted-foreground truncate">{editFileName}</p>
                )}
              </div>

              {/* Photo Preview */}
              <div className="flex justify-center pt-2">
                <div className="relative h-32 w-32 rounded-lg overflow-hidden border">
                  <Image
                    src={editPhoto || editingStudent.photoDataUri || "/placeholder.png"}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingStudent(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating} className="gap-1.5">
              {isUpdating && <Loader2 className="animate-spin h-3.5 w-3.5" />}
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Student Profile Dialog */}
      <Dialog open={Boolean(viewingStudent)} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription className="text-xs">
              Verified identity and enrollment details.
            </DialogDescription>
          </DialogHeader>

          {viewingStudent && (
            <div className="flex flex-col items-center space-y-4 py-2">
              <div className="relative h-44 w-44 rounded-xl overflow-hidden border shadow-sm">
                <Image
                  src={viewingStudent.photoDataUri || "/placeholder.png"}
                  alt={viewingStudent.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-center space-y-1 w-full">
                <h3 className="text-lg font-bold text-foreground">{viewingStudent.name}</h3>
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Enrolled & Active</span>
                </div>
                <div className="mt-2 p-2 bg-muted/40 rounded-md font-mono text-[11px] text-muted-foreground break-all">
                  Canonical ID: {viewingStudent.id}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingStudent(null)} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
