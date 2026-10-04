/**
 * BCAMS Dashboard
 * 
 * Operational landing page showing key system metrics.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SessionStatusBadge, PunctualityBadge } from '@/components/common/status-indicators';
import { StatCardSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { formatTime, formatDate, computeAttendancePercentage } from '@/lib/utils';
import type { Session, DailyClockRecord } from '@/types';
import {
  GraduationCap, CalendarCheck, Fingerprint, Monitor, BarChart3,
  ArrowRight, Clock, AlertTriangle, TrendingUp,
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
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [clockRecords, setClockRecords] = useState<DailyClockRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, sessions, clock, syncState] = await Promise.all([
          api.getDashboardStats(),
          api.getSessions(),
          api.getDailyClockRecords(),
          api.getSyncState(),
        ]);
        setStats(s);
        setRecentSessions(sessions.slice(0, 5));
        setClockRecords(clock);
        syncStore.refresh();
      } catch {
        // Handle error
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const isAdmin = user?.role === 'super_admin';
  const isHod = user?.role === 'hod';
  const isLecturer = user?.role === 'lecturer';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={user ? `Welcome back, ${user.fullName.split(' ')[0]}` : ''}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-page space-y-6 animate-fade-in">
          {/* Stat cards */}
          {isLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
          ) : stats && (
            <div className="grid grid-cols-4 gap-4">
              {(isAdmin || isHod) && (
                <StatCard
                  title="Total Students"
                  value={stats.totalStudents}
                  description={`${stats.enrollmentComplete} fully enrolled`}
                  icon={<GraduationCap className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/people/students')}
                />
              )}
              <StatCard
                title="Active Sessions"
                value={stats.activeSessions}
                description="Currently running"
                icon={<CalendarCheck className="h-5 w-5 text-primary" />}
                onClick={() => navigate('/sessions')}
              />
              <StatCard
                title="Today's Attendance"
                value={stats.todayAttendance}
                description="Captures today"
                icon={<Fingerprint className="h-5 w-5 text-primary" />}
              />
              {(isAdmin || isHod) && (
                <StatCard
                  title="Today's Clock-Ins"
                  value={stats.todayClockIns}
                  description="Staff gate attendance"
                  icon={<Clock className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/gate')}
                />
              )}
              {isAdmin && (
                <StatCard
                  title="Devices Online"
                  value={`${stats.devicesOnline}/${stats.devicesTotal}`}
                  description="Active devices"
                  icon={<Monitor className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/devices')}
                />
              )}
              {(isAdmin || isHod) && (
                <StatCard
                  title="Avg Attendance"
                  value={`${stats.averageAttendanceRate}%`}
                  description={`${stats.belowThresholdStudents} below threshold`}
                  icon={<BarChart3 className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/reports')}
                />
              )}
              {(isAdmin || isHod) && (
                <StatCard
                  title="Enrollment"
                  value={stats.enrollmentComplete + stats.enrollmentPartial}
                  description={`${stats.enrollmentNone} not enrolled`}
                  icon={<Fingerprint className="h-5 w-5 text-primary" />}
                  onClick={() => navigate('/enrollment')}
                />
              )}
              <StatCard
                title="Pending Sync"
                value={stats.pendingSyncEvents}
                description="Awaiting synchronization"
                icon={<AlertTriangle className="h-5 w-5 text-warning" />}
              />
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-5 gap-6">
            {/* Recent Sessions — wider column */}
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recent Sessions</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')}>
                      View All <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentSessions.length === 0 ? (
                    <p className="text-body text-muted-foreground py-8 text-center">No recent sessions</p>
                  ) : (
                    <div className="space-y-3">
                      {recentSessions.map(session => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/sessions/${session.id}`)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0">
                              <SessionStatusBadge state={session.state} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-body-medium truncate">{session.courseCode} — {session.courseTitle}</p>
                              <p className="text-helper text-muted-foreground">{session.lecturerName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 text-right">
                            <div>
                              <p className="text-body-medium">{session.attendanceCount}/{session.enrolledCount}</p>
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

            {/* Right column */}
            <div className="col-span-2 space-y-6">
              {/* Today's Gate Records */}
              {(isAdmin || isHod) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Today's Gate Records</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/gate')}>
                        View All <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {clockRecords.length === 0 ? (
                      <p className="text-body text-muted-foreground py-4 text-center">No records today</p>
                    ) : (
                      <div className="space-y-2.5">
                        {clockRecords.map(record => (
                          <div key={record.staffId} className="flex items-center justify-between py-2 px-2 rounded-md">
                            <div>
                              <p className="text-body-medium">{record.staffName}</p>
                              <p className="text-helper text-muted-foreground">{record.staffDepartment}</p>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              {record.clockIn && (
                                <div>
                                  <p className="text-helper text-muted-foreground">In</p>
                                  <p className="text-body-medium">{formatTime(record.clockIn.timestamp)}</p>
                                </div>
                              )}
                              {record.clockOut && (
                                <div>
                                  <p className="text-helper text-muted-foreground">Out</p>
                                  <p className="text-body-medium">{formatTime(record.clockOut.timestamp)}</p>
                                </div>
                              )}
                              {record.clockIn?.punctuality && (
                                <PunctualityBadge classification={record.clockIn.punctuality} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sync Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Synchronization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body text-muted-foreground">Connection</span>
                      <Badge variant={syncStore.connection === 'online' ? 'online' : 'offline'}>
                        {syncStore.connection === 'online' ? '✓ Online' : '✕ Offline'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-body text-muted-foreground">Pending Events</span>
                      <span className="text-body-medium">{syncStore.pendingEvents}</span>
                    </div>
                    {syncStore.failedEvents > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-body text-muted-foreground">Failed Events</span>
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {syncStore.failedEvents} requires attention
                        </Badge>
                      </div>
                    )}
                    {syncStore.lastSyncAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-body text-muted-foreground">Last Sync</span>
                        <span className="text-helper text-muted-foreground">{formatDate(syncStore.lastSyncAt)} {formatTime(syncStore.lastSyncAt)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
