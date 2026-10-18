// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AcademiaPage } from '@/pages/academic/academia';
import { LoginPage } from '@/pages/auth/login';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/api';
import { TEST_ROLE_PROFILES } from '@/pages/auth/dev-test-access';
import {
  captureCurrentCoordinates,
  calculateHaversineDistanceMeters,
  validateGeofenceAgainstPolicy,
} from '@/services/geolocation-service';
import type { User, Department, Policy } from '@/types';

describe('BCAMS — Academia Consolidation, Institutional Policies, Geofence Calibration & Login Redesign', () => {
  const superAdminUser: User = {
    id: 'user-sa',
    fullName: 'Dr. Adebayo Ogundimu',
    email: 'admin@institution.edu.ng',
    role: 'super_admin',
  };

  const hodUser: User = {
    id: 'user-hod',
    fullName: 'Prof. Chidinma Okafor',
    email: 'hod.cs@institution.edu.ng',
    role: 'hod',
    departmentId: 'dept-cs',
  };

  beforeEach(() => {
    useAuthStore.setState({ user: superAdminUser, isAuthenticated: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ─── 1. Access Control & Navigation Verification ───────────────────────────
  describe('1. Access Control & Navigation (Part A & B)', () => {
    it('displays Academia in sidebar navigation for Super Admin and removes standalone Departments and Policies', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      // Super Admin sees consolidated Academia navigation item
      expect(screen.getByText('Academia')).toBeTruthy();

      // Standalone Departments and Policies navigation links are removed from sidebar
      const navLinks = screen.getAllByRole('link');
      const hrefs = navLinks.map((l) => l.getAttribute('href'));
      expect(hrefs).not.toContain('/academic/departments');
      expect(hrefs).not.toContain('/policies');
      expect(hrefs).toContain('/academic/academia');
    });

    it('denies HOD access to Academia in sidebar navigation', () => {
      useAuthStore.setState({ user: hodUser, isAuthenticated: true });

      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      // HOD does NOT have Academia link
      expect(screen.queryByText('Academia')).toBeNull();

      // HOD also does NOT have standalone Policies or Departments
      const navLinks = screen.getAllByRole('link');
      const hrefs = navLinks.map((l) => l.getAttribute('href'));
      expect(hrefs).not.toContain('/academic/academia');
      expect(hrefs).not.toContain('/academic/departments');
      expect(hrefs).not.toContain('/policies');
    });

    it('renders the Academia page for Super Admin with the four consolidated tabs', async () => {
      render(
        <MemoryRouter>
          <AcademiaPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^Academia$/i })).toBeTruthy();
      });

      // Verify the 4 consolidated tabs
      expect(screen.getByRole('tab', { name: /Departments & HODs/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Attendance Policies & Geofence/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Session Capturers/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Sessions & Progression/i })).toBeTruthy();
    });
  });

  // ─── 2. Departments & HOD Management ───────────────────────────────────────
  describe('2. Departments & HOD Management (Part B)', () => {
    it('lists academic departments with faculty and statistical counts', async () => {
      render(
        <MemoryRouter>
          <AcademiaPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Computer Science')).toBeTruthy();
        expect(screen.getByText('Information Technology')).toBeTruthy();
      });

      // Shows HOD assignment status
      expect(screen.getAllByText(/Head of Department \(HOD\)/i).length).toBeGreaterThan(0);
    });

    it('creates a new department via api.createDepartment and preserves structure', async () => {
      const newDept: Department = {
        id: 'dept-eng',
        name: 'Electrical Engineering',
        code: 'EEE',
        faculty: 'Engineering',
        studentCount: 0,
        lecturerCount: 0,
        courseCount: 0,
        staffCount: 0,
      };

      const created = await api.createDepartment(newDept);
      expect(created.id).toBe('dept-eng');
      expect(created.name).toBe('Electrical Engineering');

      const allDepts = await api.getDepartments();
      expect(allDepts.some((d) => d.code === 'EEE')).toBe(true);
    });

    it('assigns, replaces, and removes an HOD cleanly synchronizing staff and department', async () => {
      // 1. Assign staff to dept-bus as HOD
      const staffList = await api.getStaff();
      const eligibleStaff = staffList.find((s) => s.departmentId === 'dept-bus');
      expect(eligibleStaff).toBeDefined();

      if (eligibleStaff) {
        const updatedStaff = await api.assignHOD(eligibleStaff.id, 'dept-bus');
        expect(updatedStaff.isHOD).toBe(true);
        expect(updatedStaff.hodDepartmentId).toBe('dept-bus');

        // Verify department was updated with HOD
        const depts = await api.getDepartments();
        const busDept = depts.find((d) => d.id === 'dept-bus');
        expect(busDept?.hodId).toBe(eligibleStaff.id);
        expect(busDept?.hodName).toBe(eligibleStaff.fullName);

        // 2. Remove HOD
        await api.assignHOD(eligibleStaff.id, 'dept-bus', true);

        const afterRemovalDepts = await api.getDepartments();
        const clearedDept = afterRemovalDepts.find((d) => d.id === 'dept-bus');
        expect(clearedDept?.hodId).toBeUndefined();
        expect(clearedDept?.hodName).toBeUndefined();

        // Staff member is no longer HOD
        const afterRemovalStaff = await api.getStaff();
        const revertedStaff = afterRemovalStaff.find((s) => s.id === eligibleStaff.id);
        expect(revertedStaff?.isHOD).toBe(false);
      }
    });
  });

  // ─── 3. Attendance Policies & Real Geofence Calibration ────────────────────
  describe('3. Institutional Policies & Geofence Calibration (Part C & D)', () => {
    it('persists numerical institutional policies without duplicating records or department overrides', async () => {
      const initialPolicies = await api.getPolicies();
      const initialCount = initialPolicies.length;
      const thresholdPolicy = initialPolicies.find((p) => p.type === 'attendance_threshold');
      expect(thresholdPolicy).toBeDefined();

      if (thresholdPolicy) {
        const updatedThreshold = await api.updatePolicy(thresholdPolicy.id, {
          value: 75,
          isActive: true,
        });

        expect(updatedThreshold.value).toBe(75);

        const afterUpdatePolicies = await api.getPolicies();
        // Record count should not grow (no duplicated records)
        expect(afterUpdatePolicies.length).toBe(initialCount);
      }
    });

    it('performs device coordinate capture and calculates Haversine distance correctly', () => {
      // Coordinates approx 111 meters apart (0.001 deg latitude ~ 111m)
      const dist = calculateHaversineDistanceMeters(6.5244, 3.3792, 6.5254, 3.3792);
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(125);

      // Distance from identical points is 0
      const distZero = calculateHaversineDistanceMeters(6.5244, 3.3792, 6.5244, 3.3792);
      expect(distZero).toBe(0);
    });

    it('validates device position against policy radius and coordinates', () => {
      const campusLat = 6.524379;
      const campusLng = 3.379206;
      const testPolicies: Policy[] = [
        {
          id: 'pol-geo-test',
          type: 'geofence_configuration',
          title: 'Campus Perimeter',
          description: 'Geofence test perimeter',
          scope: 'institution',
          isActive: true,
          effectiveFrom: '2026-09-01T00:00:00Z',
          createdBy: 'Senate',
          value: {
            latitude: campusLat,
            longitude: campusLng,
            radiusMeters: 150,
            campusName: 'Main Campus',
          },
        },
      ];

      // Valid position inside radius (approx 30m away)
      const validCheck = validateGeofenceAgainstPolicy(
        { latitude: campusLat + 0.0002, longitude: campusLng + 0.0002 },
        testPolicies
      );
      expect(validCheck.status).toBe('inside');
      expect(validCheck.distanceMeters).toBeLessThan(150);

      // Invalid position outside radius (approx 1.5km away)
      const invalidCheck = validateGeofenceAgainstPolicy(
        { latitude: campusLat + 0.015, longitude: campusLng + 0.015 },
        testPolicies
      );
      expect(invalidCheck.status).toBe('outside');
      expect(invalidCheck.distanceMeters).toBeGreaterThan(150);
    });

    it('captures real coordinates from navigator.geolocation or returns structured error', async () => {
      // Mock successful geolocation
      const mockGeolocation = {
        getCurrentPosition: vi.fn().mockImplementation((success) => {
          success({
            coords: {
              latitude: 6.524379,
              longitude: 3.379206,
              accuracy: 12,
            },
          });
        }),
      };
      vi.stubGlobal('navigator', { geolocation: mockGeolocation });

      const res = await captureCurrentCoordinates();
      expect(res.success).toBe(true);
      expect(res.coords?.latitude).toBeCloseTo(6.524379);
      expect(res.coords?.longitude).toBeCloseTo(3.379206);
      expect(res.coords?.accuracy).toBe(12);

      // Mock geolocation permission denied
      const mockErrorGeolocation = {
        getCurrentPosition: vi.fn().mockImplementation((_, error) => {
          error({
            code: 1, // PERMISSION_DENIED
            message: 'User denied Geolocation',
          });
        }),
      };
      vi.stubGlobal('navigator', { geolocation: mockErrorGeolocation });

      const errRes = await captureCurrentCoordinates();
      expect(errRes.success).toBe(false);
      expect(errRes.error?.code).toBe('PERMISSION_DENIED');
    });

    it('saves geofence policy with real coordinates and radius', async () => {
      const initialPolicies = await api.getPolicies();
      const geofencePolicy = initialPolicies.find(
        (p) => p.type === 'geofence_radius' || p.type === 'geofence_configuration'
      );
      expect(geofencePolicy).toBeDefined();

      if (geofencePolicy) {
        const updated = await api.updatePolicy(geofencePolicy.id, {
          type: 'geofence_configuration',
          value: {
            latitude: 6.524379,
            longitude: 3.379206,
            radiusMeters: 250,
            campusName: 'Main Campus Admin Hub',
            lastCalibratedAt: new Date().toISOString(),
          },
          isActive: true,
        });

        expect(updated.type).toBe('geofence_configuration');
        const val = updated.value as any;
        expect(val.latitude).toBe(6.524379);
        expect(val.radiusMeters).toBe(250);
      }
    });
  });

  // ─── 4. Student Session Capturers ─────────────────────────────────────────
  describe('4. Student Session Capturers (Part E)', () => {
    it('designates an eligible student as Session Capturer and syncs user capability', async () => {
      const students = await api.getStudents();
      const eligibleStudent = students.find((s) => s.status === 'active' && !s.captureCapability);
      expect(eligibleStudent).toBeDefined();

      if (eligibleStudent) {
        const { student: updatedStudent } = await api.assignSessionCapturer(eligibleStudent.id, true);
        expect(updatedStudent.captureCapability).toBe('session_capture');

        // Preserves academic identity, department, level, and enrollment records
        expect(updatedStudent.matricNumber).toBe(eligibleStudent.matricNumber);
        expect(updatedStudent.departmentId).toBe(eligibleStudent.departmentId);
        expect(updatedStudent.level).toBe(eligibleStudent.level);
        expect(updatedStudent.status).toBe('active');

        // Revokes capability cleanly
        const { student: revokedStudent } = await api.assignSessionCapturer(eligibleStudent.id, false);
        expect(revokedStudent.captureCapability).toBeNull();
      }
    });
  });

  // ─── 5. Academic Sessions & Bulk Progression ──────────────────────────────
  describe('5. Academic Sessions & Bulk Progression (Part F)', () => {
    it('fetches existing academic sessions and switches active semester', async () => {
      const sessions = await api.getAcademicSessions();
      expect(sessions.length).toBeGreaterThan(0);

      const activeSession = sessions.find((s) => s.isCurrent);
      expect(activeSession).toBeDefined();

      if (activeSession) {
        const nextSemester = activeSession.currentSemester === 1 ? 2 : 1;
        const updated = await api.updateAcademicSession(activeSession.id, {
          currentSemester: nextSemester,
        });

        expect(updated.currentSemester).toBe(nextSemester);
      }
    });

    it('enforces format validation on academic session creation', async () => {
      // Invalid format
      await expect(
        api.createAcademicSession({
          name: '2026-2027', // hyphen instead of slash
          startDate: '2026-09-01',
          endDate: '2027-07-31',
          currentSemester: 1,
        })
      ).rejects.toThrow(/YYYY\/YYYY/);

      // Non-sequential years
      await expect(
        api.createAcademicSession({
          name: '2026/2028',
          startDate: '2026-09-01',
          endDate: '2028-07-31',
          currentSemester: 1,
        })
      ).rejects.toThrow(/consecutive years/i);

      // Valid format
      const validSession = await api.createAcademicSession({
        name: '2027/2028',
        startDate: '2027-09-01',
        endDate: '2028-07-31',
        currentSemester: 1,
      });
      expect(validSession.id).toBeDefined();
      expect(validSession.name).toBe('2027/2028');
    });

    it('generates bulk progression preview excluding graduated, withdrawn, or suspended students', async () => {
      const sessions = await api.getAcademicSessions();
      const currentSession = sessions.find((s) => s.isCurrent);
      expect(currentSession).toBeDefined();

      if (currentSession) {
        const preview = await api.previewBulkProgression(currentSession.name, 2);
        expect(preview.targetSession).toBe(currentSession.name);
        expect(preview.targetSemester).toBe(2);

        // Verify summary properties
        expect(preview.totalStudents).toBeGreaterThan(0);
        expect(preview.eligibleCount).toBeGreaterThanOrEqual(0);

        // Inactive students (withdrawn, suspended, graduated) must NOT be marked eligible
        const excludedStudents = preview.students.filter((s) => !s.eligible);
        excludedStudents.forEach((student) => {
          expect(['already_progressed', 'excluded_status']).toContain(student.status);
        });
      }
    });

    it('executes atomic bulk progression without creating duplicate enrollments', async () => {
      const sessions = await api.getAcademicSessions();
      const currentSession = sessions.find((s) => s.isCurrent);
      expect(currentSession).toBeDefined();

      if (currentSession) {
        // Run progression to target semester 2
        const result = await api.executeBulkProgression(currentSession.name, 2);
        expect(result.targetSession).toBe(currentSession.name);
        expect(result.targetSemester).toBe(2);
        expect(result.failedCount).toBe(0);

        // Immediate subsequent progression preview for same session & semester detects already_enrolled students
        const duplicatePreview = await api.previewBulkProgression(currentSession.name, 2);
        expect(duplicatePreview.alreadyProgressedCount).toBeGreaterThanOrEqual(result.successfulCount);
      }
    });
  });

  // ─── 6. Redesigned Desktop Login Page ──────────────────────────────────────
  describe('6. Redesigned Desktop Login Page (Part G)', () => {
    it('renders two-panel layout with laptop dashboard preview placeholder and official authentication', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      // Laptop frame with dashboard placeholder is present on the left panel
      const placeholder = screen.getByTestId('dashboard-preview-placeholder');
      expect(placeholder).toBeTruthy();
      expect(screen.getByText(/Dashboard Preview Asset Placeholder/i)).toBeTruthy();

      // Right panel: Official institutional sign-in form
      expect(screen.getByRole('heading', { name: /^Sign In$/i })).toBeTruthy();
      expect(screen.getByLabelText(/Email Address or Staff ID/i)).toBeTruthy();
      expect(screen.getByLabelText(/^Password$/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeTruthy();

      // Biometric login button is completely omitted
      expect(screen.queryByRole('button', { name: /Biometric Scanner/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Fingerprint Login/i })).toBeNull();

      // Discreet Gate Access shortcut button is present
      const gateBtn = screen.getByRole('button', { name: /Gate Access/i });
      expect(gateBtn).toBeTruthy();
    });

    it('renders development personas in an unobtrusive dropdown without Mrs. Grace Onyekachi staff', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      // Unobtrusive dropdown header
      expect(screen.getByText('Development Personas')).toBeTruthy();
      expect(screen.getByText('Evaluation Mode')).toBeTruthy();

      // Accessible personas list does not include staff
      expect(screen.queryByText('Mrs. Grace Onyekachi')).toBeNull();

      // Includes valid personas: Super Admin, HOD, Lecturer, Session Capturer
      expect(TEST_ROLE_PROFILES.some((p) => p.role === 'super_admin')).toBe(true);
      expect(TEST_ROLE_PROFILES.some((p) => p.role === 'hod')).toBe(true);
      expect(TEST_ROLE_PROFILES.some((p) => p.role === 'lecturer')).toBe(true);
      expect(TEST_ROLE_PROFILES.some((p) => p.capability === 'session_capture')).toBe(true);
      expect(TEST_ROLE_PROFILES.some((p) => (p as any).role === 'staff')).toBe(false);
    });
  });
});
