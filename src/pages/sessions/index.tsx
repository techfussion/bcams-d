/**
 * Sessions Page
 * 
 * Lists all class attendance sessions with state filtering.
 * Per SRS FR-9: Draft → Authorized → Active → Closed/Expired
 * Supports session creation with geofence radius and substitute lecturer assignment (FR-8.3).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { SessionStatusBadge } from '@/components/common/status-indicators';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { generateCSV, downloadCSV } from '@/domain';
import { formatDate, formatTime, computeAttendancePercentage } from '@/lib/utils';
import type { Session, SessionState, CourseOffering, Lecturer } from '@/types';
import { Plus, CalendarCheck, MapPin, Users, Download } from 'lucide-react';

export function SessionsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courseOfferings, setCourseOfferings] = useState<CourseOffering[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [substituteLecturerId, setSubstituteLecturerId] = useState('');
  const [venue, setVenue] = useState('Lecture Hall A');
  const [geofenceRadius, setGeofenceRadius] = useState(200);
  const [initialState, setInitialState] = useState<SessionState>('draft');

  useEffect(() => {
    async function loadData() {
      try {
        const [sess, offs, lecs] = await Promise.all([
          api.getSessions(),
          api.getCourseOfferings(user?.role === 'hod' ? user.departmentId : undefined),
          api.getLecturers(user?.role === 'hod' ? user.departmentId : undefined),
        ]);
        setSessions(sess);
        setCourseOfferings(offs);
        setLecturers(lecs);
        if (offs.length > 0) setSelectedOfferingId(offs[0].id);
        if (lecs.length > 0) setSelectedLecturerId(lecs[0].id);
      } catch (err) {
        console.error('Failed to load sessions data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const offering = courseOfferings.find(o => o.id === selectedOfferingId);
    const lecturer = lecturers.find(l => l.id === selectedLecturerId);
    const substitute = lecturers.find(l => l.id === substituteLecturerId);

    if (!offering || !lecturer) return;

    const newSession: Session = {
      id: `sess-${Date.now().toString().slice(-4)}`,
      courseOfferingId: offering.id,
      courseCode: offering.courseCode,
      courseTitle: offering.courseTitle,
      state: initialState,
      lecturerId: lecturer.id,
      lecturerName: lecturer.fullName,
      substituteLecturerId: substitute?.id,
      substituteLecturerName: substitute?.fullName,
      scheduledStart: new Date().toISOString(),
      actualStart: initialState === 'active' ? new Date().toISOString() : undefined,
      geofenceRadius,
      attendanceCount: 0,
      enrolledCount: offering.enrolledStudents || 75,
      createdAt: new Date().toISOString(),
    };

    setSessions([newSession, ...sessions]);
    setIsCreateModalOpen(false);
    toast({
      title: 'Session Created',
      description: `New session for ${newSession.courseCode} created in ${newSession.state} state.`,
      variant: 'success',
    });
    navigate(`/sessions/${newSession.id}`);
  };

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  const handleExportCSV = () => {
    const csv = generateCSV(sessions, [
      { header: 'Session ID', accessor: (s) => s.id },
      { header: 'Course Code', accessor: (s) => s.courseCode },
      { header: 'Course Title', accessor: (s) => s.courseTitle },
      { header: 'Status', accessor: (s) => s.state.toUpperCase() },
      { header: 'Lecturer', accessor: (s) => s.lecturerName },
      { header: 'Substitute', accessor: (s) => s.substituteLecturerName || 'None' },
      { header: 'Scheduled Start', accessor: (s) => (s.scheduledStart ? formatDate(s.scheduledStart) : '—') },
      { header: 'Attendance Count', accessor: (s) => s.attendanceCount },
      { header: 'Enrolled Count', accessor: (s) => s.enrolledCount },
      { header: 'Attendance %', accessor: (s) => `${computeAttendancePercentage(s.attendanceCount, s.enrolledCount)}%` },
    ]);

    downloadCSV(csv, `BCAMS-Sessions-${new Date().toISOString().split('T')[0]}`);
    toast({
      title: 'Sessions Exported',
      description: `Downloaded ${sessions.length} class session records as CSV.`,
      variant: 'success',
    });
  };

  const filteredSessions = activeTab === 'all'
    ? sessions
    : sessions.filter(s => s.state === activeTab);

  const columns: DataTableColumn<Session>[] = [
    {
      key: 'course',
      header: 'Course',
      sortable: true,
      sortFn: (a, b) => a.courseCode.localeCompare(b.courseCode),
      render: (s) => (
        <div>
          <p className="text-body-medium">{s.courseCode}</p>
          <p className="text-helper text-muted-foreground">{s.courseTitle}</p>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'Status',
      render: (s) => <SessionStatusBadge state={s.state} />,
    },
    {
      key: 'lecturer',
      header: 'Lecturer',
      render: (s) => (
        <div>
          <p className="text-body">{s.lecturerName}</p>
          {s.substituteLecturerName && (
            <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
              Substitute: {s.substituteLecturerName}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'geofence',
      header: 'Geofence',
      render: (s) => (
        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3 text-primary" />
          {s.geofenceRadius}m
        </span>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      render: (s) => (
        <div className="flex items-center gap-2">
          <span className="text-body-medium">{s.attendanceCount}/{s.enrolledCount}</span>
          <Badge variant="muted" className="text-[10px]">
            {computeAttendancePercentage(s.attendanceCount, s.enrolledCount)}%
          </Badge>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date & Time',
      sortable: true,
      sortFn: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (s) => (
        <div>
          <p className="text-body">{formatDate(s.actualStart || s.scheduledStart || s.createdAt)}</p>
          {s.actualStart && (
            <p className="text-helper text-muted-foreground font-mono">
              {formatTime(s.actualStart)}{s.actualEnd ? ` — ${formatTime(s.actualEnd)}` : ' (Live)'}
            </p>
          )}
        </div>
      ),
    },
  ];

  const stateCounts = sessions.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Class Sessions"
        subtitle="Manage lecture attendance sessions, lecturer authorization, and geofence perimeters"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Session
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-page space-y-section animate-fade-in">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All ({sessions.length})</TabsTrigger>
                <TabsTrigger value="active">Active ({stateCounts.active || 0})</TabsTrigger>
                <TabsTrigger value="authorized">Authorized ({stateCounts.authorized || 0})</TabsTrigger>
                <TabsTrigger value="draft">Draft ({stateCounts.draft || 0})</TabsTrigger>
                <TabsTrigger value="closed">Closed ({stateCounts.closed || 0})</TabsTrigger>
                <TabsTrigger value="expired">Expired ({stateCounts.expired || 0})</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab}>
              <DataTable
                columns={columns}
                data={filteredSessions}
                isLoading={isLoading}
                searchPlaceholder="Search sessions..."
                onRowClick={(s) => navigate(`/sessions/${s.id}`)}
                getRowId={(s) => s.id}
                selectable={true}
                selectedIds={selectedSessionIds}
                onSelectionChange={setSelectedSessionIds}
                emptyTitle="No sessions found"
                emptyDescription="No class attendance sessions match the selected status."
                emptyAction={{
                  label: 'Create Session',
                  onClick: () => setIsCreateModalOpen(true),
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Create Session Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Create Class Session
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Course Offering
                </label>
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {courseOfferings.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.courseCode} — {co.courseTitle} ({co.enrolledStudents} students)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Primary Lecturer
                  </label>
                  <select
                    value={selectedLecturerId}
                    onChange={(e) => setSelectedLecturerId(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {lecturers.map((lec) => (
                      <option key={lec.id} value={lec.id}>
                        {lec.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Substitute Lecturer (Optional)
                  </label>
                  <select
                    value={substituteLecturerId}
                    onChange={(e) => setSubstituteLecturerId(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">None (Primary Lecturer)</option>
                    {lecturers.map((lec) => (
                      <option key={lec.id} value={lec.id}>
                        {lec.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Teaching Venue / Room
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Lecture Hall B"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Geofence Radius (meters)
                  </label>
                  <input
                    type="number"
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                    min={50}
                    max={1000}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Initial Lifecycle State
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background cursor-pointer hover:border-primary/50">
                    <input
                      type="radio"
                      name="state"
                      value="draft"
                      checked={initialState === 'draft'}
                      onChange={() => setInitialState('draft')}
                      className="text-primary"
                    />
                    <div>
                      <span className="font-semibold block text-foreground">Draft Session</span>
                      <span className="text-[10px] text-muted-foreground">Pending lecturer biometric authorization</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background cursor-pointer hover:border-primary/50">
                    <input
                      type="radio"
                      name="state"
                      value="authorized"
                      checked={initialState === 'authorized'}
                      onChange={() => setInitialState('authorized')}
                      className="text-primary"
                    />
                    <div>
                      <span className="font-semibold block text-foreground">Pre-Authorized</span>
                      <span className="text-[10px] text-muted-foreground">Ready for class rep capture handover</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create Session
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
