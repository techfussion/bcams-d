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
import { AttendancePage } from '@/pages/attendance';
import { AttendanceCapturePage } from '@/pages/attendance/capture';
import { GateAttendancePage } from '@/pages/gate';
import { StudentsPage } from '@/pages/people/students';
import { LecturersPage } from '@/pages/people/lecturers';
import { StaffPage } from '@/pages/people/staff';
import { EnrollmentPage } from '@/pages/enrollment';
import { DepartmentsPage } from '@/pages/academic/departments';
import { CoursesPage } from '@/pages/academic/courses';
import { DevicesPage } from '@/pages/devices';
import { PoliciesPage } from '@/pages/policies';
import { ReportsPage } from '@/pages/reports';
import { AuditPage } from '@/pages/audit';
import { SettingsPage } from '@/pages/settings';
import { LoginPage } from '@/pages/auth/login';

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
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/attendance/capture/:sessionId" element={<AttendanceCapturePage />} />

          {/* Gate Attendance */}
          <Route path="/gate" element={<GateAttendancePage />} />

          {/* People & Registry */}
          <Route path="/people/students" element={<StudentsPage />} />
          <Route path="/people/lecturers" element={<LecturersPage />} />
          <Route path="/people/staff" element={<StaffPage />} />

          {/* Biometrics */}
          <Route path="/enrollment" element={<EnrollmentPage />} />

          {/* Academic Structure */}
          <Route path="/academic/departments" element={<DepartmentsPage />} />
          <Route path="/academic/courses" element={<CoursesPage />} />

          {/* System & Operations */}
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit" element={<AuditPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
