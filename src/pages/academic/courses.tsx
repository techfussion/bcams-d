/**
 * Courses Page
 * 
 * FR-7.1: Academic course catalog & offering configuration
 * FR-7.2: General cross-department course flag support
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { CourseFormDialog } from '@/components/academic';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import type { Course, Department } from '@/types';
import { Plus, BookOpen } from 'lucide-react';

export function CoursesPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [crs, depts] = await Promise.all([
          api.getCourses(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
        ]);
        setCourses(crs);
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleCourseCreated = (newCourse: Course) => {
    setCourses([newCourse, ...courses]);
    toast({
      title: 'Course Created',
      description: `${newCourse.code} — ${newCourse.title} registered successfully.`,
      variant: 'success',
    });
  };

  const columns: DataTableColumn<Course>[] = [
    {
      key: 'code',
      header: 'Course Code',
      sortable: true,
      sortFn: (a, b) => a.code.localeCompare(b.code),
      render: (c) => <span className="font-bold text-foreground text-xs font-mono">{c.code}</span>,
    },
    {
      key: 'title',
      header: 'Course Title',
      sortable: true,
      sortFn: (a, b) => a.title.localeCompare(b.title),
      render: (c) => <span className="text-xs text-foreground font-medium">{c.title}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (c) => <span className="text-xs text-muted-foreground">{c.departmentName}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      sortFn: (a, b) => a.level - b.level,
      render: (c) => <span className="text-xs font-mono text-muted-foreground">{c.level}L</span>,
    },
    {
      key: 'units',
      header: 'Units',
      sortable: true,
      sortFn: (a, b) => a.creditUnits - b.creditUnits,
      render: (c) => <span className="text-xs font-mono text-foreground font-semibold">{c.creditUnits} CU</span>,
    },
    {
      key: 'semester',
      header: 'Semester',
      render: (c) => <span className="text-xs font-mono text-muted-foreground">Sem {c.semester}</span>,
    },
    {
      key: 'general',
      header: 'Cross-Faculty',
      render: (c) =>
        c.isGeneral ? (
          <Badge variant="outline" className="text-[10px] bg-primary-50 text-primary border-primary-200">
            General (GST)
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Curriculum & Courses"
        subtitle="Manage academic courses, credit units, and semester syllabus schedules."
        actions={
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Course
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Courses
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{courses.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Departments Represented
              </p>
              <p className="text-2xl font-bold text-primary mt-1">
                {new Set(courses.map((c) => c.departmentId)).size}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                General Courses
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {courses.filter((c) => c.isGeneral).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={courses}
          isLoading={isLoading}
          searchPlaceholder="Search course by code or title..."
          emptyTitle="No courses registered"
          emptyDescription="No curriculum courses registered in the system."
          selectable={true}
          selectedIds={selectedCourseIds}
          onSelectionChange={setSelectedCourseIds}
        />
      </div>

      <CourseFormDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        departments={departments}
        onSubmit={handleCourseCreated}
      />
    </div>
  );
}
