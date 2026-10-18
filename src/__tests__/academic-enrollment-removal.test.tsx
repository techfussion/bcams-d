// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/common/command-palette';
import { StudentsPage } from '@/pages/people/students';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/api';

describe('BCAMS — Academic Enrollment Page Removal & Workflow Preservation', () => {
  beforeEach(async () => {
    // Authenticate as Super Admin
    await useAuthStore.getState().login('user-sa');
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Navigation & Route Removal', () => {
    it('verifies Academic Enrollment is completely absent from Sidebar navigation', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );

      // Verify other navigation links exist
      expect(screen.getByText('Dashboard')).toBeTruthy();
      expect(screen.getByText('Students')).toBeTruthy();
      expect(screen.getByText('Courses')).toBeTruthy();

      // Verify Academic Enrollment is NOT present in sidebar
      expect(screen.queryByText('Academic Enrollment')).toBeNull();
    });

    it('verifies Academic Enrollment is absent from Command Palette shortcuts', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <CommandPalette />
        </MemoryRouter>
      );

      // Verify palette does not contain Academic Enrollment
      expect(screen.queryByText('Academic Enrollment')).toBeNull();
    });

    it('redirects former /academic/enrollment route to /people/students in App router', async () => {
      window.location.hash = '#/academic/enrollment';

      render(<App />);

      // Should land on Student Registry
      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      // No Academic Enrollment header or page is rendered
      expect(screen.queryByRole('heading', { name: /^Academic Enrollment$/i })).toBeNull();
    });
  });

  describe('2. Student Registry Academic Progression & Course Enrolment Workflow Preservation', () => {
    it('preserves the Student Registry academic progression modal and course registration', async () => {
      render(
        <MemoryRouter initialEntries={['/people/students']}>
          <StudentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Registry')).toBeTruthy();
      });

      // Find the Progression & Course History action button on student rows
      const progressionButtons = screen.getAllByTitle('Academic Progression & Course Enrollments');
      expect(progressionButtons.length).toBeGreaterThan(0);

      // Click to open progression modal
      fireEvent.click(progressionButtons[0]);

      // Verify the progression dialog opens with complete history and progression forms
      await waitFor(() => {
        expect(screen.getByText('Academic Progression & Course History')).toBeTruthy();
        expect(screen.getByText('Academic Progression Sequence')).toBeTruthy();
        expect(screen.getByText('Record Academic Progression')).toBeTruthy();
        expect(screen.getByText(/Active Course Enrollments/i)).toBeTruthy();
      });
    });

    it('preserves academic progression API methods and underlying domain data', async () => {
      // Retrieve student and check historical academic enrollments
      const students = await api.getStudents();
      expect(students.length).toBeGreaterThan(0);

      const targetStudent = students[0];
      const enrollments = await api.getAcademicEnrollments(targetStudent.id);
      expect(Array.isArray(enrollments)).toBe(true);

      // Domain data integrity
      if (enrollments.length > 0) {
        expect(enrollments[0].studentId).toBe(targetStudent.id);
        expect(enrollments[0].academicSession).toBeTruthy();
        expect(enrollments[0].level).toBeGreaterThan(0);
      }
    });
  });
});
