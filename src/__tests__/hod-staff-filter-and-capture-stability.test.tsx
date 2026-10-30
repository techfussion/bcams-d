// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StaffPage } from '@/pages/people/staff';
import { AttendanceCapturePage } from '@/pages/attendance/capture';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { mockApi } from '@/api';

describe('BCAMS — HOD Staff Filter & Session Capturer Stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Staff Page — Department Filter Visibility', () => {
    it('displays the department filter dropdown for Super Admin', async () => {
      useAuthStore.getState().login('user-sa');

      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      // Super Admin sees the Department filter dropdown in the toolbar
      await waitFor(() => {
        expect(screen.getByText('All Departments')).toBeTruthy();
      });
    });

    it('hides the department filter dropdown for HOD while preserving scoped departmental staff', async () => {
      useAuthStore.getState().login('user-hod');

      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      // Wait for data table to load departmental staff
      await waitFor(() => {
        expect(screen.getByText('Dr. Emeka Nwosu')).toBeTruthy();
      });

      // The department filter dropdown should NOT be present in the toolbar for HOD
      expect(screen.queryByText('All Departments')).toBeNull();

      // Classification filter remains available
      expect(screen.getByText('All Personnel')).toBeTruthy();
    });
  });

  describe('2. Session Capturer — Rendering Stability', () => {
    beforeEach(() => {
      useAuthStore.getState().login('user-stu-capturer');
    });

    it('renders stably without triggering an infinite loadData / PageSkeleton loop', async () => {
      const getSessionsSpy = vi.spyOn(mockApi, 'getSessions');

      render(
        <MemoryRouter initialEntries={['/attendance/capture']}>
          <Routes>
            <Route path="/attendance/capture" element={<AttendanceCapturePage />} />
          </Routes>
        </MemoryRouter>
      );

      // Initially shows skeleton while loading, then mounts workspace
      await waitFor(() => {
        expect(
          screen.queryByText(/Live Attendance Capture/i) || screen.queryByText(/Session Capture Terminal/i)
        ).toBeTruthy();
      });

      const initialCallCount = getSessionsSpy.mock.calls.length;
      expect(initialCallCount).toBeGreaterThanOrEqual(1);

      // Advance timers / wait a moment to ensure no background re-fetch loop is running
      await new Promise(r => setTimeout(r, 300));

      // getSessions should NOT keep being called in an infinite effect loop
      expect(getSessionsSpy.mock.calls.length).toBe(initialCallCount);
    });

    it('maintains mounted workspace during state updates and does not flash PageSkeleton', async () => {
      render(
        <MemoryRouter initialEntries={['/attendance/capture']}>
          <Routes>
            <Route path="/attendance/capture" element={<AttendanceCapturePage />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for workspace to mount
      await waitFor(() => {
        expect(
          screen.queryByText(/Live Attendance Capture/i) || screen.queryByText(/Session Capture Terminal/i)
        ).toBeTruthy();
      });

      // Trigger sync store state update
      act(() => {
        useSyncStore.getState().addPendingItem({
          type: 'attendance',
          description: 'Test Student — CSC 201',
          timestamp: new Date().toISOString(),
        });
      });

      // Confirm workspace remains visible and PageSkeleton does not take over
      expect(
        screen.queryByText(/Live Attendance Capture/i) || screen.queryByText(/Session Capture Terminal/i)
      ).toBeTruthy();

      // Trigger self-attendance capture if active session is mounted
      const selfAttendanceBtn = screen.queryByRole('button', { name: /Record Self-Attendance/i });
      if (selfAttendanceBtn) {
        await act(async () => {
          fireEvent.click(selfAttendanceBtn);
        });

        // Content remains visible and verified
        await waitFor(() => {
          expect(screen.getByText(/Attendance Verified/i)).toBeTruthy();
        });
      }
    });
  });
});
