// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentsPage } from '@/pages/people/students';
import { useAuthStore } from '@/stores/auth-store';

describe('Student Registry Refinements — Export, Truncation, SC Badge, and Action Cleanup', () => {
  beforeEach(() => {
    // Default to Super Admin
    useAuthStore.getState().login('user-sa');
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Student Registry — Configurable Export Modal', () => {
    it('opens configurable export modal with academic session, semester, department, level, and status filters', async () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Students/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Student Registry')).toBeTruthy();
        expect(screen.getByText(/Configure parameters to generate a CSV export/i)).toBeTruthy();
      });

      // Verify filter controls exist
      expect(screen.getByText('Academic Session')).toBeTruthy();
      expect(screen.getByText('Semester')).toBeTruthy();
      expect(screen.getByText('Department')).toBeTruthy();
      expect(screen.getByText('Standing Level')).toBeTruthy();
      expect(screen.getByText('Student Status')).toBeTruthy();
      expect(screen.getByText(/Matches.*student record.*ready for download/i)).toBeTruthy();
    });

    it('restricts HOD to authorized department and locks department selection in export modal', async () => {
      useAuthStore.getState().login('user-hod');

      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      const exportBtn = screen.getByRole('button', { name: /Export Students/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Student Registry')).toBeTruthy();
      });

      // Verify HOD sees locked department badge and department name
      expect(screen.getByText('Department Locked')).toBeTruthy();
      expect(screen.getAllByText('Computer Science').length).toBeGreaterThan(0);
    });
  });

  describe('2. Student Registry — Text Truncation', () => {
    it('applies text truncation classes and title attributes to student name, matric, department, and programme', async () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      // Student names have truncate class and title attribute
      const nameElement = screen.getByText('Amina Ibrahim');
      expect(nameElement.className).toContain('truncate');
      expect(nameElement.getAttribute('title')).toBe('Amina Ibrahim');

      // Matric numbers have truncate and title
      const matricElement = screen.getByText('CS/2024/005');
      expect(matricElement.className).toContain('truncate');
      expect(matricElement.getAttribute('title')).toBe('CS/2024/005');

      // Department & Programme have truncate and title
      const deptElements = screen.getAllByText('Computer Science');
      expect(deptElements.some(el => el.className.includes('truncate') && el.getAttribute('title') === 'Computer Science')).toBe(true);
    });
  });

  describe('3. Student Registry — Shortened Session Capturer Badge', () => {
    it('displays compact SC badge with Session Capturer tooltip/title instead of long label', async () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      // Find the SC badge for Amina Ibrahim (designated student capturer)
      const scBadges = screen.getAllByText('SC');
      expect(scBadges.length).toBeGreaterThan(0);

      // Verify tooltip container has title="Session Capturer"
      const scBadge = scBadges[0];
      const parentWithTitle = scBadge.closest('[title="Session Capturer"]');
      expect(parentWithTitle).toBeTruthy();

      // Ensure the long text is not rendered as the raw badge text
      expect(screen.queryByText('Session Capturer')).toBeNull();
    });
  });

  describe('4. Student Registry — Remove Biometric Enrollment Action', () => {
    it('does not display biometric fingerprint enrollment redirect action in the table rows', async () => {
      render(
        <MemoryRouter>
          <StudentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      // Legitimate actions exist
      const editButtons = screen.getAllByTitle('Edit student details');
      expect(editButtons.length).toBeGreaterThan(0);

      const progressionButtons = screen.getAllByTitle('Academic Progression & Course Enrollments');
      expect(progressionButtons.length).toBeGreaterThan(0);

      // Biometric Fingerprint Enrollment action button is removed
      expect(screen.queryByTitle('Biometric Fingerprint Enrollment')).toBeNull();
    });
  });
});
