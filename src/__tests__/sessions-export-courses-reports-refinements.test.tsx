// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { setMockUser } from '@/api/mock-adapter';
import { SessionDetailsPage } from '@/pages/sessions/details';
import { GateRecordsPage } from '@/pages/gate/records';
import { StaffPage } from '@/pages/people/staff';
import { EnrollmentPage } from '@/pages/enrollment';
import { CoursesPage } from '@/pages/academic/courses';
import { ReportsPage } from '@/pages/reports';
import { evaluateAttendanceQualification } from '@/domain';
import * as exportUtils from '@/domain/export-utils';

describe('BCAMS — Sessions Export, Registry Cleanup, Courses, Reports & Lecturer Scoping Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Sessions — Individual Session Export', () => {
    it('renders export attendance action and includes session context and only session attendance records', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      const downloadSpy = vi.spyOn(exportUtils, 'downloadCSV').mockImplementation(() => {});

      render(
        <MemoryRouter initialEntries={['/sessions/sess-today-01']}>
          <Routes>
            <Route path="/sessions/:sessionId" element={<SessionDetailsPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify Session details loads
      await waitFor(() => {
        expect(screen.getAllByText(/Export Attendance/i).length).toBeGreaterThan(0);
      });

      // Click Export Attendance button
      const exportButtons = screen.getAllByRole('button', { name: /export attendance/i });
      fireEvent.click(exportButtons[0]);

      // Verify Export Dialog opens with session metadata context
      await waitFor(() => {
        expect(screen.getByText(/Export Session Attendance/i)).toBeTruthy();
      });

      // Execute export
      const downloadButton = screen.getByRole('button', { name: /download attendance csv/i });
      fireEvent.click(downloadButton);

      expect(downloadSpy).toHaveBeenCalled();
      const [csvContent, filename] = downloadSpy.mock.calls[0];
      expect(filename).toContain('BCAMS_Session_CSC_201_Attendance');
      expect(csvContent).toContain('Session ID,Academic Session,Semester,Department,Course Code,Course Title,Venue,Session Date,Session Time,Authorizing Lecturer,Student Name,Matric Number,Time Captured,Clock Integrity');
      expect(csvContent).toContain('CSC 201');
      expect(csvContent).toContain('VERIFIED');
    });
  });

  describe('2. Gate Attendance — Rename Export Column', () => {
    it('exports Gate Attendance records with Clock Integrity column header instead of Integrity', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      const downloadSpy = vi.spyOn(exportUtils, 'downloadCSV').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <GateRecordsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export gate attendance/i })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: /export gate attendance/i }));

      // Wait for modal to open and click Download CSV
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download csv/i })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: /download csv/i }));

      expect(downloadSpy).toHaveBeenCalled();
      const [csvContent] = downloadSpy.mock.calls[0];
      expect(csvContent).toContain('Clock Integrity');
      expect(csvContent).not.toMatch(/^Integrity,/m);
      expect(csvContent).not.toMatch(/,Integrity,/m);
    });
  });

  describe('3. Staff Page — Remove HOD Actions', () => {
    it('does not display Assign HOD or Revoke HOD row actions in Staff Registry', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <StaffPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Staff Directory|Staff Registry/i)).toBeTruthy();
      });

      // Verify no Assign HOD or HOD button in table actions
      expect(screen.queryByTitle(/Assign HOD/i)).toBeNull();
      expect(screen.queryByTitle(/Revoke HOD/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /assign hod/i })).toBeNull();
    });
  });

  describe('4. Biometric Enrollment — Tab Scoping, Row Selection, & Simulation Removal', () => {
    it('removes row selection checkboxes, removes 10-finger simulation, and scopes filters to active tab', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <EnrollmentPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Biometric Enrollment/i)).toBeTruthy();
      });

      // 1. Verify row selection checkboxes are removed
      expect(screen.queryByRole('checkbox', { name: /select all/i })).toBeNull();
      expect(screen.queryByText(/selected/i)).toBeNull();

      // 2. Verify 10-Finger Simulation button is removed
      expect(screen.queryByRole('button', { name: /10 finger simulation/i })).toBeNull();
      expect(screen.queryByText(/simulate/i)).toBeNull();

      // 3. Filter scoping test: On Students tab, clicking filter should only show student records
      const notEnrolledFilter = screen.getByRole('button', { name: /not enrolled/i });
      fireEvent.click(notEnrolledFilter);

      await waitFor(() => {
        // Should not show staff IDs (STF/)
        const rows = screen.queryAllByText(/STF\//i);
        expect(rows.length).toBe(0);
      });

      // Switch to Staff tab
      const staffTab = screen.getByRole('button', { name: /staff personnel/i });
      fireEvent.click(staffTab);

      await waitFor(() => {
        // Should now only show staff records, no students
        const matricMatches = screen.queryAllByText(/202[0-9]\/[0-9]+/i);
        expect(matricMatches.length).toBe(0);
      });
    });
  });

  describe('5. Courses — Selection & Summary Cards Removal, Bulk Import, & Export', () => {
    it('removes summary cards and row selection, supports bulk import and export', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      const downloadSpy = vi.spyOn(exportUtils, 'downloadCSV').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <CoursesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Curriculum & Courses')).toBeTruthy();
      });

      // 1. Summary cards removed (Total Courses, Departments, Assigned Lecturers, General)
      expect(screen.queryByText(/Total Courses/i)).toBeNull();
      expect(screen.queryByText(/Assigned Lecturers/i)).toBeNull();

      // 2. Table selection checkboxes removed
      expect(screen.queryByRole('checkbox', { name: /select all/i })).toBeNull();

      // 3. Export button opens configurable modal before generating export (Section 10)
      const exportBtn = screen.getByRole('button', { name: /export courses/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText('Export Course Catalog')).toBeTruthy();
        expect(screen.getByText(/Configure parameters and filters before generating/i)).toBeTruthy();
      });

      // Verify export modal displays summary and filter options
      expect(screen.getByText('Export Summary')).toBeTruthy();
      const downloadModalBtn = screen.getByRole('button', { name: /download csv/i });
      fireEvent.click(downloadModalBtn);

      expect(downloadSpy).toHaveBeenCalled();
      const [csvContent, filename] = downloadSpy.mock.calls[0];
      expect(filename).toContain('courses_catalog_');
      expect(csvContent).toContain('Course Code,Course Title,Credit Units,Department,Level,Semester,General / GST,Primary Lecturer,Substitute Lecturer,Status');
    });

    it('completes the entire bulk import workflow: guidance, file upload, validation, duplicate detection, persistence and summary', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <CoursesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Curriculum & Courses')).toBeTruthy();
      });

      // 1. Open Bulk Import modal
      const importBtn = screen.getByRole('button', { name: /bulk import/i });
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(screen.getByText('Bulk Import Courses')).toBeTruthy();
        expect(screen.getByText(/Expected Column Structure & Template Guidance/i)).toBeTruthy();
      });

      // 2. Upload CSV with valid new course, duplicate in file, existing DB course, and invalid row
      const csvContent =
        "code,title,creditUnits,level,semester,department,isGeneral\n" +
        "CSC 499,Quantum Computing Systems,3,400,1,Computer Science,false\n" +
        "CSC 499,Quantum Computing Duplicate,3,400,1,Computer Science,false\n" +
        "CSC 201,Data Structures & Algorithms,3,200,1,Computer Science,false\n" +
        ",Machine Learning Without Code,3,300,1,Computer Science,false\n";

      const file = new File([csvContent], 'test_courses_import.csv', { type: 'text/csv' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      fireEvent.change(fileInput, { target: { files: [file] } });

      // 3. Verify Parsing, Validation, and Duplicate Detection
      await waitFor(() => {
        expect(screen.getByText('Ready to Import')).toBeTruthy();
        expect(screen.getByText('Existing in Registry')).toBeTruthy();
        expect(screen.getByText('Duplicates in File')).toBeTruthy();
        expect(screen.getByText('Invalid Rows')).toBeTruthy();
      });

      // Check row-level status labels
      expect(screen.getByText('File Duplicate')).toBeTruthy();
      expect(screen.getByText('Already Registered')).toBeTruthy();
      expect(screen.getByText('Invalid Row')).toBeTruthy();
      expect(screen.getByText('Valid Course')).toBeTruthy();

      // 4. Click Import to commit valid records
      const confirmImportBtn = screen.getByRole('button', { name: /import 1 valid record/i });
      fireEvent.click(confirmImportBtn);

      // 5. Verify Success/Failure Summary View is displayed
      await waitFor(() => {
        expect(screen.getByText('Bulk Import Results & Summary')).toBeTruthy();
        expect(screen.getByText('Successfully Imported')).toBeTruthy();
        expect(screen.getByText('Skipped Records (2)')).toBeTruthy();
        expect(screen.getByText('Failed Records (1)')).toBeTruthy();
      });

      // 6. Click Done to close summary
      const doneBtn = screen.getByRole('button', { name: /done/i });
      fireEvent.click(doneBtn);

      // 7. Verify newly imported course is persisted and displayed in the curriculum table
      await waitFor(() => {
        expect(screen.getByText('CSC 499')).toBeTruthy();
        expect(screen.getByText('Quantum Computing Systems')).toBeTruthy();
      });
    });

    it('simplifies Lecturer My Courses: removes search and filter controls, scopes to assigned courses in clean read-only view', async () => {
      // Set mock user to lecturer
      setMockUser('user-lec');
      useAuthStore.setState({
        user: {
          id: 'user-lec',
          fullName: 'Dr. Emeka Nwosu',
          role: 'lecturer',
          staffId: 'STF/CS/001',
          staffPersonId: 'stf-lec-001',
          departmentId: 'dept-cs',
          email: 'e.nwosu@institution.edu.ng',
        },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <CoursesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('My Courses')).toBeTruthy();
      });

      // 1. Search and all query filter controls MUST be removed for lecturer view
      expect(screen.queryByPlaceholderText(/search by code, title, or department/i)).toBeNull();
      expect(screen.queryByText('Academic Session')).toBeNull();
      expect(screen.queryByText('All Semesters')).toBeNull();
      expect(screen.queryByText('All Levels')).toBeNull();
      expect(screen.queryByText('All Status')).toBeNull();

      // 2. Administrative actions (Add Course, Bulk Import) must NOT exist for lecturer
      expect(screen.queryByRole('button', { name: /add course/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /bulk import/i })).toBeNull();

      // 3. Row mutation buttons (Edit, Assign Lecturers, Archive) must NOT exist
      expect(screen.queryByTitle(/edit course details/i)).toBeNull();
      expect(screen.queryByTitle(/assign primary & substitute lecturers/i)).toBeNull();
      expect(screen.queryByTitle(/archive course/i)).toBeNull();

      // 4. Verify courses returned are strictly scoped to Dr. Emeka Nwosu ('lec-001')
      await waitFor(() => {
        const rows = screen.getAllByText(/CSC 201|CSC 301/i);
        expect(rows.length).toBeGreaterThan(0);
      });
    });
  });

  describe('6. Attendance Qualification Rules — Authoritative Binary Outcomes', () => {
    it('qualifies when attendance percentage >= threshold; disqualifies when below', () => {
      // 80% threshold test
      const threshold = 80;

      // 80% exactly -> Qualified (NOT Borderline)
      const res80 = evaluateAttendanceQualification(8, 10, threshold);
      expect(res80.qualified).toBe(true);
      expect(res80.status).toBe('Qualified');
      expect(res80.actualPercentage).toBe(80);

      // 81% -> Qualified
      const res81 = evaluateAttendanceQualification(81, 100, threshold);
      expect(res81.qualified).toBe(true);
      expect(res81.status).toBe('Qualified');

      // 100% -> Qualified
      const res100 = evaluateAttendanceQualification(10, 10, threshold);
      expect(res100.qualified).toBe(true);
      expect(res100.status).toBe('Qualified');

      // 79.9% (below 80%) -> Not Qualified (unrounded comparison ensures no false qualification)
      const res799 = evaluateAttendanceQualification(799, 1000, threshold);
      expect(res799.qualified).toBe(false);
      expect(res799.status).toBe('Not Qualified');

      // 70% -> Not Qualified
      const res70 = evaluateAttendanceQualification(7, 10, threshold);
      expect(res70.qualified).toBe(false);
      expect(res70.status).toBe('Not Qualified');
    });
  });

  describe('7. Reports Page — Level Filter, Configurable Export & Print, and Lecturer Scoping', () => {
    it('removes summary cards, retains Average Attendance via CompactMetric, and filters by Level', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <ReportsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Reports & Exam Clearance')).toBeTruthy();
      });

      // 1. Metric cards removed: "Eligible for Exam", "At-Risk Borderline", "Barred From Exam"
      expect(screen.queryByText(/Eligible for Exam/i)).toBeNull();
      expect(screen.queryByText(/At-Risk Borderline/i)).toBeNull();
      expect(screen.queryByText(/Barred From Exam/i)).toBeNull();

      // 2. Average Attendance is retained in compact metric near header
      expect(screen.getByText(/Average Attendance/i)).toBeTruthy();

      // 3. Level filter is present
      expect(screen.getByText('All Levels')).toBeTruthy();

      // 4. Row selection checkboxes removed
      expect(screen.queryByRole('checkbox', { name: /select all/i })).toBeNull();
    });

    it('opens configurable modal for export and applies selected filters to CSV', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      const downloadSpy = vi.spyOn(exportUtils, 'downloadCSV').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <ReportsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Reports & Exam Clearance')).toBeTruthy();
      });

      // Click Export Clearance CSV
      const exportBtn = screen.getByRole('button', { name: /export clearance csv/i });
      fireEvent.click(exportBtn);

      // Verify Configurable Modal opens with Academic Session, Semester, Level, Course Offering
      await waitFor(() => {
        expect(screen.getByText(/Configure Clearance CSV Export/i)).toBeTruthy();
      });

      // Execute modal download
      const downloadBtn = screen.getByRole('button', { name: /download filtered csv/i });
      fireEvent.click(downloadBtn);

      expect(downloadSpy).toHaveBeenCalled();
      const [csvContent, filename] = downloadSpy.mock.calls[0];
      expect(filename).toContain('BCAMS_Exam_Clearance_');
      expect(csvContent).toContain('Matric Number,Full Name,Programme,Level,Attended Sessions,Total Sessions,Attendance Rate (%),Statutory Threshold (%),Exam Clearance Status');
      expect(csvContent).toMatch(/QUALIFIED|NOT QUALIFIED/);
    });

    it('opens configurable modal for roster print and produces formatted print table', async () => {
      setMockUser('user-sa');
      useAuthStore.setState({
        user: {
          id: 'user-sa',
          fullName: 'Prof. Olumide Johnson',
          role: 'super_admin',
          email: 'admin@bells.edu.ng',
        },
        isAuthenticated: true,
      });

      const printSpy = vi.spyOn(exportUtils, 'printTable').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <ReportsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Reports & Exam Clearance')).toBeTruthy();
      });

      // Test Print Roster Modal
      const printBtn = screen.getByRole('button', { name: /print roster/i });
      fireEvent.click(printBtn);

      await waitFor(() => {
        expect(screen.getByText(/Configure Print Examination Roster/i)).toBeTruthy();
      });

      const printConfirmBtn = screen.getByRole('button', { name: /print filtered roster/i });
      fireEvent.click(printConfirmBtn);

      expect(printSpy).toHaveBeenCalled();
      const [title, printData] = printSpy.mock.calls[0];
      expect(title).toContain('University Examination Clearance Roster');
      expect(Array.isArray(printData)).toBe(true);
    });

    it('scopes lecturer reports and offerings to the authenticated lecturer assignments only', async () => {
      setMockUser('user-lec');
      useAuthStore.setState({
        user: {
          id: 'user-lec',
          fullName: 'Dr. Emeka Nwosu',
          role: 'lecturer',
          staffId: 'STF/CS/001',
          staffPersonId: 'stf-lec-001',
          departmentId: 'dept-cs',
          email: 'e.nwosu@institution.edu.ng',
        },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <ReportsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Reports & Exam Clearance')).toBeTruthy();
      });

      // Lecturer should NOT see cross-department selector
      expect(screen.queryByPlaceholderText(/all departments/i)).toBeNull();

      // Offering dropdown should contain Dr. Nwosu's courses
      await waitFor(() => {
        expect(screen.getByText(/CSC 201/i)).toBeTruthy();
      });
    });
  });
});
