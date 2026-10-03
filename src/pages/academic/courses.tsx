/**
 * Courses Page
 * 
 * FR-7.1: Academic course catalog & offering configuration
 * FR-7.2: General cross-department course flag support
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Course, Department } from '@/types';
import { Plus, BookOpen } from 'lucide-react';

export function CoursesPage() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [level, setLevel] = useState(200);
  const [creditUnits, setCreditUnits] = useState(3);
  const [semester, setSemester] = useState(1);
  const [isGeneral, setIsGeneral] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [crs, depts] = await Promise.all([
          api.getCourses(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
        ]);
        setCourses(crs);
        setDepartments(depts);
        if (depts.length > 0) setSelectedDeptId(depts[0].id);
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const dept = departments.find(d => d.id === selectedDeptId) || departments[0];
    const newCourse: Course = {
      id: `crs-${Date.now().toString().slice(-4)}`,
      code,
      title,
      departmentId: dept.id,
      departmentName: dept.name,
      creditUnits,
      isGeneral,
      level,
      semester,
    };

    setCourses([newCourse, ...courses]);
    setIsAddModalOpen(false);
    setCode('');
    setTitle('');
  };

  const columns: DataTableColumn<Course>[] = [
    {
      key: 'code',
      header: 'Course Code',
      sortable: true,
      sortFn: (a, b) => a.code.localeCompare(b.code),
      render: (c) => <span className="font-bold text-foreground text-xs font-mono">{c.code}</span>,
    },
    { key: 'title', header: 'Course Title', render: (c) => <span className="text-xs text-foreground font-medium">{c.title}</span> },
    { key: 'department', header: 'Department', render: (c) => <span className="text-xs text-muted-foreground">{c.departmentName}</span> },
    { key: 'level', header: 'Level', render: (c) => <span className="text-xs font-mono text-muted-foreground">{c.level}L</span> },
    { key: 'units', header: 'Units', render: (c) => <span className="text-xs font-mono text-foreground font-semibold">{c.creditUnits} CU</span> },
    { key: 'semester', header: 'Semester', render: (c) => <span className="text-xs font-mono text-muted-foreground">Sem {c.semester}</span> },
    {
      key: 'type',
      header: 'Course Scope',
      render: (c) => c.isGeneral ? (
        <Badge variant="warning" className="text-[10px]">General / Multi-Dept</Badge>
      ) : (
        <Badge variant="outline" className="text-[10px]">Departmental</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Courses & Academic Curriculum"
        subtitle="FR-7.1: Course catalog, credit unit configurations, and cross-department general courses"
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
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-section animate-fadeIn">
          <DataTable
            columns={columns}
            data={courses}
            isLoading={isLoading}
            searchPlaceholder="Search courses by code or title..."
            searchFn={(c, q) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)}
            getRowId={(c) => c.id}
            emptyTitle="No courses found"
            emptyDescription="No academic courses have been created yet."
            emptyAction={{ label: 'Add Course', onClick: () => setIsAddModalOpen(true) }}
          />
        </div>
      </div>

      {/* Add Course Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Add Academic Course (FR-7.1)
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCourse} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                    placeholder="e.g. CSC 202"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Credit Units
                  </label>
                  <input
                    type="number"
                    value={creditUnits}
                    onChange={(e) => setCreditUnits(Number(e.target.value))}
                    min={1}
                    max={6}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Computer Programming II"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={1}>First Semester</option>
                    <option value={2}>Second Semester</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={isGeneral}
                      onChange={(e) => setIsGeneral(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>General Course (FR-7.2)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Course
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
