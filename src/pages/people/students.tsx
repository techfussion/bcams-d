/**
 * Students Page
 * 
 * FR-8.1: Student records management, course enrollments,
 * and biometric status tracking.
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
import type { Student, Department } from '@/types';
import { Plus, GraduationCap, UserCheck } from 'lucide-react';

const statusVariants: Record<string, 'success' | 'warning' | 'muted' | 'destructive'> = {
  active: 'success',
  inactive: 'muted',
  withdrawn: 'destructive',
  graduated: 'muted',
};

export function StudentsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [studs, depts] = await Promise.all([
          api.getStudents(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
        ]);
        setStudents(studs);
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load students:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleStudentCreated = (newStudent: Student) => {
    setStudents([newStudent, ...students]);
    toast({
      title: 'Student Registered',
      description: `${newStudent.fullName} (${newStudent.matricNumber}) was successfully added.`,
      variant: 'success',
    });
  };

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center font-bold text-xs">
            {s.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{s.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.matricNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Faculty',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (s) => (
        <div>
          <p className="text-xs font-medium text-foreground">{s.departmentName}</p>
          <p className="text-[11px] text-muted-foreground">{s.programme}</p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      sortFn: (a, b) => a.level - b.level,
      render: (s) => (
        <Badge variant="outline" className="font-mono text-xs">
          {s.level}L
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Academic Status',
      render: (s) => (
        <Badge
          variant={statusVariants[s.status] || 'default'}
          className="capitalize text-xs font-medium"
        >
          {s.status}
        </Badge>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={s.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {s.enrolledFingers}/10
          </span>
        </div>
      ),
    },
    {
      key: 'enrollments',
      header: 'Enrolled Courses',
      render: (s) => (
        <span className="text-xs font-mono text-muted-foreground">
          {s.courseEnrollments.length} courses
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Student Registry"
        subtitle="Manage student identities, department affiliations, academic standing, and biometric verification status."
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Student
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Registered
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{students.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Biometrically Verified
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {students.filter((s) => s.biometricStatus === 'complete' || s.biometricStatus === 'activated').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pending Enrollment
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {students.filter((s) => s.biometricStatus === 'not_enrolled' || s.biometricStatus === 'partial').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={students}
          isLoading={isLoading}
          searchPlaceholder="Search student by name, matric number, or programme..."
          emptyTitle="No students found"
          emptyDescription="No registered students match the active department filters."
          selectable={true}
          selectedIds={selectedStudentIds}
          onSelectionChange={setSelectedStudentIds}
        />
      </div>

      {/* Zod-validated Registration Dialog */}
      <PersonFormDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        personType="student"
        departments={departments}
        onSubmitStudent={handleStudentCreated}
      />
    </div>
  );
}
