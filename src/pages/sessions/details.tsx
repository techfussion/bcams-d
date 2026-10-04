/**
 * Session Details Page
 * 
 * Session lifecycle state machine & attendance records:
 * - FR-9.1: Draft → Authorized → Active → Closed
 * - FR-9.2: Lecturer Biometric Authorization via scanner
 * - FR-10.4: Geofence radius verification (default 200m)
 * - Addendum 1: Strictly biometric attendance capture (no manual overrides)
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import {
  SessionStatusBadge,
  SyncStatusBadge,
  ClockIntegrityBadge,
  ScannerStatusIndicator,
} from '@/components/common/status-indicators';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageSkeleton, EmptyState } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { formatTime, computeAttendancePercentage } from '@/lib/utils';
import { useToast } from '@/hooks';
import type { Session, AttendanceEvent, ScannerState } from '@/types';
import {
  ArrowLeft,
  MapPin,
  Fingerprint,
  PlayCircle,
  StopCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

export function SessionDetailsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scannerState, setScannerState] = useState<ScannerState>('disconnected');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => unsub();
  }, []);

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

  // Close Session (Active → Closed)
  const handleConfirmCloseSession = () => {
    const updatedSession: Session = {
      ...session,
      state: 'closed',
      actualEnd: new Date().toISOString(),
    };
    setSession(updatedSession);
    setIsCloseConfirmOpen(false);
    toast({
      title: 'Session Finalized & Locked',
      description: `Class session for ${session.courseCode} closed with ${session.attendanceCount} verified attendees.`,
      variant: 'default',
    });
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
      header: 'Clock Integrity (FR-4)',
      render: (e) => <ClockIntegrityBadge status={e.clockIntegrity} />,
    },
    {
      key: 'syncStatus',
      header: 'Sync State (FR-3)',
      render: (e) => <SyncStatusBadge status={e.syncStatus} />,
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={`${session.courseCode} — Class Session`}
        subtitle={`${session.courseTitle} (${session.enrolledCount} enrolled)`}
        actions={
          <div className="flex items-center gap-2">
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

            {/* Active: Capture & Close controls */}
            {session.state === 'active' && (
              <>
                <Button
                  size="sm"
                  onClick={() => navigate(`/attendance/capture/${session.id}`)}
                  className="gap-2 shadow-sm"
                >
                  <Fingerprint className="h-4 w-4" />
                  Live Attendance Screen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCloseConfirmOpen(true)}
                  className="gap-1.5 text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  <StopCircle className="h-4 w-4 text-rose-600" />
                  Close Session
                </Button>
              </>
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
        {/* Back button & Scanner status */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')} className="gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sessions
          </Button>
          <ScannerStatusIndicator connected={scannerState !== 'disconnected'} />
        </div>

        {authSuccessMessage && (
          <div className="p-3.5 rounded-xl border border-primary-200 bg-primary-50 text-xs font-semibold text-primary-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {authSuccessMessage}
          </div>
        )}

        {/* Session Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Session Lifecycle
              </p>
              <div className="pt-1">
                <SessionStatusBadge state={session.state} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Attendance Scanned
              </p>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-bold text-foreground">
                  {session.attendanceCount}
                </span>
                <span className="text-xs text-muted-foreground">/ {session.enrolledCount} enrolled</span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                  {attendancePercentage}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Conducting Lecturer
              </p>
              <p className="text-sm font-semibold text-foreground truncate pt-1">
                {session.lecturerName}
              </p>
              {session.substituteLecturerName && (
                <p className="text-[11px] text-amber-700 font-medium">
                  Substitute: {session.substituteLecturerName}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Geofence Perimeter
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-xs font-mono font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{session.geofenceRadius}m radius</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Violations outside perimeter rejected (FR-10.5)
              </p>
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
                  {events.length} biometric scan(s) recorded for this session. Non-attendees derived as Absent (FR-10.6).
                </CardDescription>
              </div>
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
              selectable={true}
              selectedIds={selectedEventIds}
              onSelectionChange={setSelectedEventIds}
            />
          </CardContent>
        </Card>
      </div>

      {/* Confirm Session Closure Dialog */}
      <ConfirmDialog
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        title="Finalize & Close Class Session?"
        description={`Closing this session for ${session.courseCode} locks attendance records. No further biometric scans will be accepted, and absent students will be recorded.`}
        variant="warning"
        confirmLabel="Finalize & Close"
        onConfirm={handleConfirmCloseSession}
      />
    </div>
  );
}
