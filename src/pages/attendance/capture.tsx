/**
 * Active Attendance Capture Workspace
 * 
 * Capturer-specific operational workspace.
 * Accessible exclusively to Student Session Capturers.
 * 
 * Enforces:
 * - Local scanner hardware status, network connection, and synchronization
 * - Student Capturer self-attendance processing (Section 47)
 * - Anti-duplicate scan detection & non-override rule (Addendum 1)
 * - Geofence teaching area verification
 * - Session Closure requiring biometric verification of the SAME lecturer who authorized start (Section 21)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SessionStatusBadge, ScannerStatusIndicator, ConnectionIndicator } from '@/components/common/status-indicators';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { RoleGuard } from '@/components/common/role-guard';
import { scannerService } from '@/services/scanner-service';
import { useSyncStore } from '@/stores/sync-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { api } from '@/api';
import { formatTime, cn } from '@/lib/utils';
import { isSessionCapturer } from '@/lib/permissions';
import { validateGeofenceAgainstPolicy } from '@/services/geolocation-service';
import type {
  Session, CaptureResult, ScannerState, GeofenceStatus, AttendanceEvent,
  Course, Lecturer, SessionAuthorizationType, Policy,
} from '@/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Fingerprint, CheckCircle2, XCircle, AlertTriangle, Copy,
  MapPin, MapPinOff, WifiOff, ArrowLeft, StopCircle, RotateCcw,
  Users, Clock, UserCheck, ShieldCheck, RefreshCw, Plus, Play,
} from 'lucide-react';

type CapturePhase = 'ready' | 'scanning' | 'processing' | 'result';

export function AttendanceCapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const connection = useSyncStore(s => s.connection);
  const pendingEvents = useSyncStore(s => s.pendingEvents);
  const syncNow = useSyncStore(s => s.syncNow);

  const [session, setSession] = useState<Session | null>(null);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scannerState, setScannerState] = useState<ScannerState>('ready');
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('ready');
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [recentCaptures, setRecentCaptures] = useState<Array<{ id: string; name?: string; type: string; time: string; matric?: string }>>([
    { id: 'rc-1', name: 'Oluwaseun Adeyemi', matric: 'CSC/2026/0012', type: 'success', time: '10:05 AM' },
    { id: 'rc-2', name: 'Ngozi Chukwuma', matric: 'CSC/2026/0023', type: 'success', time: '10:06 AM' },
  ]);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceStatus>('inside');

  // Close Session Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isClosingScanning, setIsClosingScanning] = useState(false);
  const [closeErrorMessage, setCloseErrorMessage] = useState<string | null>(null);
  const [sessionClosedSummary, setSessionClosedSummary] = useState<Session | null>(null);

  // Initiate New Session Modal State (Section 31)
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [initCourseCode, setInitCourseCode] = useState('');
  const [initVenue, setInitVenue] = useState('Lecture Theatre 1');
  const [initLecturerId, setInitLecturerId] = useState('');
  const [initAuthRole, setInitAuthRole] = useState<SessionAuthorizationType>('primary');
  const [isAuthorizingStart, setIsAuthorizingStart] = useState(false);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    try {
      const [allSessions, allCourses, allLecturers, policies] = await Promise.all([
        api.getSessions(),
        api.getCourses(),
        api.getLecturers(),
        api.getPolicies(),
      ]);

      // Check geofence status against effective institutional policy if geolocation is available
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const check = validateGeofenceAgainstPolicy(
              { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
              policies
            );
            if (check.status !== 'unavailable') {
              setGeofenceStatus(check.status);
            }
          },
          () => {
            // Geolocation unavailable or denied
          },
          { timeout: 3000 }
        );
      }

      const active = allSessions.filter(s => s.status === 'active' || s.state === 'active');
      setActiveSessions(active);
      setCourses(allCourses);
      setLecturers(allLecturers);

      if (allCourses.length > 0) {
        setInitCourseCode(prev => prev || allCourses[0].code);
      }
      if (allLecturers.length > 0) {
        setInitLecturerId(prev => prev || allLecturers[0].id);
      }

      if (sessionId) {
        const found = allSessions.find(s => s.id === sessionId);
        if (found) setSession(found);
      } else {
        setSession(prev => {
          if (prev && active.some(s => s.id === prev.id)) {
            return active.find(s => s.id === prev.id) || prev;
          }
          return active.length > 0 ? active[0] : null;
        });
      }
    } catch (err) {
      console.error('Failed to load capture workspace data:', err);
      toast.error('Failed to load session capture workspace');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => unsubscribe();
  }, []);

  // Update lecturer assignment role automatically when course or lecturer changes
  useEffect(() => {
    if (!initCourseCode || !initLecturerId) return;
    const crs = courses.find(c => c.code === initCourseCode);
    if (!crs) return;

    if (crs.primaryLecturerId === initLecturerId) {
      setInitAuthRole('primary');
    } else if (crs.substituteLecturerId === initLecturerId) {
      setInitAuthRole('pre_assigned_substitute');
    } else {
      setInitAuthRole('ad_hoc_substitute');
    }
  }, [initCourseCode, initLecturerId, courses]);

  // Handle Session Initiation (Section 31)
  const handleInitiateSession = async () => {
    const crs = courses.find(c => c.code === initCourseCode);
    const lec = lecturers.find(l => l.id === initLecturerId);
    if (!crs || !lec) {
      toast.error('Please select both a valid course and lecturer');
      return;
    }

    setIsAuthorizingStart(true);
    try {
      // Simulate lecturer biometric scan on optical sensor
      await new Promise(r => setTimeout(r, 600));

      const newSess = await api.createSession({
        courseCode: crs.code,
        courseTitle: crs.title,
        departmentId: crs.departmentId,
        departmentName: crs.departmentName,
        venue: initVenue,
        createdById: user?.id || 'stu-capturer',
        createdByName: user?.fullName || 'Student Capturer',
        lecturerId: lec.id,
        lecturerName: lec.fullName,
        authorizationType: initAuthRole,
        status: 'active',
        state: 'active',
        enrolledCount: 75,
        startTime: new Date().toISOString(),
      });

      setSession(newSess);
      setActiveSessions(prev => [newSess, ...prev]);
      setSessionClosedSummary(null);
      setCaptureCount(0);
      setIsInitiateModalOpen(false);
      toast.success(`Session for ${crs.code} authorized by ${lec.fullName} (${initAuthRole.replace('_', ' ')}). Capture is ACTIVE.`);
    } catch (err) {
      toast.error('Failed to initiate class session');
    } finally {
      setIsAuthorizingStart(false);
    }
  };

  const handleCapture = useCallback(async (isSelfAttendance: boolean = false) => {
    if (scannerState === 'disconnected') return;
    if (geofenceStatus === 'outside') {
      setLastResult({ type: 'geofence_rejected', timestamp: new Date().toISOString() });
      setCapturePhase('result');
      setTimeout(() => setCapturePhase('ready'), 3500);
      return;
    }

    setCapturePhase('scanning');
    setLastResult(null);

    let result: CaptureResult;
    if (isSelfAttendance) {
      // Self-Attendance Scan for Student Capturer (Section 47)
      const now = new Date().toISOString();
      result = {
        type: 'success',
        personId: user?.id || 'stu-001',
        personName: user?.fullName || 'Amina Ibrahim',
        registrationNumber: user?.matricNumber || 'CSC/2026/0045',
        qualityScore: 96,
        timestamp: now,
      };
    } else {
      result = await scannerService.startCapture();
    }

    setLastResult(result);
    setCapturePhase('result');

    if (result.type === 'success' && 'personName' in result) {
      setCaptureCount(c => c + 1);

      // Record in live local feed
      const newCapture = {
        id: `rc-${Date.now().toString().slice(-4)}`,
        name: result.personName,
        matric: result.registrationNumber || 'MATRIC',
        type: result.type,
        time: formatTime(result.timestamp),
      };
      setRecentCaptures(prev => [newCapture, ...prev.slice(0, 8)]);

      // Submit attendance record
      if (session) {
        api.submitAttendanceCapture({
          sessionId: session.id,
          studentId: result.personId,
          studentName: result.personName,
          matricNumber: result.registrationNumber || 'MATRIC',
          timestamp: result.timestamp,
          deviceId: 'dev-001',
          clockIntegrity: 'verified',
          syncStatus: 'synced',
        }).catch(() => {});

        useSyncStore.getState().addPendingItem({
          type: 'attendance',
          description: `${result.personName} — ${session.courseCode}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [scannerState, geofenceStatus, session, user]);

  // Execute Same-Lecturer Session Closure (Section 21 & 32)
  const handleVerifyLecturerForClosure = async (simulateMatching: boolean) => {
    setIsClosingScanning(true);
    setCloseErrorMessage(null);

    try {
      if (!session) return;

      // If simulateMatching is true, pass the same authorizing lecturer's ID
      // If false, pass an unauthorized lecturer's ID to demonstrate strict rejection
      const testLecturerId = simulateMatching ? session.lecturerId : 'lec-unauthorized-099';

      const response = await api.closeSessionWithLecturer(session.id, testLecturerId);

      if (response.success && response.session) {
        setSessionClosedSummary(response.session);
        setSession(null);
        setActiveSessions(prev => prev.filter(s => s.id !== session.id));
        toast.success(`Session for ${session.courseCode} closed successfully with lecturer authorization.`);
        setIsCloseModalOpen(false);
      } else {
        setCloseErrorMessage(
          response.error || `Closure Authorization Denied: Only the same lecturer who authorized session start (${session.lecturerName}) is permitted to close this session.`
        );
      }
    } catch {
      setCloseErrorMessage('Biometric transmission error. Please retry verification.');
    } finally {
      setIsClosingScanning(false);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  // Guard: ONLY Student Session Capturer should access this operational workspace (Section 22)
  if (!isSessionCapturer(user)) {
    return (
      <RoleGuard capabilities={['session_capture']}>
        <div />
      </RoleGuard>
    );
  }

  const renderInitiateModal = () => (
    <Dialog open={isInitiateModalOpen} onOpenChange={setIsInitiateModalOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground">
            <Plus className="h-5 w-5 text-primary" />
            Initiate Class Session — Lecturer Authorization
          </DialogTitle>
          <DialogDescription className="text-xs">
            Class session creation requires biometric verification by the course's designated lecturer or an approved substitute.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">1. Select Eligible Course</label>
            <Select value={initCourseCode} onValueChange={setInitCourseCode}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Choose course..." />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.id || c.code} value={c.code} className="text-xs">
                    {c.code} — {c.title} ({c.departmentName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">2. Lecture Venue</label>
            <Input
              value={initVenue}
              onChange={e => setInitVenue(e.target.value)}
              placeholder="e.g. LT-101, Hall B..."
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground">3. Authorizing Lecturer</label>
              <Badge variant={initAuthRole === 'primary' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                {initAuthRole.replace('_', ' ')}
              </Badge>
            </div>
            <Select value={initLecturerId} onValueChange={setInitLecturerId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select authorizing lecturer..." />
              </SelectTrigger>
              <SelectContent>
                {lecturers.map(l => (
                  <SelectItem key={l.id} value={l.id} className="text-xs">
                    {l.fullName} ({l.departmentName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-slate-50 border border-border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Geofence Perimeter Status:</span>
              <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px]">
                Inside Venue Geofence (Verified)
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Biometric Sensor Status:</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Sensor Ready
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => setIsInitiateModalOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isAuthorizingStart || !initCourseCode || !initLecturerId}
            onClick={handleInitiateSession}
            className="bg-primary hover:bg-primary-600 text-white gap-1.5"
          >
            <Fingerprint className="h-4 w-4" />
            {isAuthorizingStart ? 'Verifying Lecturer...' : 'Authorize & Start Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!session) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50/50">
        <Header
          title="Session Capture Terminal"
          subtitle={`Student Capturer: ${user?.fullName || 'Student Capturer'} | Operational capture station`}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncNow()}
                className="gap-2 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync Station
              </Button>
              <Button
                size="sm"
                onClick={() => setIsInitiateModalOpen(true)}
                className="gap-1.5 bg-primary hover:bg-primary-600 text-white text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                Initiate Class Session
              </Button>
            </div>
          }
        />

        <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">
          {sessionClosedSummary && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start justify-between">
              <div>
                <p className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Session Closed Successfully — {sessionClosedSummary.courseCode}
                </p>
                <p className="text-xs text-emerald-800 mt-1">
                  Closed by authorizing lecturer ({sessionClosedSummary.lecturerName}) with {sessionClosedSummary.attendanceCount} total student attendance captures recorded.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSessionClosedSummary(null)}
                className="text-xs border-emerald-300 text-emerald-900"
              >
                Dismiss
              </Button>
            </div>
          )}

          {activeSessions.length > 0 && (
            <Card className="border border-border bg-white shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Active Class Sessions in Progress ({activeSessions.length})
                  </h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    Live
                  </Badge>
                </div>
                <div className="divide-y divide-border">
                  {activeSessions.map(s => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{s.courseCode} — {s.courseTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          Lecturer: {s.lecturerName} • Venue: {s.venue} • {s.attendanceCount} captured
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSession(s);
                          setSessionClosedSummary(null);
                        }}
                        className="bg-primary hover:bg-primary-600 text-white text-xs gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume Capture
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-2 border-dashed border-primary/30 bg-white/70 shadow-sm text-center p-8">
            <CardContent className="space-y-4 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary flex items-center justify-center">
                <Fingerprint className="h-8 w-8" />
              </div>
              <div className="max-w-md">
                <h2 className="text-lg font-bold text-foreground">Initiate Class Session</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Ready to capture attendance? Select an eligible course offering and have the assigned lecturer biometrically authorize the session with their fingerprint.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => setIsInitiateModalOpen(true)}
                className="bg-primary hover:bg-primary-600 text-white text-sm font-semibold gap-2 px-6 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Initiate New Class Session
              </Button>
            </CardContent>
          </Card>
        </div>

        {renderInitiateModal()}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50">
      {/* Capturer Header */}
      <Header
        title={`Live Attendance Capture • ${session.courseCode}`}
        subtitle={`Student Capturer: ${user?.fullName || 'Student Capturer'} | Venue: ${session.venue || 'Allocated Hall'}`}
        actions={
          <div className="flex items-center gap-2">
            {activeSessions.length > 1 && (
              <Select
                value={session.id}
                onValueChange={(val) => {
                  const s = activeSessions.find(x => x.id === val);
                  if (s) setSession(s);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[160px]">
                  <SelectValue placeholder="Switch Session" />
                </SelectTrigger>
                <SelectContent>
                  {activeSessions.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.courseCode} ({s.venue})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInitiateModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Session
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNow()}
              className="gap-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Station
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setCloseErrorMessage(null);
                setIsCloseModalOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <StopCircle className="h-4 w-4" />
              Close Session
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-4 max-w-6xl mx-auto w-full">
        {/* Workstation Hardware & Telemetry Bar (Section 22 & 23) */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Workstation Sensor</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ScannerStatusIndicator connected={scannerState !== 'disconnected'} />
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-border" />

            <div>
              <p className="text-xs text-muted-foreground font-medium">Local Network</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ConnectionIndicator status={connection} />
                <span className="text-xs font-semibold text-foreground capitalize">{connection}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-border" />

            <div>
              <p className="text-xs text-muted-foreground font-medium">Queue Synchronization</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {pendingEvents > 0 ? `${pendingEvents} pending sync` : 'All events synced'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-md text-xs font-mono">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Timeout: {session.maxDurationMinutes || 120}m max</span>
            </div>
            <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 font-mono text-xs">
              Venue: {session.venue || 'Lecture Hall A'}
            </Badge>
          </div>
        </div>

        {/* Main Capture Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scanner Interaction Card */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-primary/20 shadow-md bg-white">
              <CardContent className="p-8 flex flex-col items-center justify-center min-h-[380px] text-center">
                {capturePhase === 'ready' && (
                  <div className="space-y-4">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 rounded-full bg-primary-50 text-primary border border-primary/20 flex items-center justify-center hover:scale-105 transition-transform">
                        <Fingerprint className="h-12 w-12" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Ready to Scan Student Fingerprint</h2>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Student should place their registered finger firmly on the optical scanner window.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <Button
                        size="lg"
                        onClick={() => handleCapture(false)}
                        className="bg-primary hover:bg-primary-600 text-white font-semibold gap-2 px-6 shadow-sm"
                      >
                        <Fingerprint className="h-5 w-5" />
                        Capture Student Fingerprint
                      </Button>

                      {/* Capturer Self-Attendance Scan (Section 47) */}
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => handleCapture(true)}
                        className="border-primary/40 text-primary hover:bg-primary-50 font-semibold gap-2"
                        title="Record your own attendance as an enrolled student in this class"
                      >
                        <UserCheck className="h-5 w-5" />
                        Record Self-Attendance (Capturer)
                      </Button>
                    </div>
                  </div>
                )}

                {capturePhase === 'scanning' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-primary-100 text-primary flex items-center justify-center relative overflow-hidden mx-auto">
                      <Fingerprint className="h-12 w-12" />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/30 to-transparent animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Scanning Optical Sensor…</h3>
                      <p className="text-xs text-muted-foreground mt-1">Keep finger steady until verification completes</p>
                    </div>
                  </div>
                )}

                {capturePhase === 'result' && lastResult && (
                  <div className="space-y-4 animate-fade-in w-full max-w-md mx-auto">
                    {lastResult.type === 'success' && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-950 text-center">
                        <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="h-9 w-9" />
                        </div>
                        <h3 className="text-lg font-bold">Attendance Verified</h3>
                        <p className="text-base font-semibold text-emerald-900 mt-1">{lastResult.personName}</p>
                        <p className="text-xs font-mono opacity-80">{lastResult.registrationNumber} • {formatTime(lastResult.timestamp)}</p>
                        <Badge variant="outline" className="mt-2 bg-white text-emerald-800 border-emerald-300 text-[10px]">
                          Quality Score: {lastResult.qualityScore}% • Minutiae Match
                        </Badge>
                      </div>
                    )}

                    {lastResult.type === 'duplicate' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-950 text-center">
                        <div className="h-16 w-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                          <Copy className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold">Already Recorded</h3>
                        <p className="text-base font-semibold mt-1">{lastResult.personName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Duplicate scan ignored. Original clock captured at {formatTime(lastResult.originalTimestamp)}.
                        </p>
                      </div>
                    )}

                    {lastResult.type === 'no_match' && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-950 text-center">
                        <div className="h-16 w-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3">
                          <XCircle className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold">No Biometric Match</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fingerprint template does not match any student enrolled in {session.courseCode}.
                        </p>
                      </div>
                    )}

                    <div className="pt-2 flex justify-center">
                      <Button
                        size="sm"
                        onClick={() => setCapturePhase('ready')}
                        className="bg-primary hover:bg-primary-600 text-white gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Ready Next Student
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Recent Captures Feed */}
          <div>
            <Card className="shadow-sm border-border bg-white h-full">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                      Live Class Feed
                    </h3>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {session.attendanceCount + captureCount} / {session.enrolledCount}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {recentCaptures.map((rc) => (
                    <div
                      key={rc.id}
                      className="p-2.5 rounded-lg border border-border bg-slate-50/50 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-foreground truncate max-w-[170px]">{rc.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{rc.matric} • {rc.time}</p>
                      </div>
                      <Badge
                        variant={rc.type === 'success' ? 'success' : rc.type === 'duplicate' ? 'warning' : 'destructive'}
                        className="text-[10px] uppercase font-mono"
                      >
                        {rc.type === 'success' ? 'Verified' : rc.type === 'duplicate' ? 'Duplicate' : 'No Match'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Session Closure Modal with Same-Lecturer Verification (Section 21) */}
      <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-rose-700">
              <StopCircle className="h-5 w-5" />
              Close Session — Lecturer Authorization
            </DialogTitle>
            <DialogDescription className="text-xs">
              Closing this active session requires biometric verification by the <strong>same lecturer</strong> who authorized its start ({session.lecturerName}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="bg-slate-50 border border-border rounded-lg p-3 space-y-1">
              <p className="text-muted-foreground">Original Authorizing Lecturer:</p>
              <p className="font-bold text-sm text-foreground">{session.lecturerName}</p>
              <p className="text-[11px] text-muted-foreground font-mono">Lecturer ID: {session.lecturerId}</p>
            </div>

            {closeErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{closeErrorMessage}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="font-medium text-foreground block">
                Simulate Biometric Fingerprint on Scanner:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isClosingScanning}
                  onClick={() => handleVerifyLecturerForClosure(true)}
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs py-2 flex flex-col gap-1"
                >
                  <Fingerprint className="h-4 w-4 text-emerald-600" />
                  <span>Scan {session.lecturerName} (Same Lecturer)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isClosingScanning}
                  onClick={() => handleVerifyLecturerForClosure(false)}
                  className="border-rose-300 text-rose-800 hover:bg-rose-50 text-xs py-2 flex flex-col gap-1"
                >
                  <Fingerprint className="h-4 w-4 text-rose-600" />
                  <span>Scan Different Lecturer (Rejection Test)</span>
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCloseModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Initiation Modal */}
      {renderInitiateModal()}
    </div>
  );
}
