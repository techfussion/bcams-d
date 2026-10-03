/**
 * Attendance Overview & Hub Page
 * 
 * Central hub for biometric attendance:
 * - Launch biometric capture for active sessions
 * - View attendance logs & verification audit
 * - Filter by course, status, session
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { SessionStatusBadge, ScannerStatusIndicator, SyncStatusBadge } from '@/components/common/status-indicators';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { formatTime } from '@/lib/utils';
import type { Session, AttendanceEvent, ScannerState } from '@/types';
import {
  Fingerprint, CalendarCheck, CheckCircle2,
  PlayCircle, Clock, Users, ArrowRight, ShieldCheck, ShieldAlert
} from 'lucide-react';

export function AttendancePage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [scannerState, setScannerState] = useState<ScannerState>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('all');

  useEffect(() => {
    const unsub = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const allSessions = await api.getSessions();
        setSessions(allSessions);

        // Fetch events for active/recent sessions
        const activeOrRecent = allSessions.slice(0, 3);
        const eventPromises = activeOrRecent.map(s => api.getAttendanceEvents(s.id));
        const eventsArrays = await Promise.all(eventPromises);
        const flattened = eventsArrays.flat().sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setRecentEvents(flattened);
      } catch (err) {
        console.error('Failed to load attendance data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return <PageSkeleton />;
  }

  const activeSessions = sessions.filter(s => s.state === 'active');
  const filteredEvents = selectedSessionFilter === 'all'
    ? recentEvents
    : recentEvents.filter(e => e.sessionId === selectedSessionFilter);

  const eventColumns: DataTableColumn<AttendanceEvent>[] = [
    {
      key: 'timestamp',
      header: 'Time Captured',
      sortable: true,
      render: (event) => (
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">
            {formatTime(event.timestamp)}
          </span>
        </div>
      ),
    },
    {
      key: 'studentName',
      header: 'Student',
      sortable: true,
      render: (event) => (
        <div>
          <p className="font-medium text-foreground">{event.studentName}</p>
          <p className="text-xs text-muted-foreground font-mono">{event.matricNumber}</p>
        </div>
      ),
    },
    {
      key: 'clockIntegrity',
      header: 'Integrity Check',
      render: (event) => {
        if (event.clockIntegrity === 'verified') {
          return (
            <Badge variant="outline" className="bg-success-50 text-success-700 border-success-200 gap-1 text-xs">
              <ShieldCheck className="h-3 w-3" />
              Verified (Hardware)
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-warning-50 text-warning-700 border-warning-200 gap-1 text-xs">
            <ShieldAlert className="h-3 w-3" />
            {event.clockIntegrity}
          </Badge>
        );
      },
    },
    {
      key: 'syncStatus',
      header: 'Sync State',
      render: (event) => (
        <SyncStatusBadge status={event.syncStatus} />
      ),
    },
    {
      key: 'deviceId',
      header: 'Scanner Device',
      render: (event) => (
        <span className="font-mono text-xs text-muted-foreground">
          {event.deviceId}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Biometric Attendance"
        subtitle="Launch real-time attendance capture and inspect the immutable verification ledger."
        actions={
          activeSessions.length > 0 ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate(`/attendance/capture/${activeSessions[0].id}`)}
              className="gap-2 shadow-sm"
            >
              <PlayCircle className="h-4 w-4" />
              Launch Active Capture ({activeSessions[0].courseCode})
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Active Sessions Capture Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Active Sessions Ready for Biometric Capture
              </h2>
              <p className="text-xs text-muted-foreground">
                Addendum 1: Biometric verification only. No manual override.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Hardware Status:</span>
              <ScannerStatusIndicator connected={scannerState !== 'disconnected'} />
            </div>
          </div>

          {activeSessions.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarCheck className="h-10 w-10 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">No active sessions currently running</p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Start or authorize a class session from the Sessions page to begin collecting biometric attendance.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/sessions')}
                  className="mt-4 gap-1.5"
                >
                  Go to Sessions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((session) => (
                <Card
                  key={session.id}
                  className="relative overflow-hidden border-primary/20 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="h-1 bg-primary w-full" />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-foreground">
                            {session.courseCode}
                          </span>
                          <SessionStatusBadge state={session.state} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[200px]">
                          {session.courseTitle}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 p-2 rounded">
                        <span className="text-muted-foreground block text-[11px]">Enrolled</span>
                        <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {session.enrolledCount} Students
                        </span>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <span className="text-muted-foreground block text-[11px]">Attended</span>
                        <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {session.attendanceCount} Scanned
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                      <span className="truncate">Radius: {session.geofenceRadius}m</span>
                      <span className="font-mono">{session.actualStart ? formatTime(session.actualStart) : 'Scheduled'}</span>
                    </div>

                    <Button
                      variant="default"
                      className="w-full gap-2 shadow-sm"
                      onClick={() => navigate(`/attendance/capture/${session.id}`)}
                    >
                      <Fingerprint className="h-4 w-4" />
                      Open Live Capture Screen
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Attendance Verification Ledger */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Attendance Event Ledger
              </h2>
              <p className="text-xs text-muted-foreground">
                Live stream of biometric scans with cryptographic hash and geofence verification
              </p>
            </div>
            {sessions.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Session:</label>
                <select
                  value={selectedSessionFilter}
                  onChange={(e) => setSelectedSessionFilter(e.target.value)}
                  className="text-xs h-8 rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Recent Sessions</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.courseCode} - {s.courseTitle}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DataTable
            data={filteredEvents}
            columns={eventColumns}
            searchable={true}
            searchPlaceholder="Search by student name or matric number..."
            emptyTitle="No attendance events"
            emptyDescription="No biometric attendance events recorded yet."
          />
        </div>
      </div>
    </div>
  );
}
