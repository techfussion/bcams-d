// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionsPage } from '@/pages/sessions';
import { SessionDetailsPage } from '@/pages/sessions/details';
import { GateRecordsPage } from '@/pages/gate/records';
import { LoginPage } from '@/pages/auth/login';
import { AcademiaPage } from '@/pages/academic/academia';
import { SettingsPage } from '@/pages/settings';
import { CoursesPage } from '@/pages/academic/courses';
import { LecturersPage } from '@/pages/people/lecturers';
import { StaffPage } from '@/pages/people/staff';
import { Sidebar } from '@/components/layout/sidebar';
import { TEST_ROLE_PROFILES } from '@/pages/auth/dev-test-access';
import { useAuthStore } from '@/stores/auth-store';

describe('BCAMS — Sessions, Attendance Tables, Session Details & Gate Attendance Refinements', () => {
  beforeEach(() => {
    // Set Super Admin by default
    useAuthStore.getState().login('user-sa');
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Redundant Date Indicators Removal', () => {
    it('does not display redundant Date Indicators toggle on Sessions page', async () => {
      render(
        <MemoryRouter>
          <SessionsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Class Sessions Ledger')).toBeTruthy();
      });

      expect(screen.queryByText('Date Indicators')).toBeNull();
      expect(screen.queryByText('Standard Flat')).toBeNull();
    });

    it('does not display redundant Date Indicators toggle on Gate Attendance records page', async () => {
      render(
        <MemoryRouter>
          <GateRecordsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Gate Attendance Ledger')).toBeTruthy();
      });

      expect(screen.queryByText('Date Indicators')).toBeNull();
      expect(screen.queryByText('Standard Flat')).toBeNull();
    });
  });

  describe('2. Removal of Redundant Class Attendance Page & Navigation', () => {
    it('does not display Class Attendance in the sidebar navigation for Super Admin or HOD', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      // Verify Sessions is present, but Class Attendance is NOT
      expect(screen.getByText('Sessions')).toBeTruthy();
      expect(screen.queryByText('Class Attendance')).toBeNull();

      // Switch to HOD
      useAuthStore.getState().login('user-hod');
      cleanup();
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByText('Sessions')).toBeTruthy();
      expect(screen.queryByText('Class Attendance')).toBeNull();
    });
  });

  describe('3. Session Details — Selection & Sync State Removal, UI Commentary Cleanup', () => {
    it('removes table selection checkboxes, selection feedback, and Sync State column', async () => {
      render(
        <MemoryRouter initialEntries={['/sessions/sess-today-01']}>
          <Routes>
            <Route path="/sessions/:sessionId" element={<SessionDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/CSC 201 — Class Session/i)).toBeTruthy();
      });

      // Verify no table row-selection checkboxes or select-all controls
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);

      // Verify selection count feedback is absent
      expect(screen.queryByText(/selected.*record/i)).toBeNull();

      // Verify Sync State column is removed
      expect(screen.queryByText(/Sync State/i)).toBeNull();
      expect(screen.queryByText(/FR-3/i)).toBeNull();

      // Verify requirement commentary is removed
      expect(screen.queryByText(/FR-10.6/i)).toBeNull();
      expect(screen.queryByText(/Non-attendees derived as Absent/i)).toBeNull();

      // Verify Clock Integrity column header is present without FR-4
      expect(screen.getByText('Clock Integrity')).toBeTruthy();
      expect(screen.queryByText(/Clock Integrity \(FR-4\)/i)).toBeNull();

      // Verify attendance records are rendered properly
      expect(screen.getByText('Verified Student Attendance Records')).toBeTruthy();
      expect(screen.getByText(/biometric scan\(s\) recorded for this session\./i)).toBeTruthy();
      expect(screen.getByText('Oluwaseun Adeyemi')).toBeTruthy();
      expect(screen.getByText('CS/2024/001')).toBeTruthy();
    });
  });

  describe('4. Removal of Implementation & Requirement Commentary across UI', () => {
    it('does not display FR- or Section references in policies, settings, courses, lecturers, staff', async () => {
      // Academia Page (consolidates policies and departments)
      const { unmount: unmountPol } = render(
        <MemoryRouter>
          <AcademiaPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Academia')).toBeTruthy();
      });
      expect(screen.queryByText(/FR-4\.1/i)).toBeNull();
      unmountPol();

      // Settings Page
      const { unmount: unmountSet } = render(
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeTruthy();
      });
      expect(screen.queryByText(/\(FR-4\)/i)).toBeNull();
      expect(screen.queryByText(/FR-4:/i)).toBeNull();
      expect(screen.queryByText(/FR-3:/i)).toBeNull();
      unmountSet();

      // Courses Page
      const { unmount: unmountCrs } = render(
        <MemoryRouter>
          <CoursesPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Curriculum & Courses')).toBeTruthy();
      });
      expect(screen.queryByText(/Section 23/i)).toBeNull();
      unmountCrs();

      // Lecturers Page
      const { unmount: unmountLec } = render(
        <MemoryRouter>
          <LecturersPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Lecturers Registry')).toBeTruthy();
      });
      expect(screen.queryByText(/Section 23/i)).toBeNull();
      unmountLec();

      // Staff Page
      const { unmount: unmountStf } = render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });
      expect(screen.queryByText(/Section 26/i)).toBeNull();
      unmountStf();
    });
  });

  describe('5. Sessions Page — Configurable Export Modal', () => {
    it('opens configurable export modal with academic session, semester, status, and date range filters', async () => {
      render(
        <MemoryRouter>
          <SessionsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Class Sessions Ledger')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Sessions/i });
      fireEvent.click(exportBtn);

      // Verify modal dialog opened
      await waitFor(() => {
        expect(screen.getByText('Export Class Sessions')).toBeTruthy();
        expect(screen.getByText(/Configure parameters to generate a CSV export/i)).toBeTruthy();
      });

      // Super Admin sees Department selector
      expect(screen.getByText('Department')).toBeTruthy();
      expect(screen.getByText('Academic Session')).toBeTruthy();
      expect(screen.getByText('Semester')).toBeTruthy();
      expect(screen.getByText('Session Status')).toBeTruthy();
      expect(screen.getByText('From Date')).toBeTruthy();
      expect(screen.getByText('To Date')).toBeTruthy();
      expect(screen.getByText(/Matches.*session.*ready for download/i)).toBeTruthy();
    });

    it('restricts HOD to authorized department and locks department selection in export modal', async () => {
      useAuthStore.getState().login('user-hod');

      render(
        <MemoryRouter>
          <SessionsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Class Sessions Ledger')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Sessions/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Class Sessions')).toBeTruthy();
      });

      // Verify HOD sees "Department Locked" and authorized department name, not an open selector
      expect(screen.getByText('Department Locked')).toBeTruthy();
      expect(screen.getAllByText('Computer Science').length).toBeGreaterThan(0);
    });
  });

  describe('6. Gate Attendance — Simplified Headers, Punctuality, & Extra Scans Removal', () => {
    it('displays Clock In and Clock Out headers without expected time suffixes', async () => {
      render(
        <MemoryRouter>
          <GateRecordsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Gate Attendance Ledger')).toBeTruthy();
      });

      // Verify simplified headers
      expect(screen.getByText('Clock In')).toBeTruthy();
      expect(screen.getByText('Clock Out')).toBeTruthy();
      expect(screen.queryByText(/Clock In \(Expected 9:00 AM\)/i)).toBeNull();
      expect(screen.queryByText(/Clock Out \(Expected 5:00 PM\)/i)).toBeNull();

      // Verify punctuality badges use concise "On Time" and "Late"
      expect(screen.getAllByText('On Time').length).toBeGreaterThan(0);
      expect(screen.queryByText(/On-Time Arrival \(≤10:00 AM\)/i)).toBeNull();
      expect(screen.queryByText(/Late Arrival \(>10:00 AM\)/i)).toBeNull();

      // Verify Extra Scans column is removed
      expect(screen.queryByText('Extra Scans')).toBeNull();
      expect(screen.queryByText(/suppressed/i)).toBeNull();
    });
  });

  describe('7. Login Dev/Test Access Staff Profile Removal', () => {
    it('does not display Mrs. Grace Onyekachi Staff test entry on Login page', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      // Dev test access header present
      expect(screen.getByText('Development / Test Access')).toBeTruthy();

      // Super Admin, HOD, Lecturer, Session Capturer profiles present
      expect(screen.getAllByText('Dr. Adebayo Ogundimu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Prof. Chidinma Okafor').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Dr. Emeka Nwosu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Amina Ibrahim').length).toBeGreaterThan(0);

      // Staff test profile Mrs. Grace Onyekachi removed
      expect(screen.queryByText('Mrs. Grace Onyekachi')).toBeNull();

      // TEST_ROLE_PROFILES does not contain role: 'staff'
      expect(TEST_ROLE_PROFILES.some(p => p.role === 'staff')).toBe(false);
    });
  });
});
