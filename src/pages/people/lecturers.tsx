/**
 * Lecturers Page
 * 
 * FR-8.2: Lecturer registry, course assignments,
 * and biometric enrollment tracking.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { PersonFormDialog } from '@/components/people';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import type { Lecturer, Department, Course } from '@/types';
import { Plus, Users, BookOpen } from 'lucide-react';

export function LecturersPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedLecturerIds, setSelectedLecturerIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [lecs, depts, crs] = await Promise.all([
          api.getLecturers(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
          api.getCourses(),
        ]);
        setLecturers(lecs);
        setDepartments(depts);
        setCourses(crs);
      } catch (err) {
        console.error('Failed to load lecturers:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleLecturerCreated = (newLecturer: Lecturer) => {
    setLecturers([newLecturer, ...lecturers]);
    toast({
      title: 'Lecturer Registered',
      description: `${newLecturer.fullName} was successfully registered for ${newLecturer.departmentName}.`,
      variant: 'success',
    });
  };

  const columns: DataTableColumn<Lecturer>[] = [
    {
      key: 'name',
      header: 'Lecturer',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center font-bold text-xs">
            {l.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{l.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{l.staffId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (l) => (
        <span className="text-xs font-medium text-foreground">{l.departmentName}</span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (l) => (
        <span className="text-xs text-muted-foreground font-mono">
          {l.contactEmail || '—'}
        </span>
      ),
    },
    {
      key: 'courses',
      header: 'Assigned Courses',
      render: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.assignedCourses.length > 0 ? (
            l.assignedCourses.map((c) => (
              <Badge key={c.id} variant="outline" className="font-mono text-[10px]">
                {c.courseCode}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">None assigned</span>
          )}
        </div>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (l) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={l.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {l.enrolledFingers}/10
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Lecturer Directory"
        subtitle="Manage academic faculty, assigned course offerings, and biometric authorization readiness."
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Lecturer
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Academic Faculty
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{lecturers.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Course Assignments
              </p>
              <p className="text-2xl font-bold text-primary mt-1">
                {lecturers.reduce((acc, l) => acc + l.assignedCourses.length, 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Biometric Ready
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {lecturers.filter((l) => l.biometricStatus === 'complete' || l.biometricStatus === 'activated').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={lecturers}
          isLoading={isLoading}
          searchPlaceholder="Search lecturer by name, staff ID, or department..."
          emptyTitle="No lecturers found"
          emptyDescription="No registered lecturers match the query."
          selectable={true}
          selectedIds={selectedLecturerIds}
          onSelectionChange={setSelectedLecturerIds}
        />
      </div>

      {/* Registration Dialog */}
      <PersonFormDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        personType="lecturer"
        departments={departments}
        onSubmitLecturer={handleLecturerCreated}
      />
    </div>
  );
}
