/**
 * BCAMS Dashboard 
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SessionStatusBadge } from '@/components/common/status-indicators';
import { StatCardSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { formatTime, formatDate, computeAttendancePercentage } from '@/lib/utils';
import {
  isSuperAdmin, isHOD, isLecturer, isSessionCapturer,
} from '@/lib/permissions';
import type { Session, DailyClockRecord, Course } from '@/types';
import {
  GraduationCap, CalendarCheck, Fingerprint, BarChart3,
  ArrowRight, Clock, AlertTriangle, TrendingUp, Users, BookOpen,
  Building2,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

function StatCard({ title, value, description, icon, trend, onClick }: StatCardProps) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-card-hover transition-shadow' : ''} onClick={onClick}>
      <CardContent className="pt-card-padding">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-helper text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {description && <p className="text-helper text-muted-foreground">{description}</p>}
            {trend && (
              <div className="flex items-center gap-1 text-helper">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-success-700">+{trend.value}%</span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg p-2.5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const syncStore = useSyncStore();

  // Active operational academic session
  const currentAcademicSession = '2026/2027';
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [clockRecords, setClockRecords] = useState<DailyClockRecord[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── 1. Capturer Redirection: Capturers never land on Dashboard ──────────────
  useEffect(() => {
    if (isSessionCapturer(user)) {
      navigate('/attendance/capture', { replace: true });
      return;
    }
  }, [user, navigate]);

  const isAdmin = isSuperAdmin(user);
  const isHodUser = isHOD(user);
  const isLecturerUser = isLecturer(user);
  const lecturerId = isLecturerUser ? (user?.staffPersonId || user?.staffId || user?.id) : undefined;

  // ─── 2. Data Fetching with Scoped Parameters ────────────────────────────────
  useEffect(() => {
    if (isSessionCapturer(user)) return;

    let isMounted = true;
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const scope = {
          departmentId: isHodUser ? user?.departmentId : undefined,
          isInstitutionWide: isAdmin,
          lecturerId,
          academicSession: currentAcademicSession,
        };

        const [dashboardStats, fetchedSessions, fetchedClock, fetchedCourses] = await Promise.all([
          api.getDashboardStats(scope),
          api.getSessions(),
          isAdmin ? api.getDailyClockRecords() : Promise.resolve([]),
          isLecturerUser ? api.getCourses(user?.departmentId) : Promise.resolve([]),
        ]);

        if (!isMounted) return;

        setStats(dashboardStats);
        setAllSessions(fetchedSessions);
        setClockRecords(fetchedClock);
        setMyCourses(fetchedCourses);

        // Only refresh sync store for roles with offline capabilities (Admin, HOD)
        if (!isLecturerUser) {
          syncStore.refresh();
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboardData();
    return () => { isMounted = false; };
  }, [user, isAdmin, isHodUser, isLecturerUser, lecturerId]);

  // ─── 3. Filter Recent Sessions by Scope ─────────────────────────────────────
  const scopedRecentSessions = useMemo(() => {
    return allSessions
      .filter(s => {
        // Enforce user-facing lifecycle (remove draft)
        if (s.state !== 'active' && s.state !== 'closed' && s.state !== 'expired') return false;

        // Scope filter
        if (isLecturerUser && lecturerId) {
          return s.lecturerId === lecturerId || s.substituteLecturerId === lecturerId;
        }
        if (isHodUser && user?.departmentId) {
          return s.departmentId === user.departmentId;
        }
        return true;
      })
      .slice(0, 5);
  }, [allSessions, isLecturerUser, isHodUser, lecturerId, user?.departmentId]);

  // ─── 4. Filter Clock Records for Super Admin (Gate Ledger) ──────────────────
  const scopedClockRecords = useMemo(() => {
    if (isAdmin) return clockRecords.slice(0, 5);
    return [];
  }, [clockRecords, isAdmin]);

  // If user is a capturer, early return while redirecting
  if (isSessionCapturer(user)) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-page space-y-6 animate-fade-in">
          {/* ─── Stat Cards ─────────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
          ) : stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Super Admin & HOD: Total Students (Department-scoped for HOD) */}
              {(isAdmin || isHodUser) && (
                <StatCard
                  title={isHodUser ? 'Department Students' : 'Total Students'}
                  value={stats.totalStudents}
                  description={`${stats.enrollmentComplete} biometric complete`}
                  icon={<GraduationCap className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/people/students')}
                />
              )}

              {/* Super Admin & HOD: Total Staff */}
              {(isAdmin || isHodUser) && (
                <StatCard
                  title={isHodUser ? 'Department Staff' : 'Total Staff'}
                  value={stats.totalStaff}
                  description={`${stats.totalLecturers} teaching staff`}
                  icon={<Users className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/people/staff')}
                />
              )}

              {/* Lecturer: Assigned Courses */}
              {isLecturerUser && (
                <StatCard
                  title="Assigned Courses"
                  value={myCourses.length}
                  description="Curriculum assignments"
                  icon={<BookOpen className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/academic/courses')}
                />
              )}

              {/* Everyone: Active Sessions (Scoped by role) */}
              <StatCard
                title="Active Sessions"
                value={stats.activeSessions}
                description={isLecturerUser ? 'Your running classes' : isHodUser ? 'In your department' : 'Institution-wide'}
                icon={<CalendarCheck className="h-5 w-5 text-primary" />}
                onClick={() => navigate('/sessions')}
              />

              {/* Everyone: Today's Attendance Captures */}
              <StatCard
                title="Today's Attendance"
                value={stats.todayAttendance}
                description="Verified captures today"
                icon={<Fingerprint className="h-5 w-5 text-primary" />}
                onClick={() => navigate('/sessions')}
              />

              {/* Super Admin ONLY: Today's Gate Clock-Ins (Removed from HOD per Section 8) */}
              {isAdmin && (
                <StatCard
                  title="Today's Clock-Ins"
                  value={stats.todayClockIns}
                  description="Staff gate attendance"
                  icon={<Clock className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/gate/records')}
                />
              )}


              {/* Everyone: Average Attendance Rate */}
              <StatCard
                title="Avg Attendance"
                value={`${stats.averageAttendanceRate}%`}
                description="Current academic session"
                icon={<BarChart3 className="h-5 w-5 text-primary" />}
                onClick={() => navigate('/reports')}
              />

              {/* Super Admin & HOD: Local Client Synchronization Status */}
              {(isAdmin || isHodUser) && (
                <StatCard
                  title="Pending Sync"
                  value={stats.pendingSyncEvents}
                  description="Local offline changes"
                  icon={<AlertTriangle className="h-5 w-5 text-warning" />}
                />
              )}
            </div>
          )}

          {/* ─── Two-Column Layout ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Recent Sessions (Left / Wider Column) */}
            <div className={isLecturerUser ? 'lg:col-span-3' : 'lg:col-span-3'}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Sessions</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isLecturerUser
                          ? 'Sessions instructed or substituted by you'
                          : isHodUser
                            ? `Recent sessions in ${user?.departmentName || 'your department'}`
                            : 'Institution-wide session ledger'}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')}>
                      View All <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {scopedRecentSessions.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-body font-medium text-muted-foreground">No recent sessions found</p>
                      <p className="text-helper text-muted-foreground">
                        No lecture sessions recorded for academic session {currentAcademicSession}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scopedRecentSessions.map(session => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/sessions/${session.id}`)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0">
                              <SessionStatusBadge state={session.state} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-body-medium truncate">{session.courseCode} — {session.courseTitle}</p>
                              <div className="flex items-center gap-2 text-helper text-muted-foreground">
                                <span>{session.lecturerName}</span>
                                {session.academicSession && (
                                  <>
                                    <span>•</span>
                                    <span>{session.academicSession}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 text-right">
                            <div>
                              <p className="text-body-medium font-semibold">{session.attendanceCount}/{session.enrolledCount}</p>
                              <p className="text-helper text-muted-foreground">
                                {computeAttendancePercentage(session.attendanceCount, session.enrolledCount)}%
                              </p>
                            </div>
                            {session.actualStart && (
                              <p className="text-helper text-muted-foreground w-20">
                                {formatDate(session.actualStart)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column ────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* For Super Admin ONLY: Gate Attendance Records */}
              {isAdmin && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Today's Gate Records</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          All campus gate posts
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/gate/records')}>
                        View Ledger <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {scopedClockRecords.length === 0 ? (
                      <p className="text-body text-muted-foreground py-6 text-center">No clock records today</p>
                    ) : (
                      <div className="space-y-2.5">
                        {scopedClockRecords.map(record => (
                          <div key={record.staffId} className="flex items-center justify-between py-2 px-2.5 rounded-lg border border-border/40">
                            <div>
                              <p className="text-body-medium font-medium">{record.staffName}</p>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-helper text-muted-foreground">Clock In</p>
                                <p className="text-body-medium font-semibold">
                                  {record.clockIn ? formatTime(record.clockIn.timestamp) : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-helper text-muted-foreground">Clock Out</p>
                                <p className="text-body-medium font-semibold">
                                  {record.clockOut ? formatTime(record.clockOut.timestamp) : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* For Super Admin & HOD ONLY: Local Client Synchronization Widget */}
              {/* Section 5 & 9: LECTURERS DO NOT GET SYNCHRONIZATION UI */}
              {(isAdmin || isHodUser) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Local Client Synchronization</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      This terminal's offline queue and sync status
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-body text-muted-foreground">Network Connection</span>
                        <Badge variant={syncStore.connection === 'online' ? 'online' : 'offline'}>
                          {syncStore.connection === 'online' ? '✓ Online' : '✕ Offline'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-body text-muted-foreground">Pending Local Events</span>
                        <span className="text-body-medium font-semibold">{syncStore.pendingEvents}</span>
                      </div>
                      {syncStore.failedEvents > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-body text-muted-foreground">Failed Events</span>
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {syncStore.failedEvents} requires attention
                          </Badge>
                        </div>
                      )}
                      {syncStore.lastSyncAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-body text-muted-foreground">Last Successful Sync</span>
                          <span className="text-helper text-muted-foreground">
                            {formatDate(syncStore.lastSyncAt)} {formatTime(syncStore.lastSyncAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* For Lecturer ONLY: My Teaching Portfolio Card (Replaces inappropriate sync UI) */}
              {isLecturerUser && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>My Teaching Portfolio</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/academic/courses')}>
                        View Courses <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assigned course units for {currentAcademicSession}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {myCourses.length === 0 ? (
                      <p className="text-body text-muted-foreground py-6 text-center">No assigned courses</p>
                    ) : (
                      <div className="space-y-2.5">
                        {myCourses.map(course => (
                          <div key={course.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg border border-border/40">
                            <div>
                              <p className="text-body-medium font-medium">{course.code}</p>
                              <p className="text-helper text-muted-foreground truncate max-w-[200px]">{course.title}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {course.creditUnits} Units
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
