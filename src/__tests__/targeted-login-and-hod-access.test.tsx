// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/login';
import { DevTestAccess, TEST_ROLE_PROFILES } from '@/pages/auth/dev-test-access';
import { Sidebar } from '@/components/layout/sidebar';
import { DashboardPage } from '@/pages/dashboard';
import { GateAttendancePage } from '@/pages/gate';
import {
  canViewGateLedger,
  canManageStaff,
  canManageStudents,
  isSuperAdmin,
  isHOD,
} from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/types';

describe('BCAMS Targeted Login and HOD Access Verification Suite', () => {
  beforeEach(() => {
    cleanup();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ─── 1. Login Page Structure & Primary vs Secondary Separation ─────────────
  describe('1. Login & Test Access Separation (Objectives 2 & 3)', () => {
    it('renders official institutional authentication as primary entry without biometric login', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      // Official authentication card is prominent
      expect(screen.getByText('Official Authentication')).toBeTruthy();
      expect(screen.getByLabelText(/Email Address or Staff ID/i)).toBeTruthy();
      expect(screen.getByLabelText(/^Password$/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeTruthy();

      // Biometric login button is completely omitted
      expect(screen.queryByText(/Biometric Scanner Login/i)).toBeNull();

      // Discreet Gate Access option is present
      expect(screen.getByRole('button', { name: /Gate Access/i })).toBeTruthy();

      // Dashboard preview placeholder inside laptop frame is present
      expect(screen.getByTestId('dashboard-preview-placeholder')).toBeTruthy();
    });

    it('renders development / test access as an unobtrusive dropdown control', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      // Dropdown control and evaluation badges
      expect(screen.getByText('Development Personas')).toBeTruthy();
      expect(screen.getByText('Evaluation Mode')).toBeTruthy();

      // Verify legitimate test personas in TEST_ROLE_PROFILES
      const names = TEST_ROLE_PROFILES.map(p => p.name);
      expect(names).toContain('Dr. Adebayo Ogundimu');
      expect(names).toContain('Prof. Chidinma Okafor');
      expect(names).toContain('Dr. Emeka Nwosu');
      expect(names).toContain('Amina Ibrahim');
      expect(names).not.toContain('Mrs. Grace Onyekachi');
    });

    it('preserves test personas without Gate Capturer role or gate records in HOD descriptions', () => {
      // Ensure no gate capturer role in test profiles
      const hasGateCapturer = TEST_ROLE_PROFILES.some(
        p => (p as any).capability === 'gate_capture' || (p as any).role === 'gate_capturer'
      );
      expect(hasGateCapturer).toBe(false);

      // Verify HOD descriptions no longer claim gate records access
      const hodProfiles = TEST_ROLE_PROFILES.filter(p => p.role === 'hod');
      for (const hod of hodProfiles) {
        expect(hod.description.toLowerCase()).not.toContain('gate record');
      }
    });

    it('implements scrollable container on the login page root preventing viewport clipping', () => {
      const { container } = render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.classList.contains('overflow-y-auto')).toBe(true);
      expect(rootDiv.classList.contains('h-full')).toBe(true);
      expect(rootDiv.classList.contains('w-full')).toBe(true);
    });

    it('allows role selection via DevTestAccess component', () => {
      let selectedUser: string | null = null;
      render(
        <DevTestAccess
          onSelectRole={(id) => { selectedUser = id; }}
          loadingRole={null}
        />
      );

      const hodButton = screen.getByText('Prof. Chidinma Okafor').closest('button');
      expect(hodButton).not.toBeNull();
      if (hodButton) {
        fireEvent.click(hodButton);
      }
      expect(selectedUser).toBe('user-hod');
    });
  });

  // ─── 2. HOD Gate Attendance Access Removal ─────────────────────────────────
  describe('2. HOD Gate Attendance Boundary Removal (Objective 1)', () => {
    const superAdminUser: User = {
      id: 'usr-sa',
      fullName: 'Super Admin',
      email: 'admin@institution.edu.ng',
      role: 'super_admin',
    };

    const hodCSUser: User = {
      id: 'usr-hod-cs',
      fullName: 'Prof. CS HOD',
      email: 'hod.cs@institution.edu.ng',
      role: 'hod',
      departmentId: 'dept-cs',
    };

    const hodITUser: User = {
      id: 'usr-hod-it',
      fullName: 'Dr. IT HOD',
      email: 'hod.it@institution.edu.ng',
      role: 'hod',
      departmentId: 'dept-it',
    };

    const staffUser: User = {
      id: 'usr-staff',
      fullName: 'Ordinary Staff',
      email: 'staff@institution.edu.ng',
      role: 'staff',
      departmentId: 'dept-cs',
    };

    it('permits Super Admin to view gate ledger', () => {
      expect(isSuperAdmin(superAdminUser)).toBe(true);
      expect(canViewGateLedger(superAdminUser)).toBe(true);
      expect(canViewGateLedger(superAdminUser, 'dept-cs')).toBe(true);
    });

    it('strictly denies HOD access to gate ledger across all departments', () => {
      expect(isHOD(hodCSUser)).toBe(true);
      // Denied universally
      expect(canViewGateLedger(hodCSUser)).toBe(false);
      // Denied even for own department
      expect(canViewGateLedger(hodCSUser, 'dept-cs')).toBe(false);
      // Denied for other departments
      expect(canViewGateLedger(hodCSUser, 'dept-it')).toBe(false);

      // Other HODs also denied
      expect(canViewGateLedger(hodITUser)).toBe(false);
      expect(canViewGateLedger(hodITUser, 'dept-it')).toBe(false);
    });

    it('strictly denies other non-admin roles access to gate ledger', () => {
      expect(canViewGateLedger(staffUser)).toBe(false);
      expect(canViewGateLedger(null)).toBe(false);
    });

    it('preserves HOD Staff Management and Student Management capabilities', () => {
      // HOD manages staff in their own department
      expect(canManageStaff(hodCSUser, 'dept-cs')).toBe(true);
      expect(canManageStaff(hodCSUser, 'dept-it')).toBe(false);

      // HOD manages students in their own department
      expect(canManageStudents(hodCSUser, 'dept-cs')).toBe(true);
      expect(canManageStudents(hodCSUser, 'dept-it')).toBe(false);
    });
  });

  // ─── 3. Targeted Gate Terminal & Dashboard Refinements ──────────────────────
  describe('3. Targeted Gate Terminal & Dashboard Refinements', () => {
    const superAdminUser: User = {
      id: 'usr-sa',
      fullName: 'Super Admin',
      email: 'admin@institution.edu.ng',
      role: 'super_admin',
    };

    it('renders Launch Gate Terminal button on login entry page', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /(Gate Access|Launch Gate Terminal)/i })).toBeTruthy();
    });

    it('removes Gate Terminal from Super Admin sidebar navigation while preserving Gate Attendance', () => {
      useAuthStore.setState({ user: superAdminUser, isAuthenticated: true });
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      // Super Admin should NOT see Gate Terminal
      expect(screen.queryByText('Gate Terminal')).toBeNull();
      // Super Admin DOES see Gate Attendance
      expect(screen.getByText('Gate Attendance')).toBeTruthy();
    });

    it('renders standalone Gate Terminal unit with Admin Portal exit navigation without requiring role login', () => {
      // No authenticated user
      useAuthStore.setState({ user: null, isAuthenticated: false });
      render(
        <MemoryRouter>
          <GateAttendancePage />
        </MemoryRouter>
      );

      expect(screen.getByText('Self-Service Gate Terminal')).toBeTruthy();
      expect(screen.getByText('Place Finger on Scanner')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Admin Portal/i })).toBeTruthy();
    });

    it('removes session filtering controls from the dashboard', async () => {
      useAuthStore.setState({ user: superAdminUser, isAuthenticated: true });
      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      // No dashboard session selector dropdown
      expect(screen.queryByLabelText(/Academic Session Filter/i)).toBeNull();
      expect(screen.queryByText('All Sessions')).toBeNull();
    });

    it('does not render obsolete Capture Devices card or endpoints indicator on dashboard', async () => {
      useAuthStore.setState({ user: superAdminUser, isAuthenticated: true });
      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      // Obsolete devices indicator is removed from dashboard
      expect(screen.queryByText(/Capture Devices/i)).toBeNull();
      expect(screen.queryByText(/registered endpoints/i)).toBeNull();
    });

    it('formats Today\'s Gate Records with Clocker, Clock In, and Clock Out, removing Department and On-time status', async () => {
      useAuthStore.setState({ user: superAdminUser, isAuthenticated: true });
      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      // Wait for clock record data to load
      expect(await screen.findByText('Mr. Tunde Afolabi')).toBeTruthy();

      // Check Clock In and Clock Out headers are rendered
      expect(screen.getAllByText('Clock In').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Clock Out').length).toBeGreaterThan(0);

      // Punctuality badge (On-Time / Late) is removed
      expect(screen.queryByText('On-Time Arrival')).toBeNull();
      expect(screen.queryByText('Late Arrival')).toBeNull();
    });
  });
});
