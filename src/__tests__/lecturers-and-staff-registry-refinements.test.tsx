// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LecturersPage } from '@/pages/people/lecturers';
import { StaffPage } from '@/pages/people/staff';
import { useAuthStore } from '@/stores/auth-store';

describe('BCAMS — Lecturer & Staff Registry Refinements', () => {
  beforeEach(() => {
    // Default login as Super Admin
    useAuthStore.getState().login('user-sa');
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Lecturer Page — Configurable Export Modal', () => {
    it('opens configurable export modal with department filter for Super Admin', async () => {
      render(
        <MemoryRouter>
          <LecturersPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Lecturers Registry')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Lecturers/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Lecturer Registry')).toBeTruthy();
        expect(screen.getByText(/Configure parameters to generate a CSV export of lecturer records/i)).toBeTruthy();
      });

      const dialog = screen.getByRole('dialog');
      // Department filter is present in dialog
      expect(within(dialog).getByText('Department')).toBeTruthy();
      expect(within(dialog).getByText(/Matches.*lecturer record.*ready for download/i)).toBeTruthy();
    });

    it('locks department selection and enforces department scoping for HOD in Lecturer export modal', async () => {
      useAuthStore.getState().login('user-hod');

      render(
        <MemoryRouter>
          <LecturersPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Lecturers Registry')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Lecturers/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Lecturer Registry')).toBeTruthy();
      });

      const dialog = screen.getByRole('dialog');
      // Verify department locked indicator
      expect(within(dialog).getByText('Department Locked')).toBeTruthy();
      expect(within(dialog).getByText('Computer Science')).toBeTruthy();
    });
  });

  describe('2. Lecturer Page — Table Truncation', () => {
    it('applies text truncation classes and title attributes to lecturer table columns', async () => {
      render(
        <MemoryRouter>
          <LecturersPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Lecturers Registry')).toBeTruthy();
      });

      // Check lecturer name truncation and title
      const nameElements = screen.getAllByText('Dr. Emeka Nwosu');
      expect(nameElements.length).toBeGreaterThan(0);
      const nameEl = nameElements[0];
      expect(nameEl.className).toContain('truncate');
      expect(nameEl.getAttribute('title')).toBe('Dr. Emeka Nwosu');

      // Check staffId truncation and title
      const staffIdEl = screen.getByText('STF/CS/001');
      expect(staffIdEl.className).toContain('truncate');
      expect(staffIdEl.getAttribute('title')).toBe('STF/CS/001');

      // Check department truncation and title
      const deptElements = screen.getAllByText('Computer Science');
      expect(deptElements.some(el => el.className.includes('truncate') && el.getAttribute('title') === 'Computer Science')).toBe(true);
    });
  });

  describe('3. Lecturer Page — Remove Biometric Action', () => {
    it('removes biometric fingerprint enrollment button from row actions while preserving Edit and Assign Course', async () => {
      render(
        <MemoryRouter>
          <LecturersPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Lecturers Registry')).toBeTruthy();
      });

      // Preserved actions exist
      const editButtons = screen.getAllByTitle('Edit Lecturer Profile');
      expect(editButtons.length).toBeGreaterThan(0);

      const assignButtons = screen.getAllByTitle('Assign Course (Primary or Substitute)');
      expect(assignButtons.length).toBeGreaterThan(0);

      // Biometric fingerprint action is removed
      expect(screen.queryByTitle(/Biometric Fingerprint Enrollment/i)).toBeNull();
    });
  });

  describe('4. Lecturer Page — Remove “Staff Identity Linked” Badge', () => {
    it('does not display the redundant "Staff Identity Linked" badge in lecturer rows', async () => {
      render(
        <MemoryRouter>
          <LecturersPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Lecturers Registry')).toBeTruthy();
      });

      expect(screen.queryByText('Staff Identity Linked')).toBeNull();
    });
  });

  describe('5. Staff Page — Configurable Export Modal', () => {
    it('opens configurable export modal with department and classification filters for Super Admin', async () => {
      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Staff/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Staff Directory')).toBeTruthy();
        expect(screen.getByText(/Configure parameters to generate a CSV export of staff records/i)).toBeTruthy();
      });

      const dialog = screen.getByRole('dialog');
      // Filter controls exist inside dialog
      expect(within(dialog).getByText('Department')).toBeTruthy();
      expect(within(dialog).getByText('Classification')).toBeTruthy();
      expect(within(dialog).getByText(/Matches.*staff record.*ready for download/i)).toBeTruthy();
    });

    it('locks department selection and enforces department scoping for HOD in Staff export modal', async () => {
      useAuthStore.getState().login('user-hod');

      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Staff/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Staff Directory')).toBeTruthy();
      });

      const dialog = screen.getByRole('dialog');
      // Verify department locked indicator
      expect(within(dialog).getByText('Department Locked')).toBeTruthy();
      expect(within(dialog).getByText('Computer Science')).toBeTruthy();
    });
  });

  describe('6. Staff Page — Table Truncation', () => {
    it('applies text truncation classes and title attributes to staff table columns', async () => {
      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      // Check staff name truncation and title
      const nameElements = screen.getAllByText('Dr. Emeka Nwosu');
      expect(nameElements.length).toBeGreaterThan(0);
      const nameEl = nameElements[0];
      expect(nameEl.className).toContain('truncate');
      expect(nameEl.getAttribute('title')).toBe('Dr. Emeka Nwosu');

      // Check staffId truncation and title
      const staffIdEl = screen.getByText('STF/CS/001');
      expect(staffIdEl.className).toContain('truncate');
      expect(staffIdEl.getAttribute('title')).toBe('STF/CS/001');

      // Check designation truncation and title
      const desigElements = screen.getAllByText('Senior Lecturer');
      expect(desigElements.some(el => el.className.includes('truncate') && el.getAttribute('title') === 'Senior Lecturer')).toBe(true);

      // Check department truncation and title
      const deptElements = screen.getAllByText('Computer Science');
      expect(deptElements.some(el => el.className.includes('truncate') && el.getAttribute('title') === 'Computer Science')).toBe(true);
    });
  });

  describe('7. Staff Page — Simplify Personnel Badges', () => {
    it('removes redundant "Teaching Lecturer" badge and simplifies HOD badge to "HOD"', async () => {
      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      // "Teaching Lecturer" badge is removed from Staff Personnel column
      expect(screen.queryByText('Teaching Lecturer')).toBeNull();

      // HOD badge is simplified to "HOD" without department suffix
      const hodBadges = screen.getAllByText('HOD');
      expect(hodBadges.length).toBeGreaterThan(0);
      expect(screen.queryByText(/HOD \(Computer Science\)/i)).toBeNull();

      // Classification column still properly distinguishes staff
      expect(screen.getAllByText('Academic Staff').length).toBeGreaterThan(0);
    });
  });

  describe('8. Staff Page — Remove Fingerprint Action', () => {
    it('removes biometric fingerprint enrollment button from row actions while preserving Edit and HOD buttons', async () => {
      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      // Preserved actions exist
      const editButtons = screen.getAllByTitle('Edit Staff Member');
      expect(editButtons.length).toBeGreaterThan(0);

      // HOD actions have moved to Academia and are removed from Staff ledger
      expect(screen.queryByTitle('Assign or Revoke HOD Responsibility')).toBeNull();

      // Biometric fingerprint action is removed
      expect(screen.queryByTitle(/Staff Biometric Fingerprint Enrollment/i)).toBeNull();
    });
  });

  describe('9. Staff Page — Remove Unused Row Selection', () => {
    it('does not render row selection checkboxes or select-all controls', async () => {
      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      // No checkbox inputs in the table for row selection
      const tableCheckboxes = screen.queryAllByRole('checkbox');
      expect(tableCheckboxes.length).toBe(0);
    });
  });

  describe('10. Staff Page — Remove Summary Cards', () => {
    it('does not display quick stats summary cards (Total Staff, Teaching Lecturers, Gate Authorized)', async () => {
      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Staff Directory')).toBeTruthy();
      });

      expect(screen.queryByText('Total Staff')).toBeNull();
      expect(screen.queryByText('Teaching Lecturers')).toBeNull();
      expect(screen.queryByText('Gate Authorized')).toBeNull();
    });
  });
});
