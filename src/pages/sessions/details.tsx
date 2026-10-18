/**
 * Session Details Page
 * 
 * Session lifecycle state machine & attendance records:
 * - Information parity with Sessions ledger: Course, Venue, Academic Session, Semester, Lecturer, Capturer, Schedule, Attendance Progress
 * - Biometric student attendance capture audit ledger
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SessionStatusBadge,
  ClockIntegrityBadge,
} from '@/components/common/status-indicators';
import { PageSkeleton, EmptyState } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { formatDate, formatTime, computeAttendancePercentage } from '@/lib/utils';
import { generateCSV, downloadCSV } from '@/domain';
import { useToast } from '@/hooks';
import type { Session, AttendanceEvent } from '@/types';
import {
  ArrowLeft,
  PlayCircle,
  KeyRound,
  ShieldCheck,
  Download,
} from 'lucide-react';

export function SessionDetailsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportIntegrity, setExportIntegrity] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const exportMatchingEvents = useMemo(() => {
    return events.filter(e => {
      if (exportIntegrity !== 'all' && e.clockIntegrity !== exportIntegrity) {
        return false;
      }
      return true;
    });
  }, [events, exportIntegrity]);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      api.getSession(sessionId),
      api.getAttendanceEvents(sessionId),
    ]).then(([s, e]) => {
      setSession(s);
      setEvents(e);
      setIsLoading(false);
    });
  }, [sessionId]);

  if (isLoading) return <PageSkeleton />;
  if (!session) return <EmptyState title="Session not found" description="This session does not exist." />;

  const attendancePercentage = computeAttendancePercentage(
    session.attendanceCount,
    session.enrolledCount
  );

  // FR-9.2: Lecturer Biometric Authorization
  const handleAuthorizeLecturer = async () => {
    setIsAuthorizing(true);
    setAuthSuccessMessage(null);
    try {
      const result = await scannerService.startCapture();
      if (result.type === 'success' || result.type === 'duplicate') {
        const updatedSession: Session = {
          ...session,
          state: 'authorized',
        };
        setSession(updatedSession);
        setAuthSuccessMessage(`Authorized: Lecturer biometric verified for ${session.courseCode}.`);
        toast({
          title: 'Lecturer Verified',
          description: `Biometric authentication confirmed for ${session.lecturerName}. Session is now authorized to start.`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Authorization Failed',
          description: 'Biometric template did not match the assigned lecturer. Please re-scan.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Scanner Timeout',
        description: 'Biometric sensor timed out. Ensure USB cable is firmly connected.',
        variant: 'destructive',
      });
    } finally {
      setIsAuthorizing(false);
      setTimeout(() => setAuthSuccessMessage(null), 5000);
    }
  };

  // Start Session (Authorized → Active)
  const handleStartSession = () => {
    const updatedSession: Session = {
      ...session,
      state: 'active',
      actualStart: new Date().toISOString(),
    };
    setSession(updatedSession);
    toast({
      title: 'Class Session Started',
      description: `Attendance scanner open for ${session.courseCode}. Students may touch sensor.`,
      variant: 'success',
    });
    navigate(`/attendance/capture/${session.id}`);
  };

  const handleExecuteExport = () => {
    if (exportMatchingEvents.length === 0) {
      toast({
        title: 'No Records to Export',
        description: 'There are no attendance records matching the selected export criteria.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCSV(exportMatchingEvents, [
        { header: 'Session ID', accessor: () => session.id },
        { header: 'Academic Session', accessor: () => session.academicSession || '2026/2027' },
        { header: 'Semester', accessor: () => session.semester ? `Semester ${session.semester}` : 'Semester 1' },
        { header: 'Department', accessor: () => session.departmentName || 'Computer Science' },
        { header: 'Course Code', accessor: () => session.courseCode },
        { header: 'Course Title', accessor: () => session.courseTitle },
        { header: 'Venue', accessor: () => session.venue || 'Allocated Venue' },
        { header: 'Session Date', accessor: () => session.createdAt.split('T')[0] },
        { header: 'Session Time', accessor: () => formatTime(session.actualStart || session.scheduledStart || session.createdAt) },
        { header: 'Authorizing Lecturer', accessor: () => session.lecturerName },
        { header: 'Student Name', accessor: e => e.studentName },
        { header: 'Matric Number', accessor: e => e.matricNumber },
        { header: 'Time Captured', accessor: e => formatTime(e.timestamp) },
        { header: 'Clock Integrity', accessor: e => (e.clockIntegrity || 'VERIFIED').toUpperCase() },
      ]);
      const dateStr = session.createdAt.split('T')[0];
      const cleanCode = session.courseCode.replace(/[\s/]/g, '_');
      downloadCSV(csv, `BCAMS_Session_${cleanCode}_Attendance_${dateStr}`);
      toast({
        title: 'Attendance Exported',
        description: `Exported ${exportMatchingEvents.length} attendance records for ${session.courseCode}.`,
        variant: 'success',
      });
      setIsExportOpen(false);
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Failed to generate session attendance export.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const eventColumns: DataTableColumn<AttendanceEvent>[] = [
    {
      key: 'student',
      header: 'Student',
      sortable: true,
      sortFn: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (e) => (
        <div>
          <p className="font-semibold text-foreground text-xs">{e.studentName}</p>
          <p className="text-xs text-muted-foreground font-mono">{e.matricNumber}</p>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Time Captured',
      sortable: true,
      sortFn: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      render: (e) => (
        <span className="font-mono text-xs text-foreground">
          {formatTime(e.timestamp)}
        </span>
      ),
    },
    {
      key: 'clockIntegrity',
      header: 'Clock Integrity',
      render: (e) => <ClockIntegrityBadge status={e.clockIntegrity} />,
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={`${session.courseCode} — Class Session`}
        subtitle={`${session.courseTitle} (${session.enrolledCount} enrolled)`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(true)}
              className="gap-1.5 text-xs shadow-xs"
              title="Export Individual Session Attendance Records"
            >
              <Download className="h-3.5 w-3.5" />
              Export Attendance
            </Button>

            {/* Draft: Requires Lecturer Biometric Match (FR-9.2) */}
            {session.state === 'draft' && (
              <Button
                size="sm"
                onClick={handleAuthorizeLecturer}
                disabled={isAuthorizing}
                className="gap-2 shadow-sm"
              >
                <KeyRound className="h-4 w-4" />
                {isAuthorizing ? 'Scanning Lecturer Fingerprint...' : 'Authorize via Biometrics'}
              </Button>
            )}

            {/* Authorized: Can Start Attendance */}
            {session.state === 'authorized' && (
              <Button
                size="sm"
                onClick={handleStartSession}
                className="gap-2 shadow-sm"
              >
                <PlayCircle className="h-4 w-4" />
                Start Class & Open Scanner
              </Button>
            )}

            {/* Active Session Status Badge */}
            {session.state === 'active' && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs px-2.5 py-1">
                Session Active & In Progress
              </Badge>
            )}

            {session.state === 'closed' && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs px-2.5 py-1">
                Session Completed & Locked
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Back button */}
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')} className="gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sessions
          </Button>
        </div>

        {authSuccessMessage && (
          <div className="p-3.5 rounded-xl border border-primary-200 bg-primary-50 text-xs font-semibold text-primary-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {authSuccessMessage}
          </div>
        )}

        {/* Session Overview Cards — Information Parity with Sessions Ledger */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Lifecycle & Academic Context */}
          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Session Lifecycle
              </p>
              <div className="pt-0.5">
                <SessionStatusBadge state={session.state} />
              </div>
              <div className="pt-1.5 border-t border-border/60 text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{session.academicSession || '2026/2027'}</span>
                  <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                    Sem {session.semester || 1}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate" title={session.departmentName || 'Computer Science'}>
                  {session.departmentName || 'Computer Science'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Attendance Progress Visualization */}
          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Attendance Recorded
              </p>
              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-2xl font-bold text-foreground">
                  {session.attendanceCount}
                </span>
                <span className="text-xs text-muted-foreground">/ {session.enrolledCount} enrolled</span>
                <Badge variant="outline" className="text-[10px] ml-auto font-mono">
                  {attendancePercentage}%
                </Badge>
              </div>
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {session.attendanceCount} of {session.enrolledCount} enrolled students verified
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Venue & Schedule Timing */}
          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Venue & Timing
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 font-medium">
                  {session.venue || 'Allocated Hall'}
                </Badge>
              </div>
              <div className="pt-1.5 border-t border-border/60 text-xs space-y-0.5 font-mono">
                <div className="text-foreground font-medium">
                  {formatTime(session.actualStart || session.scheduledStart || session.createdAt)}
                  {session.actualEnd && ` – ${formatTime(session.actualEnd)}`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatDate(session.createdAt)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Lecturer & Capturer Identity */}
          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Lecturer & Capturer
              </p>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-foreground truncate" title={session.lecturerName}>
                  {session.lecturerName}
                </p>
                {session.substituteLecturerName && (
                  <p className="text-[11px] text-amber-700 font-medium">
                    Substitute: {session.substituteLecturerName}
                  </p>
                )}
              </div>
              <div className="pt-1.5 border-t border-border/60 text-[11px] text-muted-foreground">
                <span>Capturer: </span>
                <span className="font-medium text-foreground">
                  {session.createdByName || 'Student Capturer'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Records Table */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Verified Student Attendance Records
                </CardTitle>
                <CardDescription className="text-xs">
                  {events.length} biometric scan(s) recorded for this session.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportOpen(true)}
                className="gap-1.5 text-xs shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export Attendance
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={eventColumns}
              data={events}
              searchPlaceholder="Search student by name or matric number..."
              searchFn={(e, q) =>
                e.studentName.toLowerCase().includes(q) ||
                e.matricNumber.toLowerCase().includes(q)
              }
              getRowId={(e) => e.id}
              emptyTitle="No attendance records"
              emptyDescription="No students have been scanned for this session yet."
            />
          </CardContent>
        </Card>
      </div>

      {/* Configurable Session Attendance Export Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Download className="h-4 w-4 text-primary" />
              Export Session Attendance
            </DialogTitle>
            <DialogDescription className="text-xs">
              Export student attendance ledger for {session.courseCode} ({session.courseTitle}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Session Metadata Context Card */}
            <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Course:</span>
                <span className="font-semibold text-foreground">{session.courseCode} — {session.courseTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venue & Date:</span>
                <span className="font-medium text-foreground">{session.venue || 'Allocated Hall'} • {formatDate(session.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Academic Context:</span>
                <span className="font-medium text-foreground">{session.academicSession || '2026/2027'} (Sem {session.semester || 1})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Authorizing Lecturer:</span>
                <span className="font-medium text-foreground">{session.lecturerName}</span>
              </div>
            </div>

            {/* Filter by Clock Integrity */}
            <div className="space-y-1.5">
              <label className="text-muted-foreground font-medium block">Clock Integrity Filter</label>
              <Select value={exportIntegrity} onValueChange={setExportIntegrity}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Verification States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verification States</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="tampered">Tamper Flagged</SelectItem>
                  <SelectItem value="suspicious">Suspicious</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Summary */}
            <div className="p-3 bg-primary-50/60 border border-primary-200 rounded-lg text-primary-950 text-xs">
              {events.length === 0 ? (
                <p className="text-amber-800 font-medium">
                  No student attendance records captured for this session yet.
                </p>
              ) : (
                <p className="font-medium">
                  <strong>{exportMatchingEvents.length}</strong> of <strong>{events.length}</strong> attendance record(s) will be exported.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isExporting || exportMatchingEvents.length === 0}
              onClick={handleExecuteExport}
              className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Exporting...' : 'Download Attendance CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
