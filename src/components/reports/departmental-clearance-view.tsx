/**
 * Departmental Clearance View & Bulk ZIP Export Component
 * 
 * Manages student departmental clearance rosters, single A4 examination
 * pass previews/printing, and bulk compilation of all passes into a ZIP
 * archive with manifest index using JSZip.
 */

import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { useToast } from '@/hooks/use-toast';
import { getHodSignoffData } from '@/lib/hod-signature-store';
import {
  ClearancePassModal,
  generatePassHtml,
  type DepartmentalStudentEligibility,
  type CourseAttendanceSummary,
} from './clearance-pass-modal';
import type { Student, Department, CourseOffering } from '@/types';
import {
  FileText,
  Archive,
  Printer,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Award,
  Layers,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface DepartmentalClearanceViewProps {
  students: Student[];
  departments: Department[];
  allOfferings: CourseOffering[];
  userRole?: string;
  userDepartmentId?: string;
}

export function DepartmentalClearanceView({
  students,
  departments,
  allOfferings,
  userRole,
  userDepartmentId,
}: DepartmentalClearanceViewProps) {
  const toast = useToast();

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>(
    userRole === 'hod' ? (userDepartmentId || 'dept-cs') : 'all'
  );
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Eligible' | 'Ineligible' | 'Pending Review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [academicSession, setAcademicSession] = useState('2026/2027');
  const [semester, setSemester] = useState('First Semester');

  // Modal State
  const [selectedStudentForPass, setSelectedStudentForPass] = useState<DepartmentalStudentEligibility | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);

  // Bulk ZIP Export State
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgressText, setZipProgressText] = useState('');

  const isSuperAdmin = userRole === 'super_admin';

  // Standard course catalog generator based on level and program
  const getCoursesForStudent = (level: number, matric: string): CourseAttendanceSummary[] => {
    // Generate deterministic variance using matric string characters
    const seed = matric.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    if (level === 400) {
      return [
        { courseCode: 'CSC 401', courseTitle: 'Software Engineering Principles', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'CSC 405', courseTitle: 'Compiler Construction & Automata', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'CSC 411', courseTitle: 'Artificial Intelligence & Neural Nets', creditUnits: 3, totalClasses: 12, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'CSC 417', courseTitle: 'Computer Security & Cryptography', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'CSC 423', courseTitle: 'Distributed Systems & Cloud Computing', creditUnits: 2, totalClasses: 12, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'CSC 499', courseTitle: 'Final Year Research Project', creditUnits: 6, totalClasses: 10, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      ];
    }

    if (level === 200) {
      return [
        { courseCode: 'CSC 201', courseTitle: 'Computer Programming II (OOP)', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'CSC 203', courseTitle: 'Introduction to Computer Systems', creditUnits: 2, totalClasses: 12, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'MTH 201', courseTitle: 'Mathematical Methods I', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'PHY 201', courseTitle: 'General Physics III (Electronics)', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
        { courseCode: 'GST 201', courseTitle: 'Peace Studies and Conflict Resolution', creditUnits: 2, totalClasses: 10, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      ];
    }

    // Default 300 Level
    return [
      { courseCode: 'CSC 301', courseTitle: 'Operating Systems & Architecture', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      { courseCode: 'CSC 303', courseTitle: 'Data Structures & Algorithm Design', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      { courseCode: 'CSC 305', courseTitle: 'Computer Networks & Teleprocessing', creditUnits: 2, totalClasses: 12, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      { courseCode: 'CSC 311', courseTitle: 'Database Design & Implementation', creditUnits: 3, totalClasses: 14, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      { courseCode: 'CSC 315', courseTitle: 'Web Technologies & Architecture', creditUnits: 3, totalClasses: 12, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
      { courseCode: 'CSC 321', courseTitle: 'Human-Computer Interaction (HCI)', creditUnits: 2, totalClasses: 12, classesAttended: 0, attendanceRate: 0, status: 'CLEARED' },
    ];
  };

  // Compile realistic departmental eligibility data for all students
  const departmentalStudents: DepartmentalStudentEligibility[] = useMemo(() => {
    return students.map((s, idx) => {
      const level = s.currentLevel || s.level || 300;
      const deptId = s.departmentId || 'dept-cs';
      const deptObj = departments.find(d => d.id === deptId);
      const deptName = deptObj?.name || 'Department of Computer Science';
      const matric = s.matricNumber || `CSC/2023/${100 + idx}`;

      const rawCourses = getCoursesForStudent(level, matric);
      const studentSeed = (idx * 17 + matric.length * 23) % 100;

      // Distribution:
      // ~78% eligible (overall >= 75%)
      // ~12% pending review (68% - 74%)
      // ~10% ineligible (< 68%)
      const isPending = studentSeed >= 78 && studentSeed < 90;
      const isIneligible = studentSeed >= 90;

      let totalClassesAll = 0;
      let totalAttendedAll = 0;

      const courses: CourseAttendanceSummary[] = rawCourses.map((c, cIdx) => {
        let rate: number;
        if (isIneligible) {
          // Ineligible: low rate 42% - 68%
          rate = 42 + ((studentSeed + cIdx * 11) % 27);
        } else if (isPending) {
          // Borderline: 68% - 78%
          rate = 68 + ((studentSeed + cIdx * 7) % 11);
        } else {
          // High attendance: 78% - 98%
          rate = 78 + ((studentSeed + cIdx * 5) % 21);
        }

        const attended = Math.min(c.totalClasses, Math.round((rate / 100) * c.totalClasses));
        const actualRate = Math.round((attended / c.totalClasses) * 100);

        totalClassesAll += c.totalClasses;
        totalAttendedAll += attended;

        return {
          ...c,
          classesAttended: attended,
          attendanceRate: actualRate,
          status: actualRate >= 75 ? 'CLEARED' : 'DEFICIENT',
        };
      });

      const overallAttendanceRate = totalClassesAll > 0
        ? Math.round((totalAttendedAll / totalClassesAll) * 100)
        : 0;

      let overallStatus: DepartmentalStudentEligibility['overallStatus'] = 'Eligible';
      if (overallAttendanceRate >= 75) {
        overallStatus = 'Eligible';
      } else if (overallAttendanceRate >= 68 && overallAttendanceRate < 75) {
        overallStatus = 'Pending Review';
      } else {
        overallStatus = 'Ineligible';
      }

      const totalCU = courses.reduce((sum, c) => sum + c.creditUnits, 0);
      const cleanMatric = matric.replace(/[^A-Za-z0-9]/g, '');
      const verificationCode = `BCAMS-CLR-2026-${cleanMatric}-${1000 + (idx * 31 % 8999)}`;

      return {
        id: `dept-stud-${s.id}`,
        studentId: s.id,
        fullName: s.fullName,
        matricNumber: matric,
        departmentId: deptId,
        departmentName: deptName,
        facultyName: 'College of Natural & Applied Sciences',
        programme: s.currentProgramme || s.programme || 'B.Sc. Computer Science',
        level,
        totalRegisteredCourses: courses.length,
        totalCreditUnits: totalCU,
        overallAttendanceRate,
        overallStatus,
        verificationCode,
        courses,
      };
    });
  }, [students, departments]);

  // Filtered dataset
  const filteredStudents = useMemo(() => {
    return departmentalStudents.filter((s) => {
      if (selectedDept !== 'all' && s.departmentId !== selectedDept) return false;
      if (levelFilter !== 'all' && String(s.level) !== levelFilter) return false;
      if (statusFilter !== 'all' && s.overallStatus !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchMatric = s.matricNumber.toLowerCase().includes(q);
        const matchProg = s.programme.toLowerCase().includes(q);
        if (!matchName && !matchMatric && !matchProg) return false;
      }

      return true;
    });
  }, [departmentalStudents, selectedDept, levelFilter, statusFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = filteredStudents.length;
    const eligible = filteredStudents.filter((s) => s.overallStatus === 'Eligible').length;
    const pending = filteredStudents.filter((s) => s.overallStatus === 'Pending Review').length;
    const ineligible = filteredStudents.filter((s) => s.overallStatus === 'Ineligible').length;
    const eligibleRate = total > 0 ? Math.round((eligible / total) * 100) : 0;

    return { total, eligible, pending, ineligible, eligibleRate };
  }, [filteredStudents]);

  // Handle Single Pass View
  const handleViewPass = (student: DepartmentalStudentEligibility) => {
    setSelectedStudentForPass(student);
    setIsPassModalOpen(true);
  };

  // Handle Bulk ZIP Export
  const handleDownloadAllZip = async () => {
    if (filteredStudents.length === 0) {
      toast.error('No students to export', 'The current filter returned 0 clearance records.');
      return;
    }

    setIsExportingZip(true);
    setZipProgressText(`Preparing ${filteredStudents.length} clearance passes...`);

    try {
      const signoffData = getHodSignoffData();
      const zip = new JSZip();

      // Department name for folder & zip file name
      const deptLabel = selectedDept !== 'all'
        ? (departments.find(d => d.id === selectedDept)?.name || 'Department').replace(/[^a-zA-Z0-9]/g, '_')
        : 'All_Departments';
      const levelLabel = levelFilter !== 'all' ? `_${levelFilter}L` : '';
      const zipFilename = `Department_${deptLabel}${levelLabel}_Clearance_Passes.zip`;

      const passesFolder = zip.folder(`Clearance_Passes_${deptLabel}`);

      // Generate HTML for each student
      filteredStudents.forEach((student, index) => {
        setZipProgressText(`Compiling pass [${index + 1}/${filteredStudents.length}]: ${student.matricNumber}`);
        const html = generatePassHtml(student, signoffData);
        const sanitizedMatric = student.matricNumber.replace(/[\/\\?%*:|"<>]/g, '_');
        const sanitizedName = student.fullName.replace(/[\/\\?%*:|"<>]/g, '_');
        passesFolder?.file(`Pass_${sanitizedMatric}_${sanitizedName}.html`, html);
      });

      // Master Manifest HTML
      const manifestRows = filteredStudents.map((s, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 8px; font-family: monospace;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">${s.matricNumber}</td>
          <td style="padding: 6px 8px; font-weight: 600;">${s.fullName}</td>
          <td style="padding: 6px 8px;">${s.programme} (${s.level}L)</td>
          <td style="padding: 6px 8px; text-align: center;">${s.totalRegisteredCourses} Courses (${s.totalCreditUnits} CU)</td>
          <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">${s.overallAttendanceRate}%</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: ${s.overallStatus === 'Eligible' ? '#047857' : s.overallStatus === 'Pending Review' ? '#b45309' : '#b91c1c'};">${s.overallStatus.toUpperCase()}</td>
          <td style="padding: 6px 8px; font-family: monospace; font-size: 10px; color: #64748b;">${s.verificationCode}</td>
        </tr>
      `).join('');

      const manifestHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Departmental Clearance Pass Manifest — ${signoffData.departmentName}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 18px; text-transform: uppercase; margin: 0; font-family: Georgia, serif; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; border-bottom: 2px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${signoffData.institutionName}</h1>
    <h2>${signoffData.departmentName} — Official Clearance Master Manifest</h2>
    <div>Session: ${signoffData.academicSession} • Semester: ${signoffData.semester} • Date: ${new Date().toLocaleDateString('en-GB')}</div>
    <div style="margin-top: 8px; font-weight: bold;">Total Candidates Audited: ${filteredStudents.length} (Eligible: ${summary.eligible}, Ineligible: ${summary.ineligible}, Pending Review: ${summary.pending})</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Matric Number</th>
        <th>Candidate Name</th>
        <th>Programme</th>
        <th style="text-align: center;">Enrollment</th>
        <th style="text-align: center;">Attendance %</th>
        <th style="text-align: right;">Status</th>
        <th>Security Code</th>
      </tr>
    </thead>
    <tbody>
      ${manifestRows}
    </tbody>
  </table>
</body>
</html>`;

      zip.file('Clearance_Summary_Manifest.html', manifestHtml);

      setZipProgressText('Compressing ZIP archive package...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Trigger automatic browser download
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast.success(
        'ZIP Archive Generated',
        `Successfully packaged ${filteredStudents.length} official clearance passes into ${zipFilename}.`
      );
    } catch (err) {
      console.error('ZIP generation error:', err);
      toast.error('Failed to create ZIP export', 'An error occurred during file packaging.');
    } finally {
      setIsExportingZip(false);
      setZipProgressText('');
    }
  };

  // Table Columns
  const columns: DataTableColumn<DepartmentalStudentEligibility>[] = [
    {
      key: 'student',
      header: 'Student Identification',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div>
          <span className="font-semibold text-xs text-foreground block">{s.fullName}</span>
          <span className="font-mono text-[11px] text-muted-foreground mt-0.5 block">{s.matricNumber}</span>
        </div>
      ),
    },
    {
      key: 'programme',
      header: 'Programme & Level',
      render: (s) => (
        <div>
          <span className="text-xs text-foreground font-medium block truncate max-w-[180px]">{s.programme}</span>
          <span className="text-[11px] text-muted-foreground font-mono block">{s.level} Level</span>
        </div>
      ),
    },
    {
      key: 'courses',
      header: 'Registered Courses',
      render: (s) => (
        <div className="text-xs">
          <span className="font-semibold text-foreground font-mono">{s.totalRegisteredCourses} Courses</span>
          <span className="text-muted-foreground block text-[11px]">{s.totalCreditUnits} Credit Units</span>
        </div>
      ),
    },
    {
      key: 'attendance',
      header: 'Overall Attendance',
      sortable: true,
      sortFn: (a, b) => a.overallAttendanceRate - b.overallAttendanceRate,
      render: (s) => {
        const isEligible = s.overallStatus === 'Eligible';
        const isPending = s.overallStatus === 'Pending Review';
        const barColor = isEligible
          ? 'bg-emerald-500'
          : isPending
          ? 'bg-amber-500'
          : 'bg-rose-500';

        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden flex-shrink-0">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.min(100, s.overallAttendanceRate)}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-foreground">
              {s.overallAttendanceRate}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Clearance Status',
      sortable: true,
      sortFn: (a, b) => a.overallStatus.localeCompare(b.overallStatus),
      render: (s) => {
        if (s.overallStatus === 'Eligible') {
          return (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Eligible
            </Badge>
          );
        }
        if (s.overallStatus === 'Pending Review') {
          return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Pending Review
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 gap-1 text-xs">
            <XCircle className="h-3 w-3" />
            Ineligible
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Examination Pass',
      render: (s) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleViewPass(s)}
          className="gap-1.5 text-xs h-7 px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold"
          title="Open printable examination clearance pass"
        >
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          View / Print Pass
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Level Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border bg-white rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Departmental Candidates</span>
            <GraduationCap className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1 font-mono">{summary.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Audited for Exam Admittance</p>
        </div>

        <div className="border border-border bg-white rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 font-semibold">Cleared (Eligible)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
            {summary.eligible} <span className="text-xs font-medium text-emerald-600">({summary.eligibleRate}%)</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Satisfies statutory ≥ 75% rule</p>
        </div>

        <div className="border border-border bg-white rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 font-semibold">Pending HOD Review</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1 font-mono">{summary.pending}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Borderline attendance (68-74%)</p>
        </div>

        <div className="border border-border bg-white rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-700 font-semibold">Ineligible (Barred)</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-1 font-mono">{summary.ineligible}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Deficient attendance (&lt; 68%)</p>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidate by name or matric..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          {/* Department Filter (Super Admin ONLY) */}
          {isSuperAdmin && (
            <div className="w-[190px]">
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-9 text-xs">
                  <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Level Filter */}
          <div className="w-[130px]">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="100">100 Level</SelectItem>
                <SelectItem value="200">200 Level</SelectItem>
                <SelectItem value="300">300 Level</SelectItem>
                <SelectItem value="400">400 Level</SelectItem>
                <SelectItem value="500">500 Level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clearance Status Filter */}
          <div className="w-[150px]">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Eligible">Eligible Only</SelectItem>
                <SelectItem value="Pending Review">Pending Review</SelectItem>
                <SelectItem value="Ineligible">Ineligible Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Top-Level Bulk Export Action */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDownloadAllZip}
            disabled={isExportingZip || filteredStudents.length === 0}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold h-9 shadow-sm"
          >
            {isExportingZip ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting ZIP...</span>
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" />
                <span>Download All Departmental Passes (ZIP)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress banner during ZIP compilation */}
      {isExportingZip && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-center gap-2 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="font-medium">{zipProgressText}</span>
        </div>
      )}

      {/* Departmental Eligibility Table */}
      <div className="bg-white border border-border rounded-lg shadow-sm">
        <DataTable
          columns={columns}
          data={filteredStudents}
          keyField="id"
          pageSize={25}
          emptyMessage="No students match the current departmental clearance filters."
          onRowClick={(row) => handleViewPass(row)}
        />
      </div>

      {/* Single Printable Examination Clearance Pass Modal */}
      <ClearancePassModal
        student={selectedStudentForPass}
        open={isPassModalOpen}
        onOpenChange={setIsPassModalOpen}
      />
    </div>
  );
}

