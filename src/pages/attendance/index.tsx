/**
 * Class Attendance Records Ledger — Authoritative Domain Implementation
 * 
 * Scoped by institutional role:
 * - Super Admin: Institution-wide attendance events with department filtering
 * - HOD: Faculty/Department attendance scope
 * - Lecturer: Own assigned courses and sessions attendance
 * - Student Session Capturer: Redirected to capture workspace (no historical administration)
 * 
 * Features:
 * - Default Flat Paginated Ledger (single pagination stream, Section 15 & 16)
 * - Academic Session filter (2026/2027 current default, 2025/2026 historical queryable)
 * - Department filter (Super Admin), Semester filter, Course filter
 * - Optional subtle date indicators
 * - Enterprise CSV export
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { SyncStatusBadge } from '@/components/common/status-indicators';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { formatDate, formatTime } from '@/lib/utils';
import { isLecturer, isSuperAdmin, isHOD, isSessionCapturer } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { AttendanceEvent, Session, Department, Course } from '@/types';
import {
  Fingerprint, Download, Search, Calendar,
  Building2, BookOpen,
} from 'lucide-react';

export function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Capturer redirection: Capturers do not administer historical attendance records
  useEffect(() => {
    if (isSessionCapturer(user)) {
      navigate('/attendance/capture', { replace: true });
    }
  }, [user, navigate]);

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
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
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

        // Role-scoping filter for sessions:
        let relevantSessions = allSessions;
        if (isLecturerUser) {
          const lecId = user?.staffPersonId || user?.staffId || user?.id;
          relevantSessions = allSessions.filter(s =>
            s.lecturerId === lecId ||
            s.substituteLecturerId === lecId ||
            s.lecturerName.toLowerCase().includes(user?.fullName.toLowerCase() || '')
          );
        } else if (isHodUser && user?.departmentId) {
          relevantSessions = allSessions.filter(s => s.departmentId === user.departmentId);
        }

        setSessions(relevantSessions);
        setDepartments(allDepts);
        setCourses(allCourses);

        // Fetch attendance events for all relevant sessions
        const eventPromises = relevantSessions.map(s => api.getAttendanceEvents(s.id));
        const eventsArrays = await Promise.all(eventPromises);
        const flattened = eventsArrays.flat().sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setEvents(flattened);
      } catch (err) {
        console.error('Failed to load attendance events:', err);
        toast.error('Failed to load attendance records');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [user, isAdmin, isHodUser, isLecturerUser]);

  // Session ID to Session Object map
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    sessions.forEach(s => map.set(s.id, s));
    return map;
  }, [sessions]);

  // Filtered attendance events dataset
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const sess = sessionMap.get(e.sessionId);

      // 1. Academic Session filter (2026/2027 by default, 2025/2026 historical)
      const eventSessionYear = e.academicSession || sess?.academicSession || '2026/2027';
      if (academicSessionFilter !== 'all' && eventSessionYear !== academicSessionFilter) {
        return false;
      }

      // 2. Department filter
      const eventDeptId = e.departmentId || sess?.departmentId;
      if (departmentFilter !== 'all' && eventDeptId && eventDeptId !== departmentFilter) {
        return false;
      }

      // 3. Semester filter
      const eventSemester = sess?.semester ? String(sess.semester) : undefined;
      if (semesterFilter !== 'all' && eventSemester && eventSemester !== semesterFilter) {
        return false;
      }

      // 4. Course filter
      const eventCourseCode = e.courseCode || sess?.courseCode;
      if (selectedCourseFilter !== 'all' && eventCourseCode !== selectedCourseFilter) {
        return false;
      }

      // 5. Session filter
      if (selectedSessionFilter !== 'all' && e.sessionId !== selectedSessionFilter) {
        return false;
      }

      // 6. Date range filter
      const eventDate = e.timestamp.split('T')[0];
      if (startDate && eventDate < startDate) return false;
      if (endDate && eventDate > endDate) return false;

      // 7. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = e.studentName.toLowerCase().includes(q);
        const matchMatric = e.matricNumber.toLowerCase().includes(q);
        const matchCourse = sess?.courseCode.toLowerCase().includes(q) || sess?.courseTitle.toLowerCase().includes(q);
        const matchDevice = (e.deviceId || '').toLowerCase().includes(q);
        if (!matchName && !matchMatric && !matchCourse && !matchDevice) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    events, sessionMap, academicSessionFilter, departmentFilter, semesterFilter,
    selectedCourseFilter, selectedSessionFilter, startDate, endDate, searchQuery,
  ]);

  const handleExportCSV = () => {
    const csv = generateCSV(filteredEvents, [
      { header: 'Scan ID', accessor: e => e.id },
      { header: 'Session ID', accessor: e => e.sessionId },
      { header: 'Academic Session', accessor: e => e.academicSession || sessionMap.get(e.sessionId)?.academicSession || '2026/2027' },
      { header: 'Course Code', accessor: e => sessionMap.get(e.sessionId)?.courseCode || e.courseCode || 'N/A' },
      { header: 'Course Title', accessor: e => sessionMap.get(e.sessionId)?.courseTitle || 'Course' },
      { header: 'Student Name', accessor: e => e.studentName },
      { header: 'Matric Number', accessor: e => e.matricNumber },
      { header: 'Capture Timestamp', accessor: e => e.timestamp },
      { header: 'Clock Integrity', accessor: e => e.clockIntegrity.toUpperCase() },
      { header: 'Sync Status', accessor: e => e.syncStatus.toUpperCase() },
      { header: 'Device ID', accessor: e => e.deviceId || 'Main Terminal' },
    ]);
    downloadCSV(csv, `BCAMS_Attendance_Ledger_${academicSessionFilter}_${Date.now()}.csv`);
    toast.success('Attendance records exported');
  };

  const columns: DataTableColumn<AttendanceEvent>[] = [
    {
      key: 'student',
      header: 'Student Identification',
      sortable: true,
      sortFn: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (e) => (
        <div>
          <span className="font-medium text-xs text-foreground">{e.studentName}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[11px] text-muted-foreground">{e.matricNumber}</span>
            {e.clockIntegrity === 'suspicious' && (
              <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-mono">
                Suspicious Integrity
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course & Academic Session',
      render: (e) => {
        const sess = sessionMap.get(e.sessionId);
        const acadSession = e.academicSession || sess?.academicSession || '2026/2027';
        return (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground font-mono">{sess?.courseCode || e.courseCode || 'CSC 201'}</span>
              <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200">
                {acadSession}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
              {sess?.courseTitle || 'Class Session'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'timestamp',
      header: 'Capture Timestamp',
      sortable: true,
      sortFn: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      render: (e) => (
        <div className="font-mono text-xs">
          <p className="font-medium text-foreground">{formatTime(e.timestamp)}</p>
          <span className="text-[11px] text-muted-foreground">{formatDate(e.timestamp)}</span>
        </div>
      ),
    },
    {
      key: 'device',
      header: 'Capture Device',
      render: (e) => (
        <div className="font-mono text-xs">
          <span className="text-foreground">{e.deviceId || 'dev-001'}</span>
          <p className="text-[10px] text-muted-foreground">Fixed Terminal</p>
        </div>
      ),
    },
    {
      key: 'sync',
      header: 'Sync State',
      render: (e) => <SyncStatusBadge status={e.syncStatus} />,
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Class Attendance Records"
        subtitle={
          isAdmin
            ? 'Institution-wide audit trail of biometric student attendance captures.'
            : isHodUser
              ? `Attendance capture ledger for ${user?.departmentName || 'your department'} courses.`
              : `Verified attendance records for courses assigned to ${user?.fullName}.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
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
                placeholder="Search student, matric, course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {/* Academic Session Filter (Section 15 & 37) */}
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

            {/* Course Filter */}
            <div className="w-[140px]">
              <Select value={selectedCourseFilter} onValueChange={setSelectedCourseFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Session Filter */}
            <div className="w-[180px]">
              <Select value={selectedSessionFilter} onValueChange={setSelectedSessionFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <BookOpen className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Course Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Class Sessions</SelectItem>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.courseCode} ({formatDate(s.createdAt)})
                    </SelectItem>
                  ))}
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
            Showing <strong className="text-foreground">{filteredEvents.length}</strong> events
          </div>
        </div>

        {/* ─── Default Flat Paginated Ledger (Section 15 & 16) ───────────── */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredEvents}
            keyField="id"
            pageSize={25}
            pageSizeOptions={[10, 25, 50, 100]}
            emptyTitle="No Attendance Events Found"
            emptyMessage="No biometric attendance scans match the specified filters and academic session context."
          />
        </div>
      </div>
    </div>
  );
}
