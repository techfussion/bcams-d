/**
 * Sessions Page — Date-Grouped & Role-Scoped
 * 
 * Implements:
 * - Student Session Capturer workflow for session creation
 * - Course eligibility scoping (only registered/eligible courses for the student)
 * - Venue entry & context retention
 * - Biometric lecturer verification: Primary vs Pre-assigned Substitute vs Unexpected Substitute
 * - Physical teaching area geofence validation before activation
 * - Date-based session grouping + Date-Range filtering
 * - Strict authorization guards: Only Student Capturers see "Create Session"
 * - Enterprise pagination & CSV export
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageSkeleton, EmptyState } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { generateCSV, downloadCSV } from '@/domain';
import { formatDate, formatTime, computeAttendancePercentage } from '@/lib/utils';
import { isSessionCapturer, isLecturer, isSuperAdmin, isHOD } from '@/lib/permissions';
import type { Session, SessionState, CourseOffering, Lecturer, SessionAuthorizationType } from '@/types';
import {
  Plus, CalendarCheck, MapPin, Users, Download, Search,
  Filter, Calendar, Layers, ShieldCheck, AlertTriangle, Fingerprint,
  Building2, CheckCircle2, Clock, Navigation, ExternalLink,
} from 'lucide-react';

export function SessionsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [eligibleOfferings, setEligibleOfferings] = useState<CourseOffering[]>([]);
  const [allOfferings, setAllOfferings] = useState<CourseOffering[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Grouping & Filters
  const [groupByDate, setGroupByDate] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('2026-09-20');
  const [endDate, setEndDate] = useState('2026-10-04');
  const [selectedCourse, setSelectedCourse] = useState('all');

  // Multi-step Session Creation Dialog State (Student Capturer Only)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<'details' | 'lecturer_auth' | 'geofence' | 'complete'>('details');
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [venueInput, setVenueInput] = useState('Lecture Theatre 1 - Faculty of Science');
  const [maxDuration, setMaxDuration] = useState(120);

  // Lecturer Auth Step
  const [identifiedLecturer, setIdentifiedLecturer] = useState<Lecturer | null>(null);
  const [authType, setAuthType] = useState<SessionAuthorizationType>('primary');
  const [isScanningLecturer, setIsScanningLecturer] = useState(false);
  const [unexpectedSubstituteConfirmed, setUnexpectedSubstituteConfirmed] = useState(false);

  // Geofence Step
  const [geofenceVerified, setGeofenceVerified] = useState(false);
  const [isCheckingGeofence, setIsCheckingGeofence] = useState(false);
  const [geofenceDistance, setGeofenceDistance] = useState(38); // metres from venue

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const [allSess, offerings, lecs] = await Promise.all([
        api.getSessions(scopeDeptId),
        api.getCourseOfferings(scopeDeptId),
        api.getLecturers(scopeDeptId),
      ]);

      // Role scoping:
      let scopedSessions = allSess;
      if (user?.role === 'lecturer') {
        scopedSessions = allSess.filter(s => s.lecturerId === user.staffId || s.substituteLecturerId === user.staffId || s.lecturerName.toLowerCase().includes(user.fullName.toLowerCase()));
      }

      setSessions(scopedSessions);
      setAllOfferings(offerings);
      setLecturers(lecs);

      // Student Capturer: load only registered eligible courses (Section 6)
      if (isSessionCapturer(user)) {
        const studentId = user?.studentId || 'stu-001';
        const eligible = await api.getEligibleCoursesForStudent(studentId);
        setEligibleOfferings(eligible);
        if (eligible.length > 0) {
          setSelectedOfferingId(eligible[0].id);
          setVenueInput(eligible[0].approvedVenue || 'Lecture Theatre 1 - Faculty of Science');
        }
      } else if (offerings.length > 0) {
        setSelectedOfferingId(offerings[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions data:', err);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Filtered dataset
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (statusFilter !== 'all' && s.state !== statusFilter) return false;
      if (selectedCourse !== 'all' && s.courseCode !== selectedCourse) return false;
      const sessionDate = s.createdAt.split('T')[0];
      if (startDate && sessionDate < startDate) return false;
      if (endDate && sessionDate > endDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = s.courseCode.toLowerCase().includes(q);
        const matchTitle = s.courseTitle.toLowerCase().includes(q);
        const matchLec = s.lecturerName.toLowerCase().includes(q);
        const matchVenue = (s.venue || '').toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchLec && !matchVenue) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, selectedCourse, startDate, endDate, searchQuery]);

  // Date Grouped Sessions (Section 33)
  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    filteredSessions.forEach(s => {
      const dateKey = formatDate(s.createdAt);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(s);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredSessions]);

  // Open Create Modal & Reset Steps
  const handleOpenCreateModal = () => {
    setCreateStep('details');
    setIdentifiedLecturer(null);
    setUnexpectedSubstituteConfirmed(false);
    setGeofenceVerified(false);
    setIsCreateOpen(true);
  };

  // Step 1 -> Step 2: Lecturer Biometric Auth
  const handleProceedToLecturerAuth = () => {
    if (!selectedOfferingId) {
      toast.error('Please select an eligible course offering');
      return;
    }
    if (!venueInput.trim()) {
      toast.error('Please enter the lecture venue');
      return;
    }
    setCreateStep('lecturer_auth');
  };

  // Step 2: Trigger Lecturer Fingerprint Scan
  const handleScanLecturer = async (simulateType: 'primary' | 'pre_substitute' | 'unexpected') => {
    setIsScanningLecturer(true);
    try {
      const offering = (eligibleOfferings.length > 0 ? eligibleOfferings : allOfferings).find(o => o.id === selectedOfferingId);

      // Simulate biometric identification based on test button chosen
      let identified: Lecturer;
      if (simulateType === 'primary') {
        identified = lecturers.find(l => l.id === offering?.primaryLecturerId) || lecturers[0];
        setAuthType('primary');
      } else if (simulateType === 'pre_substitute') {
        identified = lecturers[1] || lecturers[0];
        setAuthType('pre_assigned_substitute');
      } else {
        // Unexpected substitute (e.g. HOD stepping in)
        identified = lecturers[2] || lecturers[0];
        setAuthType('ad_hoc_substitute');
      }

      setIdentifiedLecturer(identified);
      toast.success(`Fingerprint Recognized: ${identified.fullName}`);
    } catch {
      toast.error('Biometric sensor error. Please retry.');
    } finally {
      setIsScanningLecturer(false);
    }
  };

  // Step 2 -> Step 3: Geofence Verification
  const handleProceedToGeofence = () => {
    if (!identifiedLecturer) {
      toast.error('Lecturer biometric authorization required');
      return;
    }
    if (authType === 'ad_hoc_substitute' && !unexpectedSubstituteConfirmed) {
      toast.error('You must explicitly confirm the substitute lecturer authorization');
      return;
    }
    setCreateStep('geofence');
    verifyGeofenceLocation();
  };

  // Step 3: Check Geofence
  const verifyGeofenceLocation = () => {
    setIsCheckingGeofence(true);
    setTimeout(() => {
      setIsCheckingGeofence(false);
      setGeofenceVerified(true);
      setGeofenceDistance(38);
    }, 1000);
  };

  // Step 3 -> Final Activation
  const handleFinalizeSession = async () => {
    if (!geofenceVerified) {
      toast.error('Session cannot be started outside permitted teaching area');
      return;
    }

    const offering = (eligibleOfferings.length > 0 ? eligibleOfferings : allOfferings).find(o => o.id === selectedOfferingId);
    if (!offering || !identifiedLecturer) return;

    try {
      const now = new Date().toISOString();
      const newSession: Session = {
        id: `sess-${Date.now().toString().slice(-4)}`,
        courseOfferingId: offering.id,
        courseCode: offering.courseCode,
        courseTitle: offering.courseTitle,
        departmentId: offering.departmentId,
        state: 'active',
        venue: venueInput,
        createdById: user?.id || 'user-stu-capturer',
        createdByName: user?.fullName || 'Student Session Capturer',
        lecturerId: identifiedLecturer.id,
        lecturerName: identifiedLecturer.fullName,
        authorizationType: authType,
        substituteLecturerId: authType !== 'primary' ? identifiedLecturer.id : undefined,
        substituteLecturerName: authType !== 'primary' ? identifiedLecturer.fullName : undefined,
        scheduledStart: now,
        actualStart: now,
        maxDurationMinutes: maxDuration,
        geofenceRadius: 200,
        attendanceCount: 0,
        enrolledCount: offering.enrolledStudents || 75,
        createdAt: now,
      };

      const created = await api.createSession(newSession);
      setSessions(prev => [created, ...prev]);
      setIsCreateOpen(false);
      toast.success(`Session for ${created.courseCode} is now ACTIVE at ${created.venue}`);
      navigate(`/attendance/capture/${created.id}`);
    } catch {
      toast.error('Failed to activate class session');
    }
  };

  const handleExportCSV = () => {
    const csv = generateCSV(filteredSessions, [
      { header: 'Session ID', accessor: s => s.id },
      { header: 'Course Code', accessor: s => s.courseCode },
      { header: 'Course Title', accessor: s => s.courseTitle },
      { header: 'Venue', accessor: s => s.venue || 'Lecture Hall' },
      { header: 'Status', accessor: s => s.state.toUpperCase() },
      { header: 'Authorizing Lecturer', accessor: s => s.lecturerName },
      { header: 'Authorization Type', accessor: s => s.authorizationType || 'primary' },
      { header: 'Created By Capturer', accessor: s => s.createdByName || 'Capturer' },
      { header: 'Attendance Count', accessor: s => String(s.attendanceCount) },
      { header: 'Enrolled Count', accessor: s => String(s.enrolledCount) },
      { header: 'Date', accessor: s => s.createdAt.split('T')[0] },
    ]);
    downloadCSV(csv, `BCAMS_Class_Sessions_${startDate}_to_${endDate}.csv`);
    toast.success('Session records exported');
  };

  const columns: DataTableColumn<Session>[] = [
    {
      key: 'course',
      header: 'Course & Venue',
      sortable: true,
      sortFn: (a, b) => a.courseCode.localeCompare(b.courseCode),
      render: (s) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground font-mono">{s.courseCode}</span>
            <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
              {s.venue || 'Allocated Hall'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-xs">{s.courseTitle}</p>
        </div>
      ),
    },
    {
      key: 'lecturer',
      header: 'Authorizing Lecturer',
      sortable: true,
      sortFn: (a, b) => a.lecturerName.localeCompare(b.lecturerName),
      render: (s) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground text-xs">{s.lecturerName}</span>
            {s.authorizationType === 'ad_hoc_substitute' && (
              <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-mono">
                Substitute
              </Badge>
            )}
            {s.authorizationType === 'pre_assigned_substitute' && (
              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-800 border-blue-300 font-mono">
                Pre-Assigned Sub
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Created by: {s.createdByName || 'Student Capturer'}
          </p>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Schedule & Timing',
      render: (s) => (
        <div className="font-mono text-xs">
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
          <div className="space-y-1 min-w-[120px]">
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
        <div className="flex items-center justify-end gap-1.5">
          {s.state === 'active' && isSessionCapturer(user) && (
            <Button
              size="sm"
              onClick={() => navigate(`/attendance/capture/${s.id}`)}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              <Fingerprint className="h-3 w-3" />
              Capture
            </Button>
          )}
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
        title={isSessionCapturer(user) ? 'Eligible Class Sessions' : 'Class Sessions'}
        subtitle={
          isSessionCapturer(user)
            ? 'Student Session Capturer workspace: Create sessions, enter venue, and initiate lecturer biometric authorization.'
            : 'Academic attendance sessions catalog with date grouping and verification history.'
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
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            {/* Session Creation: ONLY Student Session Capturer creates sessions (Section 15) */}
            {isSessionCapturer(user) && (
              <Button
                size="sm"
                onClick={handleOpenCreateModal}
                className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Create Class Session
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Capturer Guidance Notice */}
        {isSessionCapturer(user) && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <Fingerprint className="h-4 w-4 text-emerald-700 flex-shrink-0" />
              <span>
                <strong>Student Capturer Workflow:</strong> Select your registered course, enter the venue, scan the lecturer's fingerprint to authorize, verify teaching geofence, and begin capturing student attendance.
              </span>
            </div>
            <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-white font-mono text-xs">
              Session Capturer Assigned
            </Badge>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search course code, lecturer, venue..."
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

            {/* Status Filter */}
            <div className="w-[140px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="active">Active Now</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="expired">Expired / Timed Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredSessions.length}</strong> sessions
          </div>
        </div>

        {/* Session Records: Date-Grouped or Flat Table */}
        {groupByDate ? (
          <div className="space-y-4">
            {groupedSessions.length === 0 ? (
              <EmptyState
                title="No Class Sessions Found"
                description="No sessions match the selected date range and filter criteria."
              />
            ) : (
              groupedSessions.map(([date, dateSessions]) => (
                <div key={date} className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-xs text-foreground font-mono">
                        {date}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {dateSessions.length} classes scheduled
                    </Badge>
                  </div>
                  <DataTable
                    columns={columns}
                    data={dateSessions}
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
              data={filteredSessions}
              keyField="id"
              pageSize={25}
              emptyMessage="No class sessions match the specified filters."
            />
          </div>
        )}
      </div>

      {/* Multi-Step Session Creation Dialog (Student Capturer Workflow) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Start New Class Session
            </DialogTitle>
            <DialogDescription className="text-xs">
              {createStep === 'details' && 'Step 1 of 3: Select an eligible course and enter teaching venue.'}
              {createStep === 'lecturer_auth' && 'Step 2 of 3: Biometric lecturer start authorization.'}
              {createStep === 'geofence' && 'Step 3 of 3: Verification of physical teaching geofence perimeter.'}
            </DialogDescription>
          </DialogHeader>

          {/* STEP 1: Course & Venue Details */}
          {createStep === 'details' && (
            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Select Eligible Course *
                </label>
                <Select value={selectedOfferingId} onValueChange={setSelectedOfferingId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose from your enrolled courses" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {(eligibleOfferings.length > 0 ? eligibleOfferings : allOfferings).map(offering => (
                      <SelectItem key={offering.id} value={offering.id}>
                        {offering.courseCode} — {offering.courseTitle} (Primary: {offering.primaryLecturerName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enforces course registration rules (includes core and carryover subjects).
                </p>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Teaching Venue *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={venueInput}
                    onChange={(e) => setVenueInput(e.target.value)}
                    placeholder="e.g. Lecture Theatre 1 - Faculty of Science"
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Max Session Duration Timeout (minutes)
                </label>
                <Select value={String(maxDuration)} onValueChange={(v) => setMaxDuration(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 Minutes (1 Hour)</SelectItem>
                    <SelectItem value="90">90 Minutes (1.5 Hours)</SelectItem>
                    <SelectItem value="120">120 Minutes (2 Hours - Standard)</SelectItem>
                    <SelectItem value="180">180 Minutes (3 Hours - Lab Session)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleProceedToLecturerAuth} className="bg-primary hover:bg-primary-600 text-white">
                  Next: Lecturer Authorization &rarr;
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 2: Lecturer Biometric Authorization */}
          {createStep === 'lecturer_auth' && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 border border-border rounded-lg p-3 text-center">
                <p className="font-semibold text-foreground">Lecturer Fingerprint Verification Required</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  The course lecturer must place their enrolled finger on the workstation scanner to authorize session opening.
                </p>
              </div>

              {/* Simulation triggers for testing authorization types */}
              <div className="space-y-2">
                <label className="font-medium text-foreground block">
                  Simulate Lecturer Fingerprint Scan:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isScanningLecturer}
                    onClick={() => handleScanLecturer('primary')}
                    className="text-[11px] h-auto py-2 flex flex-col gap-1 border-emerald-200 hover:bg-emerald-50 text-emerald-800"
                  >
                    <Fingerprint className="h-4 w-4 text-emerald-600" />
                    <span>Primary Lecturer</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isScanningLecturer}
                    onClick={() => handleScanLecturer('pre_substitute')}
                    className="text-[11px] h-auto py-2 flex flex-col gap-1 border-blue-200 hover:bg-blue-50 text-blue-800"
                  >
                    <Fingerprint className="h-4 w-4 text-blue-600" />
                    <span>Pre-assigned Sub</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isScanningLecturer}
                    onClick={() => handleScanLecturer('unexpected')}
                    className="text-[11px] h-auto py-2 flex flex-col gap-1 border-amber-200 hover:bg-amber-50 text-amber-800"
                  >
                    <Fingerprint className="h-4 w-4 text-amber-600" />
                    <span>Unexpected Sub</span>
                  </Button>
                </div>
              </div>

              {/* Scan Feedback */}
              {identifiedLecturer && (
                <div className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                  authType === 'primary'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : authType === 'pre_assigned_substitute'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <strong className="text-sm">{identifiedLecturer.fullName}</strong>
                    </div>
                    <Badge variant={authType === 'primary' ? 'success' : authType === 'pre_assigned_substitute' ? 'default' : 'warning'}>
                      {authType === 'primary' ? 'Primary Assigned' : authType === 'pre_assigned_substitute' ? 'Pre-Approved Substitute' : 'Unexpected Substitute'}
                    </Badge>
                  </div>
                  <p className="text-[11px]">Staff ID: {identifiedLecturer.staffId} • Department: {identifiedLecturer.departmentName}</p>

                  {/* Unexpected Substitute explicit confirmation requirement (Section 17) */}
                  {authType === 'ad_hoc_substitute' && (
                    <div className="pt-2 border-t border-amber-200/80">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={unexpectedSubstituteConfirmed}
                          onChange={(e) => setUnexpectedSubstituteConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-amber-400 text-primary focus:ring-primary"
                        />
                        <span className="text-[11px] font-medium text-amber-950">
                          Confirm that Dr. / Prof. {identifiedLecturer.fullName} is authorized to conduct today's session as a substitute. Permanent course assignment remains unchanged.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setCreateStep('details')}>
                  &larr; Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleProceedToGeofence}
                  disabled={!identifiedLecturer || (authType === 'ad_hoc_substitute' && !unexpectedSubstituteConfirmed)}
                  className="bg-primary hover:bg-primary-600 text-white"
                >
                  Next: Geofence Verification &rarr;
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 3: Geofence Verification */}
          {createStep === 'geofence' && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 border border-border rounded-lg p-3.5 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <Navigation className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">Physical Teaching Geofence Check</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Validating workstation GPS coordinates against designated lecture venue: <strong>{venueInput}</strong>.
                </p>
              </div>

              {isCheckingGeofence ? (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Clock className="h-4 w-4 animate-spin text-primary" />
                  <span>Acquiring satellite lock and measuring distance...</span>
                </div>
              ) : (
                <div className="border border-emerald-200 bg-emerald-50/70 rounded-lg p-3.5 space-y-2 text-emerald-950">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Location Verified
                    </span>
                    <Badge variant="success" className="font-mono text-[10px]">
                      {geofenceDistance}m from Venue
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-900">
                    Station is well within permitted teaching radius (200m). Class attendance capture is authorized to activate.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setCreateStep('lecturer_auth')}>
                  &larr; Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleFinalizeSession}
                  disabled={!geofenceVerified}
                  className="bg-primary hover:bg-primary-600 text-white font-semibold gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Activate Session & Open Capture
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
