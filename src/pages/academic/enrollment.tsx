/**
 * Academic Enrollment Management Page
 * 
 * Separates permanent Student Identity from time-dependent Academic Enrollment.
 * Retains historical academic progression context across sessions (100L -> 200L -> 300L)
 * without altering or corrupting past attendance ledgers.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { PageSkeleton, EmptyState } from '@/components/common/empty-error-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { formatDate } from '@/lib/utils';
import { canManageAcademicEnrollment } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { AcademicEnrollment, Student, Department, Course } from '@/types';
import {
  GraduationCap, Plus, ArrowUpRight, Search, Filter, Download,
  CheckCircle2, BookOpen, Building2, Calendar, History,
} from 'lucide-react';

export function AcademicEnrollmentPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [enrollments, setEnrollments] = useState<AcademicEnrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Progression Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [targetSession, setTargetSession] = useState('2026/2027');
  const [targetLevel, setTargetLevel] = useState<number>(200);
  const [targetSemester, setTargetSemester] = useState<number>(1);
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetProgramme, setTargetProgramme] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [enrollmentsData, studentsData, deptsData, coursesData] = await Promise.all([
        api.getAcademicEnrollments(),
        api.getStudents(),
        api.getDepartments(),
        api.getCourses(),
      ]);

      // Enforce HOD scope
      let filteredEnrollments = enrollmentsData;
      let filteredStudents = studentsData;
      if (user?.role === 'hod' && user.departmentId) {
        filteredEnrollments = enrollmentsData.filter(e => e.departmentId === user.departmentId);
        filteredStudents = studentsData.filter(s => s.departmentId === user.departmentId);
      }

      setEnrollments(filteredEnrollments);
      setStudents(filteredStudents);
      setDepartments(deptsData);
      setCourses(coursesData);
      if (deptsData.length > 0) {
        setTargetDepartmentId(user?.departmentId || deptsData[0].id);
        setTargetProgramme(deptsData[0].name);
      }
    } catch (err) {
      console.error('Failed to load academic enrollments:', err);
      toast.error('Failed to load academic records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Available academic sessions from data
  const availableSessions = useMemo(() => {
    const set = new Set<string>();
    enrollments.forEach(e => set.add(e.academicSession));
    set.add('2026/2027');
    set.add('2025/2026');
    return Array.from(set).sort().reverse();
  }, [enrollments]);

  // Filtered dataset
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(e => {
      if (sessionFilter !== 'all' && e.academicSession !== sessionFilter) return false;
      if (levelFilter !== 'all' && e.level !== Number(levelFilter)) return false;
      if (deptFilter !== 'all' && e.departmentId !== deptFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = e.studentName.toLowerCase().includes(q);
        const matchMatric = e.matricNumber.toLowerCase().includes(q);
        const matchProg = e.programme.toLowerCase().includes(q);
        if (!matchName && !matchMatric && !matchProg) return false;
      }
      return true;
    });
  }, [enrollments, sessionFilter, levelFilter, deptFilter, searchQuery]);

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === selectedStudentId);
    const dept = departments.find(d => d.id === targetDepartmentId);
    if (!student || !dept) {
      toast.error('Please select a student and department');
      return;
    }

    try {
      const newEnrollment: AcademicEnrollment = {
        id: `ae-${student.id}-${targetSession.replace('/', '-')}-${Date.now().toString(36)}`,
        studentId: student.id,
        studentName: student.fullName,
        matricNumber: student.matricNumber,
        academicSession: targetSession,
        departmentId: dept.id,
        departmentName: dept.name,
        programme: targetProgramme || `${dept.name}`,
        level: targetLevel,
        semester: targetSemester,
        status: 'active',
        enrolledCourses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await api.createAcademicEnrollment(newEnrollment);
      setEnrollments(prev => [created, ...prev]);

      // Also update student current level reference without touching past enrollment records
      await api.updateStudent(student.id, {
        currentLevel: targetLevel,
        level: targetLevel,
        currentSession: targetSession,
        academicSession: targetSession,
      });

      toast.success(`Academic Enrollment recorded for ${student.fullName} (${targetLevel}L - ${targetSession})`);
      setIsAddOpen(false);
      setSelectedStudentId('');
    } catch (err) {
      toast.error('Failed to create academic enrollment');
    }
  };

  const handleExportCSV = () => {
    const csv = generateCSV(filteredEnrollments, [
      { header: 'Matric Number', accessor: e => e.matricNumber },
      { header: 'Student Name', accessor: e => e.studentName },
      { header: 'Session', accessor: e => e.academicSession },
      { header: 'Level', accessor: e => `${e.level}L` },
      { header: 'Department', accessor: e => e.departmentName },
      { header: 'Programme', accessor: e => e.programme },
      { header: 'Semester', accessor: e => `Semester ${e.semester}` },
      { header: 'Status', accessor: e => e.status.toUpperCase() },
      { header: 'Enrolled Courses Count', accessor: e => String(e.enrolledCourses.length) },
    ]);
    downloadCSV(csv, `BCAMS_Academic_Enrollments_${sessionFilter === 'all' ? 'All' : sessionFilter}.csv`);
    toast.success('Enrollment records exported successfully');
  };

  const columns: DataTableColumn<AcademicEnrollment>[] = [
    {
      key: 'matricNumber',
      header: 'Matric Number',
      sortable: true,
      sortFn: (a, b) => a.matricNumber.localeCompare(b.matricNumber),
      render: (e) => (
        <span className="font-mono text-xs font-semibold text-primary">
          {e.matricNumber}
        </span>
      ),
    },
    {
      key: 'studentName',
      header: 'Student Name',
      sortable: true,
      sortFn: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (e) => (
        <div>
          <p className="font-medium text-foreground">{e.studentName}</p>
          <p className="text-[11px] text-muted-foreground">{e.programme}</p>
        </div>
      ),
    },
    {
      key: 'academicSession',
      header: 'Session',
      sortable: true,
      sortFn: (a, b) => a.academicSession.localeCompare(b.academicSession),
      render: (e) => (
        <Badge variant="outline" className="font-mono text-xs bg-muted/40">
          {e.academicSession}
        </Badge>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      sortFn: (a, b) => a.level - b.level,
      render: (e) => (
        <Badge variant="secondary" className="font-mono text-xs">
          {e.level}L
        </Badge>
      ),
    },
    {
      key: 'departmentName',
      header: 'Department',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (e) => (
        <span className="text-xs text-muted-foreground">
          {e.departmentName}
        </span>
      ),
    },
    {
      key: 'courses',
      header: 'Course Registrations',
      render: (e) => (
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">
            {e.enrolledCourses.length > 0 ? `${e.enrolledCourses.length} Courses` : 'Standard Curriculum'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <Badge
          variant={e.status === 'active' ? 'success' : e.status === 'completed' ? 'default' : 'warning'}
          className="capitalize text-xs font-medium"
        >
          {e.status}
        </Badge>
      ),
    },
    {
      key: 'enrolledAt',
      header: 'Registered Date',
      render: (e) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDate(e.createdAt)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Academic Enrollment"
        subtitle="Manage student academic progression and term enrollments without altering historical attendance records."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            {canManageAcademicEnrollment(user) && (
              <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-2 bg-primary hover:bg-primary-600 text-white">
                <Plus className="h-4 w-4" />
                Add / Progress Enrollment
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Scoped Information Banner */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-emerald-900">
            <History className="h-4 w-4 text-emerald-700 flex-shrink-0" />
            <span>
              <strong>Identity vs Enrollment Separation:</strong> Moving a student from 100L to 200L updates their current enrollment record while preserving past session ledgers intact.
            </span>
          </div>
          <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-white font-mono">
            {user?.role === 'hod' ? `Scope: ${user.departmentName}` : 'Institution-Wide Registry'}
          </Badge>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student name or matric..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {/* Academic Session Filter */}
            <div className="w-[160px]">
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Academic Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {availableSessions.map(s => (
                    <SelectItem key={s} value={s}>{s} Session</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level Filter */}
            <div className="w-[130px]">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="100">100 Level</SelectItem>
                  <SelectItem value="200">200 Level</SelectItem>
                  <SelectItem value="300">300 Level</SelectItem>
                  <SelectItem value="400">400 Level</SelectItem>
                  <SelectItem value="500">500 Level</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter (Only for Super Admin) */}
            {user?.role === 'super_admin' && (
              <div className="w-[180px]">
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filteredEnrollments.length}</strong> academic records
          </div>
        </div>

        {/* Enrollments Table with Pagination */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredEnrollments}
            keyField="id"
            pageSize={25}
            emptyMessage="No academic enrollment records match the selected criteria."
          />
        </div>
      </div>

      {/* Add / Progression Enrollment Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5 text-primary" />
              Record Academic Progression / Enrollment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Establish a student's academic standing for a specific session. This links them to courses without overwriting historical records.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEnrollment} className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Select Student *
              </label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose student from registry" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.matricNumber} — {s.fullName} ({s.currentLevel || s.level}L)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Target Academic Session *
                </label>
                <Select value={targetSession} onValueChange={setTargetSession}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026/2027">2026/2027 (Current)</SelectItem>
                    <SelectItem value="2025/2026">2025/2026 (Past)</SelectItem>
                    <SelectItem value="2027/2028">2027/2028 (Upcoming)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Academic Level *
                </label>
                <Select value={String(targetLevel)} onValueChange={(v) => setTargetLevel(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 Level</SelectItem>
                    <SelectItem value="200">200 Level</SelectItem>
                    <SelectItem value="300">300 Level</SelectItem>
                    <SelectItem value="400">400 Level</SelectItem>
                    <SelectItem value="500">500 Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Department *
                </label>
                <Select
                  value={targetDepartmentId}
                  onValueChange={(id) => {
                    setTargetDepartmentId(id);
                    const dept = departments.find(d => d.id === id);
                    if (dept) setTargetProgramme(dept.name);
                  }}
                  disabled={user?.role === 'hod'}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Semester *
                </label>
                <Select value={String(targetSemester)} onValueChange={(v) => setTargetSemester(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">First Semester</SelectItem>
                    <SelectItem value="2">Second Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Programme Specification
              </label>
              <Input
                value={targetProgramme}
                onChange={(e) => setTargetProgramme(e.target.value)}
                placeholder="e.g. B.Sc. Computer Science"
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary hover:bg-primary-600 text-white">
                Record Enrollment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
