/**
 * Courses Page — Full CRUD & Scope-Aware
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { CourseFormDialog } from '@/components/academic';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { isSuperAdmin, isHOD, isLecturer, canManageCourses } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import { BulkImportDialog } from '@/components/common/bulk-import-dialog';
import type { Course, Department, Lecturer } from '@/types';
import {
  Plus, BookOpen, Search, Filter, Building2,
  Calendar, Edit2, Users, Archive, CheckCircle2, RotateCcw,
  Download, Upload,
} from 'lucide-react';

const SAMPLE_COURSE_CSV = "code,title,creditUnits,level,semester,department,isGeneral\n" +
  "CSC 205,Operating Systems & Concurrency,3,200,1,Computer Science,false\n" +
  "CSC 307,Algorithms & Complexity Analysis,3,300,1,Computer Science,false\n" +
  "GST 102,Philosophy and Logic,2,100,2,Computer Science,true";

export function CoursesPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filtering
  const [academicSessionFilter, setAcademicSessionFilter] = useState('2026/2027');
  const [deptFilter, setDeptFilter] = useState<string>(
    user?.role === 'hod' ? (user.departmentId || 'all') : 'all'
  );
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDept, setExportDept] = useState('all');
  const [exportSession, setExportSession] = useState('all');
  const [exportSemester, setExportSemester] = useState('all');
  const [exportLevel, setExportLevel] = useState('all');
  const [exportStatus, setExportStatus] = useState('all');

  // Edit Course State (Section 22)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUnits, setEditUnits] = useState('3');
  const [editLevel, setEditLevel] = useState('100');
  const [editSemester, setEditSemester] = useState('1');
  const [editIsGeneral, setEditIsGeneral] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Assign Lecturer State (Section 23)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [courseForAssign, setCourseForAssign] = useState<Course | null>(null);
  const [selectedPrimaryLecturerId, setSelectedPrimaryLecturerId] = useState('');
  const [selectedSubstituteLecturerId, setSelectedSubstituteLecturerId] = useState('');
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const lecturerId = user?.role === 'lecturer' ? (user.staffPersonId || user.staffId || user.id) : undefined;
      const [crs, depts, lecs] = await Promise.all([
        api.getCourses(scopeDeptId, lecturerId),
        api.getDepartments(),
        api.getLecturers(scopeDeptId),
      ]);
      setCourses(crs);
      setDepartments(depts);
      setLecturers(lecs);
    } catch (err) {
      console.error('Failed to load courses:', err);
      toast.error('Failed to load courses curriculum');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCourseCreated = (newCourse: Course) => {
    setCourses(prev => [newCourse, ...prev]);
    toast.success(`${newCourse.code} — ${newCourse.title} registered successfully.`);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: Course) => {
    setCourseToEdit(c);
    setEditTitle(c.title);
    setEditUnits(String(c.creditUnits));
    setEditLevel(String(c.level));
    setEditSemester(String(c.semester));
    setEditIsGeneral(Boolean(c.isGeneral));
    setIsEditModalOpen(true);
  };

  // Save Edit Course
  const handleSaveEdit = async () => {
    if (!courseToEdit) return;
    setIsSavingEdit(true);
    try {
      const updated = await api.updateCourse(courseToEdit.id, {
        title: editTitle,
        creditUnits: Number(editUnits),
        level: Number(editLevel),
        semester: Number(editSemester),
        isGeneral: editIsGeneral,
      });

      setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success(`Updated ${updated.code} — ${updated.title}`);
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error('Failed to update course details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Assign Lecturer Modal
  const handleOpenAssign = (c: Course) => {
    setCourseForAssign(c);
    setSelectedPrimaryLecturerId(c.primaryLecturerId || '');
    setSelectedSubstituteLecturerId(c.substituteLecturerId || '');
    setIsAssignModalOpen(true);
  };

  // Save Lecturer Assignments (Section 23)
  const handleSaveAssignments = async () => {
    if (!courseForAssign) return;
    setIsSavingAssign(true);
    try {
      let updated = courseForAssign;
      if (selectedPrimaryLecturerId) {
        updated = await api.assignLecturerToCourse(courseForAssign.id, selectedPrimaryLecturerId, true, false);
      }
      if (selectedSubstituteLecturerId) {
        updated = await api.assignLecturerToCourse(courseForAssign.id, selectedSubstituteLecturerId, false, true);
      }

      setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success(`Lecturer assignments updated for ${courseForAssign.code}`);
      setIsAssignModalOpen(false);
    } catch (err) {
      toast.error('Failed to update course lecturer assignments');
    } finally {
      setIsSavingAssign(false);
    }
  };

  // Toggle Archive / Deactivate Course
  const handleToggleArchive = async (c: Course) => {
    const newStatus = (c.status === 'archived' ? 'active' : 'archived') as 'active' | 'archived';
    try {
      const updated = await api.updateCourse(c.id, { status: newStatus });
      setCourses(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success(`Course ${c.code} marked as ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update course status');
    }
  };

  const isLecturerUser = user?.role === 'lecturer';

  // Filtered dataset (Lecturer view displays only assigned courses directly without filter controls)
  const filteredCourses = useMemo(() => {
    if (isLecturerUser) {
      return courses;
    }
    return courses.filter(c => {
      if (deptFilter !== 'all' && c.departmentId !== deptFilter) return false;
      if (semesterFilter !== 'all' && String(c.semester) !== semesterFilter) return false;
      if (levelFilter !== 'all' && String(c.level) !== levelFilter) return false;
      if (statusFilter !== 'all' && (c.status || 'active') !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchDept = c.departmentName.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchDept) return false;
      }
      return true;
    });
  }, [courses, isLecturerUser, deptFilter, semesterFilter, levelFilter, statusFilter, searchQuery]);

  // Open Export Modal
  const handleOpenExportModal = () => {
    setExportDept(user?.role === 'hod' ? (user.departmentId || 'all') : deptFilter);
    setExportSession(academicSessionFilter);
    setExportSemester(semesterFilter);
    setExportLevel(levelFilter);
    setExportStatus(statusFilter);
    setIsExportModalOpen(true);
  };

  // Reset Export Modal to all permitted courses
  const handleResetExportFilters = () => {
    if (user?.role === 'super_admin') {
      setExportDept('all');
    }
    setExportSession('all');
    setExportSemester('all');
    setExportLevel('all');
    setExportStatus('all');
  };

  // Filtered dataset for Export Modal (Respects RBAC & user selections)
  const exportMatchingCourses = useMemo(() => {
    return courses.filter(c => {
      if (user?.role === 'hod') {
        if (c.departmentId !== user.departmentId && !c.isGeneral) return false;
      } else if (user?.role === 'super_admin' && exportDept !== 'all') {
        if (c.departmentId !== exportDept) return false;
      }
      if (exportSemester !== 'all' && String(c.semester) !== exportSemester) return false;
      if (exportLevel !== 'all' && String(c.level) !== exportLevel) return false;
      if (exportStatus !== 'all' && (c.status || 'active') !== exportStatus) return false;
      return true;
    });
  }, [courses, user?.role, user?.departmentId, exportDept, exportSemester, exportLevel, exportStatus]);

  // Execute Configured Course Export
  const handleExecuteExport = () => {
    if (exportMatchingCourses.length === 0) {
      toast.warning('No courses match the selected export criteria.');
      return;
    }

    const csvData = generateCSV(exportMatchingCourses, [
      { header: 'Course Code', accessor: c => c.code },
      { header: 'Course Title', accessor: c => c.title },
      { header: 'Credit Units', accessor: c => String(c.creditUnits) },
      { header: 'Department', accessor: c => c.departmentName },
      { header: 'Level', accessor: c => `${c.level}L` },
      { header: 'Semester', accessor: c => `Semester ${c.semester}` },
      { header: 'General / GST', accessor: c => c.isGeneral ? 'Yes' : 'No' },
      { header: 'Primary Lecturer', accessor: c => c.primaryLecturerName || 'Unassigned' },
      { header: 'Substitute Lecturer', accessor: c => c.substituteLecturerName || 'None' },
      { header: 'Status', accessor: c => (c.status || 'active').toUpperCase() },
    ]);

    const deptSuffix = exportDept !== 'all' ? `_${exportDept}` : '';
    const filename = `courses_catalog_${exportSession !== 'all' ? exportSession.replace('/', '-') : 'all'}${deptSuffix}_${new Date().toISOString().split('T')[0]}`;
    downloadCSV(csvData, filename);
    toast.success(`Exported ${exportMatchingCourses.length} course records successfully.`);
    setIsExportModalOpen(false);
  };

  const columns: DataTableColumn<Course>[] = useMemo(() => {
    const cols: DataTableColumn<Course>[] = [
      {
        key: 'code',
        header: 'Course Code',
        sortable: true,
        sortFn: (a, b) => a.code.localeCompare(b.code),
        render: (c) => (
          <div>
            <span className="font-bold text-foreground text-xs font-mono">{c.code}</span>
            {c.isGeneral && (
              <Badge variant="outline" className="text-[9px] bg-primary-50 text-primary border-primary-200 ml-1.5 font-medium">
                GST General
              </Badge>
            )}
          </div>
        ),
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
        header: 'Level / Units',
        sortable: true,
        sortFn: (a, b) => a.level - b.level,
        render: (c) => (
          <span className="text-xs font-mono text-muted-foreground">
            {c.level}L • <strong className="text-foreground">{c.creditUnits} CU</strong>
          </span>
        ),
      },
      {
        key: 'semester',
        header: 'Semester',
        render: (c) => <span className="text-xs font-mono text-muted-foreground">Sem {c.semester}</span>,
      },
      {
        key: 'lecturers',
        header: 'Teaching Assignment',
        render: (c) => (
          <div className="space-y-0.5">
            {c.primaryLecturerName ? (
              <div className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                <span className="text-emerald-700 font-bold">•</span>
                <span className="truncate max-w-[140px]">{c.primaryLecturerName}</span>
                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">Primary</Badge>
              </div>
            ) : (
              <span className="text-[11px] text-amber-700 italic">No primary assigned</span>
            )}
            {c.substituteLecturerName && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="text-blue-600 font-bold">•</span>
                <span className="truncate max-w-[140px]">{c.substituteLecturerName}</span>
                <Badge variant="secondary" className="text-[8px] py-0 px-1 font-mono">Sub</Badge>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (c) => {
          const isArchived = c.status === 'archived';
          return (
            <Badge
              variant={isArchived ? 'outline' : 'success'}
              className="text-[10px] uppercase font-mono"
            >
              {isArchived ? 'Archived' : 'Active'}
            </Badge>
          );
        },
      },
    ];

    // Lecturer My Courses must be read-only (Section 18)
    if (canManageCourses(user)) {
      cols.push({
        key: 'actions',
        header: 'Actions',
        render: (c) => (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenEdit(c)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-100"
              title="Edit Course Details"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenAssign(c)}
              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              title="Assign Primary & Substitute Lecturers"
            >
              <Users className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToggleArchive(c)}
              className={`h-7 w-7 p-0 ${c.status === 'archived' ? 'text-amber-600 hover:text-amber-800' : 'text-slate-400 hover:text-rose-600'}`}
              title={c.status === 'archived' ? 'Restore Active Course' : 'Archive Course'}
            >
              {c.status === 'archived' ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ),
      });
    }

    return cols;
  }, [user]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={user?.role === 'lecturer' ? 'My Courses' : 'Curriculum & Courses'}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenExportModal}
              className="gap-1.5 shadow-sm text-xs"
            >
              <Download className="h-4 w-4" />
              Export Courses
            </Button>

            {canManageCourses(user) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsImportModalOpen(true)}
                  className="gap-1.5 shadow-sm text-xs"
                >
                  <Upload className="h-4 w-4" />
                  Bulk Import
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="gap-1.5 shadow-sm bg-primary hover:bg-primary-600 text-white text-xs"
                >
                  <Plus className="h-4 w-4" />
                  Add Course
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Filter Toolbar — Hidden in simplified Lecturer My Courses view (Section 18) */}
        {!isLecturerUser && (
          <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by code, title, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Academic Session Filter (Section 37) */}
              <div className="w-[170px]">
                <Select value={academicSessionFilter} onValueChange={setAcademicSessionFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Academic Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026/2027" className="text-xs">2026/2027 (Current)</SelectItem>
                    <SelectItem value="2025/2026" className="text-xs">2025/2026 (Historical)</SelectItem>
                    <SelectItem value="all" className="text-xs">All Sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter (Super Admin institution-wide, HOD scoped) */}
              <div className="w-[180px]">
                <Select
                  value={deptFilter}
                  onValueChange={setDeptFilter}
                  disabled={user?.role === 'hod'}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin(user) && <SelectItem value="all" className="text-xs">All Departments</SelectItem>}
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Semester Filter */}
              <div className="w-[130px]">
                <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Semesters</SelectItem>
                    <SelectItem value="1" className="text-xs">1st Semester</SelectItem>
                    <SelectItem value="2" className="text-xs">2nd Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Level Filter */}
              <div className="w-[120px]">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Levels</SelectItem>
                    <SelectItem value="100" className="text-xs">100L</SelectItem>
                    <SelectItem value="200" className="text-xs">200L</SelectItem>
                    <SelectItem value="300" className="text-xs">300L</SelectItem>
                    <SelectItem value="400" className="text-xs">400L</SelectItem>
                    <SelectItem value="500" className="text-xs">500L</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-[120px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Status</SelectItem>
                    <SelectItem value="active" className="text-xs">Active</SelectItem>
                    <SelectItem value="archived" className="text-xs">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Displaying <strong className="text-foreground">{filteredCourses.length}</strong> course offerings
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredCourses}
            pageSize={25}
            emptyMessage={isLecturerUser ? "No assigned courses found for your lecturer profile." : "No courses registered match the specified filter parameters."}
          />
        </div>
      </div>

      {/* Course Creation Dialog */}
      <CourseFormDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        departments={departments}
        onSubmit={handleCourseCreated}
      />

      {/* Edit Course Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Edit Course Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update curriculum parameters for {courseToEdit?.code} ({courseToEdit?.departmentName}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Course Title</label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Credit Units</label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={editUnits}
                  onChange={e => setEditUnits(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Level</label>
                <Select value={editLevel} onValueChange={setEditLevel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100" className="text-xs">100L</SelectItem>
                    <SelectItem value="200" className="text-xs">200L</SelectItem>
                    <SelectItem value="300" className="text-xs">300L</SelectItem>
                    <SelectItem value="400" className="text-xs">400L</SelectItem>
                    <SelectItem value="500" className="text-xs">500L</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Semester</label>
                <Select value={editSemester} onValueChange={setEditSemester}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">1st Sem</SelectItem>
                    <SelectItem value="2" className="text-xs">2nd Sem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-border rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsGeneral}
                  onChange={e => setEditIsGeneral(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-ring h-4 w-4"
                />
                <span className="font-semibold text-foreground text-xs">
                  General / Cross-Faculty Course (GST)
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground ml-6 mt-0.5">
                Students across any faculty or department can enroll in this course.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingEdit || !editTitle.trim()}
              onClick={handleSaveEdit}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Lecturers Dialog (Section 23) */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Assign Course Lecturers
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign Primary Lecturer and Approved Substitute for {courseForAssign?.code} ({courseForAssign?.title}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">1. Primary Assigned Lecturer</label>
              <Select value={selectedPrimaryLecturerId} onValueChange={setSelectedPrimaryLecturerId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select primary lecturer..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {lecturers.map(l => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      {l.fullName} ({l.departmentName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Primary instructor responsible for curriculum delivery and biometric class session start/close.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">2. Approved Substitute Lecturer (Optional)</label>
              <Select value={selectedSubstituteLecturerId} onValueChange={setSelectedSubstituteLecturerId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select approved substitute..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="" className="text-xs italic text-muted-foreground">None (No substitute)</SelectItem>
                  {lecturers.filter(l => l.id !== selectedPrimaryLecturerId).map(l => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      {l.fullName} ({l.departmentName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Authorized backup instructor who can biometrically authorize sessions if the primary lecturer is unavailable.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingAssign}
              onClick={handleSaveAssignments}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {isSavingAssign ? 'Saving...' : 'Save Assignments'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Bulk Import Dialog */}
      <BulkImportDialog
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        entityType="course"
        title="Bulk Import Courses"
        description="Upload a CSV spreadsheet to register courses into the curriculum catalog."
        templateFilename="BCAMS_Course_Import_Template.csv"
        sampleCSV={SAMPLE_COURSE_CSV}
        onImport={async (validRecords) => {
          return await api.bulkImportCourses(validRecords);
        }}
        onSuccess={() => {
          loadData(true);
          toast.success('Course catalog updated successfully.');
        }}
        existingData={{
          departments,
          courses,
        }}
        userRole={user?.role}
        userDepartmentId={user?.departmentId}
        userDepartmentName={user?.departmentName}
      />

      {/* Configurable Course Export Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Export Course Catalog
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure parameters and filters before generating the course export CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Filter Configuration Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Department: Super Admin Selectable; HOD Locked */}
              {user?.role === 'super_admin' && (
                <div className="space-y-1">
                  <label className="text-muted-foreground font-medium">Department</label>
                  <Select value={exportDept} onValueChange={setExportDept}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {user?.role === 'hod' && (
                <div className="space-y-1">
                  <label className="text-muted-foreground font-medium">Department</label>
                  <div className="flex items-center gap-2 h-8 px-2.5 border border-border rounded-md bg-muted/40 text-xs text-foreground font-medium">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{user?.departmentName || 'Authorized Department'}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1 border-muted-foreground/30">
                      Department Locked
                    </Badge>
                  </div>
                </div>
              )}

              {isLecturerUser && (
                <div className="space-y-1">
                  <label className="text-muted-foreground font-medium">Scope</label>
                  <div className="flex items-center gap-2 h-8 px-2.5 border border-border rounded-md bg-muted/40 text-xs text-foreground font-medium">
                    <span className="truncate">Assigned Courses Only</span>
                    <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1 border-muted-foreground/30">
                      Lecturer Locked
                    </Badge>
                  </div>
                </div>
              )}

              {/* Academic Session */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Academic Session</label>
                <Select value={exportSession} onValueChange={setExportSession}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Permitted Sessions</SelectItem>
                    <SelectItem value="2026/2027" className="text-xs">2026/2027 (Current)</SelectItem>
                    <SelectItem value="2025/2026" className="text-xs">2025/2026 (Historical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Semester */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Semester</label>
                <Select value={exportSemester} onValueChange={setExportSemester}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Semesters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Semesters</SelectItem>
                    <SelectItem value="1" className="text-xs">1st Semester</SelectItem>
                    <SelectItem value="2" className="text-xs">2nd Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Level */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Academic Level</label>
                <Select value={exportLevel} onValueChange={setExportLevel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Levels</SelectItem>
                    <SelectItem value="100" className="text-xs">100L</SelectItem>
                    <SelectItem value="200" className="text-xs">200L</SelectItem>
                    <SelectItem value="300" className="text-xs">300L</SelectItem>
                    <SelectItem value="400" className="text-xs">400L</SelectItem>
                    <SelectItem value="500" className="text-xs">500L</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Course Status</label>
                <Select value={exportStatus} onValueChange={setExportStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="active" className="text-xs">Active Only</SelectItem>
                    <SelectItem value="archived" className="text-xs">Archived Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Option to Export All Permitted Courses */}
              <div className="col-span-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetExportFilters}
                  className="text-xs text-primary hover:text-primary-700 h-7 px-2"
                >
                  Reset to All Permitted Courses
                </Button>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1 border border-border/50">
              <p className="font-semibold text-foreground">Export Summary</p>
              <p className="text-muted-foreground">
                Matches <strong className="text-foreground">{exportMatchingCourses.length}</strong> course record{exportMatchingCourses.length === 1 ? '' : 's'} ready for CSV download.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteExport}
              disabled={exportMatchingCourses.length === 0}
              className="gap-1.5 bg-primary hover:bg-primary-600 text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
