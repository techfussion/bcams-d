/**
 * Sessions Page — Authoritative Flat Ledger & Filter Model
 * 
 * Features:
 * - Default Flat Paginated Ledger (single pagination stream, Section 13 & 14)
 * - Optional subtle date separators within the flat stream
 * - Filters: Academic Session (2026/2027 default, 2025/2026 historical), Department (Super Admin), Semester, Course, Lifecycle State
 * - Lifecycle states: Active, Closed, Expired (Timeout). Removed 'Draft' (Section 11)
 * - Capturer guard: Student Capturers are redirected to capture workspace (Section 6)
 * - Enterprise CSV export & source-backed query model
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { SessionStatusBadge } from '@/components/common/status-indicators';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { generateCSV, downloadCSV } from '@/domain';
import { formatDate, formatTime, computeAttendancePercentage } from '@/lib/utils';
import { isSessionCapturer, isSuperAdmin, isHOD, isLecturer } from '@/lib/permissions';
import type { Session, Department, Course } from '@/types';
import {
  Download, Search, Calendar, Building2, BookOpen,
} from 'lucide-react';

export function SessionsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Capturer redirection: Capturers do not have general administrative session history
  useEffect(() => {
    if (isSessionCapturer(user)) {
      navigate('/attendance/capture', { replace: true });
    }
  }, [user, navigate]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [academicSessionFilter, setAcademicSessionFilter] = useState<string>('2026/2027');
  const [departmentFilter, setDepartmentFilter] = useState<string>(
    user?.role === 'hod' ? (user.departmentId || 'all') : 'all'
  );
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportAcademicSession, setExportAcademicSession] = useState('2026/2027');
  const [exportSemester, setExportSemester] = useState('all');
  const [exportDept, setExportDept] = useState('all');
  const [exportStatus, setExportStatus] = useState('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const isAdmin = isSuperAdmin(user);
  const isHodUser = isHOD(user);
  const isLecturerUser = isLecturer(user);

  useEffect(() => {
    if (isSessionCapturer(user)) return;

    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [allSessions, allDepts, allCourses] = await Promise.all([
          api.getSessions(),
          api.getDepartments(),
          api.getCourses(),
        ]);

        if (!isMounted) return;

        // Role-scoping filter:
        let scoped = allSessions;
        if (isLecturerUser) {
          const lecId = user?.staffPersonId || user?.staffId || user?.id;
          scoped = allSessions.filter(s => s.lecturerId === lecId || s.substituteLecturerId === lecId);
        } else if (isHodUser && user?.departmentId) {
          scoped = allSessions.filter(s => s.departmentId === user.departmentId);
        }

        setSessions(scoped);
        setDepartments(allDepts);
        setCourses(allCourses);
      } catch (err) {
        console.error('Failed to load sessions data:', err);
        toast.error('Failed to load sessions');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [user, isAdmin, isHodUser, isLecturerUser]);

  // Filtered dataset
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // 1. User-facing lifecycle: Active, Closed, Expired (No Draft)
      if (s.state !== 'active' && s.state !== 'closed' && s.state !== 'expired') return false;

      // 2. Lifecycle Status filter
      if (statusFilter !== 'all' && s.state !== statusFilter) return false;

      // 3. Academic Session filter (2026/2027 by default, 2025/2026 historical)
      if (academicSessionFilter !== 'all' && s.academicSession && s.academicSession !== academicSessionFilter) {
        return false;
      }

      // 4. Department filter (Super Admin selectable; HOD locked)
      if (departmentFilter !== 'all' && s.departmentId !== departmentFilter) {
        return false;
      }

      // 5. Semester filter
      if (semesterFilter !== 'all' && s.semester && String(s.semester) !== semesterFilter) {
        return false;
      }

      // 6. Course filter
      if (courseFilter !== 'all' && s.courseCode !== courseFilter) {
        return false;
      }

      // 7. Date range filter
      const sessionDate = s.createdAt.split('T')[0];
      if (startDate && sessionDate < startDate) return false;
      if (endDate && sessionDate > endDate) return false;

      // 8. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = s.courseCode.toLowerCase().includes(q);
        const matchTitle = s.courseTitle.toLowerCase().includes(q);
        const matchLec = s.lecturerName.toLowerCase().includes(q);
        const matchVenue = (s.venue || '').toLowerCase().includes(q);
        const matchDept = (s.departmentName || '').toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchLec && !matchVenue && !matchDept) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    sessions, statusFilter, academicSessionFilter, departmentFilter,
    semesterFilter, courseFilter, startDate, endDate, searchQuery,
  ]);

  // Filtered dataset for Export Modal
  const exportMatchingSessions = useMemo(() => {
    return sessions.filter(s => {
      // 1. User-facing lifecycle only
      if (s.state !== 'active' && s.state !== 'closed' && s.state !== 'expired') return false;

      // 2. Lifecycle Status filter
      if (exportStatus !== 'all' && s.state !== exportStatus) return false;

      // 3. Academic Session filter
      if (exportAcademicSession !== 'all' && s.academicSession && s.academicSession !== exportAcademicSession) {
        return false;
      }

      // 4. Department filter (Super Admin selectable; HOD strictly locked to their department)
      const effectiveDept = isHodUser ? user?.departmentId : (isAdmin ? exportDept : user?.departmentId);
      if (effectiveDept && effectiveDept !== 'all' && s.departmentId !== effectiveDept) {
        return false;
      }

      // 5. Semester filter
      if (exportSemester !== 'all' && s.semester && String(s.semester) !== exportSemester) {
        return false;
      }

      // 6. Date range filter
      const sessionDate = s.createdAt.split('T')[0];
      if (exportStartDate && sessionDate < exportStartDate) return false;
      if (exportEndDate && sessionDate > exportEndDate) return false;

      return true;
    });
  }, [
    sessions, exportStatus, exportAcademicSession, exportDept,
    exportSemester, exportStartDate, exportEndDate, isAdmin, isHodUser, user,
  ]);

  const handleExecuteExport = async () => {
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      toast.error('Start date cannot be after end date');
      return;
    }

    if (exportMatchingSessions.length === 0) {
      toast.warning('No sessions match the selected export criteria');
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCSV(exportMatchingSessions, [
        { header: 'Session ID', accessor: s => s.id },
        { header: 'Academic Session', accessor: s => s.academicSession || '2026/2027' },
        { header: 'Semester', accessor: s => s.semester ? `Semester ${s.semester}` : 'Semester 1' },
        { header: 'Department', accessor: s => s.departmentName || 'Computer Science' },
        { header: 'Course Code', accessor: s => s.courseCode },
        { header: 'Course Title', accessor: s => s.courseTitle },
        { header: 'Venue', accessor: s => s.venue || 'Allocated Venue' },
        { header: 'Status', accessor: s => s.state.toUpperCase() },
        { header: 'Authorizing Lecturer', accessor: s => s.lecturerName },
        { header: 'Authorization Type', accessor: s => s.authorizationType || 'primary' },
        { header: 'Attendance Count', accessor: s => String(s.attendanceCount) },
        { header: 'Enrolled Count', accessor: s => String(s.enrolledCount) },
        { header: 'Date', accessor: s => s.createdAt.split('T')[0] },
      ]);
      const sessionSuffix = exportAcademicSession !== 'all' ? exportAcademicSession.replace('/', '-') : 'All_Sessions';
      downloadCSV(csv, `BCAMS_Class_Sessions_${sessionSuffix}_${Date.now()}.csv`);
      toast.success(`Exported ${exportMatchingSessions.length} class sessions`);
      setIsExportOpen(false);
    } catch {
      toast.error('Failed to export session records');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<Session>[] = [
    {
      key: 'course',
      header: 'Course & Venue',
      sortable: true,
      sortFn: (a, b) => a.courseCode.localeCompare(b.courseCode),
      render: (s) => (
        <div className="max-w-[280px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground font-mono flex-shrink-0">{s.courseCode}</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-slate-50 border-slate-200 truncate max-w-[160px] inline-block"
              title={s.venue || 'Allocated Hall'}
            >
              {s.venue || 'Allocated Hall'}
            </Badge>
          </div>
          <p
            className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[260px]"
            title={s.courseTitle}
          >
            {s.courseTitle}
          </p>
        </div>
      ),
    },
    {
      key: 'context',
      header: 'Academic Context',
      render: (s) => (
        <div className="text-xs space-y-0.5 max-w-[160px]">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground whitespace-nowrap">{s.academicSession || '2026/2027'}</span>
            <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono flex-shrink-0">
              Sem {s.semester || 1}
            </Badge>
          </div>
          <p
            className="text-[11px] text-muted-foreground truncate max-w-[150px]"
            title={s.departmentName || 'Computer Science'}
          >
            {s.departmentName || 'Computer Science'}
          </p>
        </div>
      ),
    },
    {
      key: 'lecturer',
      header: 'Authorizing Lecturer',
      sortable: true,
      sortFn: (a, b) => a.lecturerName.localeCompare(b.lecturerName),
      render: (s) => (
        <div className="max-w-[220px]">
          <div className="flex items-center gap-1.5">
            <span
              className="font-medium text-foreground text-xs truncate max-w-[200px] inline-block"
              title={s.lecturerName}
            >
              {s.lecturerName}
            </span>
          </div>
          <p
            className="text-[10px] text-muted-foreground truncate max-w-[200px]"
            title={`Created by: ${s.createdByName || 'Student Capturer'}`}
          >
            Created by: {s.createdByName || 'Student Capturer'}
          </p>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Schedule & Timing',
      render: (s) => (
        <div className="font-mono text-xs whitespace-nowrap">
          <p className="text-foreground font-medium">
            {formatTime(s.actualStart || s.scheduledStart || s.createdAt)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(s.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      render: (s) => {
        const pct = computeAttendancePercentage(s.attendanceCount, s.enrolledCount);
        return (
          <div className="space-y-1 min-w-[110px] max-w-[130px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{s.attendanceCount} / {s.enrolledCount}</span>
              <span className="text-muted-foreground font-mono">{pct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'state',
      header: 'Lifecycle State',
      render: (s) => <SessionStatusBadge state={s.state} />,
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sessions/${s.id}`)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Details
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Class Sessions Ledger"
        // subtitle={
        //   isAdmin
        //     ? 'Institution-wide class sessions ledger with academic session and departmental scoping.'
        //     : isHodUser
        //       ? `Class sessions within ${user?.departmentName || 'your department'}.`
        //       : 'Your verified class attendance sessions and authorized lectures.'
        // }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(true)}
              className="gap-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export Sessions
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search course, lecturer, venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {/* Academic Session Filter (Section 12 & 37) */}
            <div className="w-[170px]">
              <Select value={academicSessionFilter} onValueChange={setAcademicSessionFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Academic Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026/2027">2026/2027 (Current)</SelectItem>
                  <SelectItem value="2025/2026">2025/2026 (Historical)</SelectItem>
                  <SelectItem value="all">All Sessions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter (Super Admin ONLY) */}
            {isAdmin && (
              <div className="w-[180px]">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Departments" />
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

            {/* Semester Filter */}
            <div className="w-[120px]">
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  <SelectItem value="1">Semester 1</SelectItem>
                  <SelectItem value="2">Semester 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lifecycle State Filter (Active, Closed, Expired — NO DRAFT!) */}
            <div className="w-[140px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="active">Active Now</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="expired">Expired (Timeout)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range: From */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9 w-32 font-mono"
              />
            </div>

            {/* Date Range: To */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 w-32 font-mono"
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            Showing <strong className="text-foreground">{filteredSessions.length}</strong> sessions
          </div>
        </div>

        {/* ─── Default Flat Paginated Ledger (Section 13) ────────────────── */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredSessions}
            keyField="id"
            pageSize={25}
            pageSizeOptions={[10, 25, 50, 100]}
            emptyTitle="No Class Sessions Found"
            emptyMessage="No class sessions match the specified filters and academic session context."
          />
        </div>
      </div>

      {/* Configurable Export Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Export Class Sessions
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure parameters to generate a CSV export of class session records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Academic Session & Semester */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Academic Session</label>
                <Select value={exportAcademicSession} onValueChange={setExportAcademicSession}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Academic Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026/2027">2026/2027 (Current)</SelectItem>
                    <SelectItem value="2025/2026">2025/2026 (Historical)</SelectItem>
                    <SelectItem value="all">All Sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Semester</label>
                <Select value={exportSemester} onValueChange={setExportSemester}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    <SelectItem value="1">Semester 1</SelectItem>
                    <SelectItem value="2">Semester 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Department: Super Admin Selectable; HOD Locked */}
            {isAdmin && (
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Department</label>
                <Select value={exportDept} onValueChange={setExportDept}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Departments" />
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

            {isHodUser && (
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Department</label>
                <div className="flex items-center gap-2 h-9 px-3 border border-border rounded-md bg-muted/40 text-xs text-foreground font-medium">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{user?.departmentName || 'Authorized Department'}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1 border-muted-foreground/30">
                    Department Locked
                  </Badge>
                </div>
              </div>
            )}

            {/* Status & Lifecycle */}
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Session Status</label>
              <Select value={exportStatus} onValueChange={setExportStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="active">Active Now</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="expired">Expired (Timeout)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range: From / To */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1">From Date</label>
                <Input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
              <div>
                <label className="text-muted-foreground font-medium block mb-1">To Date</label>
                <Input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
              <p className="font-semibold text-foreground">Export Summary</p>
              <p className="text-muted-foreground">
                Matches {exportMatchingSessions.length} session{exportMatchingSessions.length === 1 ? '' : 's'} ready for download.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExecuteExport} disabled={isExporting} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Generating...' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
