/**
 * BCAMS Desktop - Main Application & Router
 * 
 * Uses HashRouter for seamless Electron file:// protocol compatibility.
 * Provides role-aware route guards and layout shells.
 */
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { AppShell } from '@/components/layout/app-shell';
import { PageSkeleton } from '@/components/common/empty-error-states';

// Pages
import { DashboardPage } from '@/pages/dashboard';
import { SessionsPage } from '@/pages/sessions';
import { SessionDetailsPage } from '@/pages/sessions/details';
import { AttendanceCapturePage } from '@/pages/attendance/capture';
import { GateAttendancePage } from '@/pages/gate';
import { GateRecordsPage } from '@/pages/gate/records';
import { StudentsPage } from '@/pages/people/students';
import { LecturersPage } from '@/pages/people/lecturers';
import { StaffPage } from '@/pages/people/staff';
import { EnrollmentPage } from '@/pages/enrollment';
import { AcademiaPage } from '@/pages/academic/academia';
import { CoursesPage } from '@/pages/academic/courses';
import { ReportsPage } from '@/pages/reports';
import { LoginPage } from '@/pages/auth/login';
import { RoleGuard } from '@/components/common/role-guard';

import { useSyncStore } from '@/stores/sync-store';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { login, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize offline sync queue from persistent IndexedDB
    useSyncStore.getState().initializeQueue().catch(() => { });

    // Automatically initialize authenticated session with default super admin for instant operational readiness
    if (!isAuthenticated) {
      login('user-sa');
    }
  }, [login, isAuthenticated]);

  return (
    <HashRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Standalone Gate Terminal Route (Self-Service Physical Turnstile Unit — No Role Login Required) */}
        <Route path="/gate" element={<GateAttendancePage />} />

        {/* Protected Operational Shell */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route path="/" element={<DashboardPage />} />

          {/* Sessions & Capture */}
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:sessionId" element={<SessionDetailsPage />} />
          <Route path="/attendance" element={<Navigate to="/sessions" replace />} />
          <Route path="/attendance/capture" element={<AttendanceCapturePage />} />
          <Route path="/attendance/capture/:sessionId" element={<AttendanceCapturePage />} />

          {/* Gate Attendance Administrative Records (Super Admin ONLY) */}
          <Route
            path="/gate/records"
            element={
              <RoleGuard roles={['super_admin']}>
                <GateRecordsPage />
              </RoleGuard>
            }
          />

          {/* People & Registry */}
          <Route path="/people/students" element={<StudentsPage />} />
          <Route path="/people/lecturers" element={<LecturersPage />} />
          <Route
            path="/people/staff"
            element={
              <RoleGuard roles={['super_admin', 'hod']}>
                <StaffPage />
              </RoleGuard>
            }
          />

          {/* Academic Structure (Academic Progression managed via Student Registry) */}
          <Route path="/academic/enrollment" element={<Navigate to="/people/students" replace />} />
          <Route
            path="/academic/academia"
            element={
              <RoleGuard roles={['super_admin']}>
                <AcademiaPage />
              </RoleGuard>
            }
          />
          <Route path="/academia" element={<Navigate to="/academic/academia" replace />} />
          <Route path="/academic/departments" element={<Navigate to="/academic/academia" replace />} />
          <Route path="/academic/courses" element={<CoursesPage />} />

          {/* Biometrics (Super Admin & HOD) */}
          <Route
            path="/enrollment"
            element={
              <RoleGuard roles={['super_admin', 'hod']}>
                <EnrollmentPage />
              </RoleGuard>
            }
          />

          {/* System & Operations */}
          <Route path="/devices" element={<Navigate to="/" replace />} />
          <Route path="/policies" element={<Navigate to="/academic/academia" replace />} />
          <Route
            path="/reports"
            element={
              <RoleGuard roles={['super_admin', 'hod', 'lecturer']}>
                <ReportsPage />
              </RoleGuard>
            }
          />
          <Route path="/audit" element={<Navigate to="/" replace />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
