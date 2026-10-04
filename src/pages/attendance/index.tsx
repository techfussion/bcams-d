/**
 * Class Attendance Records Ledger
 * 
 * Administrative attendance ledger scoped by institutional role:
 * - Super Admin: Institution-wide attendance events
 * - HOD: Faculty/Department attendance scope
 * - Lecturer: Own assigned courses attendance
 * 
 * Features:
 * - Date-based event grouping & Date-range filtering
 * - Removed "Launch Active Capture" button (capture entered via capturer workflow)
 * - Removed "Scanner Connected" badge from administrative ledger
 * - Course, session, and student search filters
 * - Enterprise pagination across all records
 * - Scoped CSV Export
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { SyncStatusBadge } from '@/components/common/status-indicators';
import { PageSkeleton, EmptyState } from '@/components/common/empty-error-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { formatDate, formatTime } from '@/lib/utils';
import { isLecturer, isSuperAdmin, isHOD } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { AttendanceEvent, Session, CourseOffering } from '@/types';
import {
  Fingerprint, Clock, Download, Search, Calendar,
  Building2, Layers, ShieldCheck, BookOpen, UserCheck,
} from 'lucide-react';

export function AttendancePage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Grouping & Filters
  const [groupByDate, setGroupByDate] = useState(true);
  const [startDate, setStartDate] = useState('2026-09-20');
  const [endDate, setEndDate] = useState('2026-10-04');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const allSessions = await api.getSessions(scopeDeptId);

      // Lecturer course scoping
      let relevantSessions = allSessions;
      if (user?.role === 'lecturer') {
        relevantSessions = allSessions.filter(s =>
          s.lecturerId === user.staffId ||
          s.substituteLecturerId === user.staffId ||
          s.lecturerName.toLowerCase().includes(user.fullName.toLowerCase())
        );
      }
      setSessions(relevantSessions);

      // Load attendance events for all scoped sessions
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Session ID to Course Code map
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    sessions.forEach(s => map.set(s.id, s));
    return map;
  }, [sessions]);

  // Filtered dataset
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedSessionFilter !== 'all' && e.sessionId !== selectedSessionFilter) return false;
      const eventDate = e.timestamp.split('T')[0];
      if (startDate && eventDate < startDate) return false;
      if (endDate && eventDate > endDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = e.studentName.toLowerCase().includes(q);
        const matchMatric = e.matricNumber.toLowerCase().includes(q);
        const sess = sessionMap.get(e.sessionId);
        const matchCourse = sess?.courseCode.toLowerCase().includes(q) || sess?.courseTitle.toLowerCase().includes(q);
        if (!matchName && !matchMatric && !matchCourse) return false;
      }
      return true;
    });
  }, [events, selectedSessionFilter, startDate, endDate, searchQuery, sessionMap]);

  // Date Grouped Events (Section 34)
  const groupedEvents = useMemo(() => {
    const groups: Record<string, AttendanceEvent[]> = {};
    filteredEvents.forEach(e => {
      const dateKey = formatDate(e.timestamp);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEvents]);

  const handleExportCSV = () => {
    const csv = generateCSV(filteredEvents, [
      { header: 'Event ID', accessor: e => e.id },
      { header: 'Date', accessor: e => e.timestamp.split('T')[0] },
      { header: 'Time Captured', accessor: e => formatTime(e.timestamp) },
      { header: 'Matric Number', accessor: e => e.matricNumber },
      { header: 'Student Name', accessor: e => e.studentName },
      { header: 'Course Code', accessor: e => sessionMap.get(e.sessionId)?.courseCode || 'N/A' },
      { header: 'Venue', accessor: e => sessionMap.get(e.sessionId)?.venue || 'N/A' },
      { header: 'Clock Integrity', accessor: e => e.clockIntegrity },
      { header: 'Device Endpoint', accessor: e => e.deviceId },
    ]);
    downloadCSV(csv, `BCAMS_Attendance_Ledger_${startDate}_to_${endDate}.csv`);
    toast.success('Attendance records exported');
  };

  const columns: DataTableColumn<AttendanceEvent>[] = [
    {
      key: 'timestamp',
      header: 'Time Captured',
      sortable: true,
      sortFn: (a, b) => a.timestamp.localeCompare(b.timestamp),
      render: (e) => (
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground font-medium">
            {formatTime(e.timestamp)}
          </span>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Student Personnel',
      sortable: true,
      sortFn: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (e) => (
        <div>
          <p className="font-medium text-foreground text-xs">{e.studentName}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{e.matricNumber}</p>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course & Venue',
      render: (e) => {
        const sess = sessionMap.get(e.sessionId);
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-primary">{sess?.courseCode || 'Course'}</span>
              <span className="text-[10px] text-muted-foreground font-medium">({sess?.venue || 'Allocated Hall'})</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-xs">{sess?.courseTitle}</p>
          </div>
        );
      },
    },
    {
      key: 'integrity',
      header: 'Integrity Check',
      render: (e) => (
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-800 capitalize font-mono">
            {e.clockIntegrity}
          </span>
        </div>
      ),
    },
    {
      key: 'sync',
      header: 'Sync Status',
      render: (e) => <SyncStatusBadge status={e.syncStatus} />,
    },
    {
      key: 'device',
      header: 'Capture Endpoint',
      render: (e) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {e.deviceId}
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
        title="Class Attendance Ledger"
        subtitle={
          user?.role === 'lecturer'
            ? 'Attendance verification records for your assigned courses.'
            : user?.role === 'hod'
            ? `Attendance records for Department of ${user.departmentName}.`
            : 'Institution-wide class attendance verification ledger.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupByDate(!groupByDate)}
              className="gap-2 text-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              {groupByDate ? 'Flat Ledger' : 'Group by Date'}
            </Button>
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
        {/* Scoped Scope Notification Banner */}
        <div className="bg-slate-50 border border-border rounded-lg p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-800">
            <Fingerprint className="h-4 w-4 text-primary" />
            <span>
              {user?.role === 'lecturer'
                ? `Authorized Course Scope: Viewing class records for courses assigned to ${user.fullName}.`
                : user?.role === 'hod'
                ? `Authorized Department Scope: Viewing ${user.departmentName} sessions.`
                : 'Institution-Wide Access: Complete university attendance audit trail.'}
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {filteredEvents.length} Total Captured Scans
          </Badge>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student, matric, or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {/* Date Range: From */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9 w-36 font-mono"
              />
            </div>

            {/* Date Range: To */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 w-36 font-mono"
              />
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
          </div>

          <div className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredEvents.length}</strong> events
          </div>
        </div>

        {/* Display: Date Grouped or Flat Table */}
        {groupByDate ? (
          <div className="space-y-4">
            {groupedEvents.length === 0 ? (
              <EmptyState
                title="No Attendance Events Found"
                description="No student biometric captures match the active filters and date range."
              />
            ) : (
              groupedEvents.map(([date, dateEvents]) => (
                <div key={date} className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-xs text-foreground font-mono">
                        {date}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {dateEvents.length} biometric scans recorded
                    </Badge>
                  </div>
                  <DataTable
                    columns={columns}
                    data={dateEvents}
                    keyField="id"
                    pageSize={25}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-lg shadow-sm">
            <DataTable
              columns={columns}
              data={filteredEvents}
              keyField="id"
              pageSize={25}
              emptyMessage="No attendance events match the specified filters."
            />
          </div>
        )}
      </div>
    </div>
  );
}
