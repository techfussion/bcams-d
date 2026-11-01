/**
 * Student Departmental Examination Clearance Pass Modal & HTML Generator
 * 
 * Provides an exact A4 printable clearance pass with:
 * - Official Institutional Header
 * - Student Metadata Grid with Photo box
 * - Boxed Statutory Attestation Statement
 * - Course Attendance Breakdown Table
 * - HOD Sign-off Footer with live uploaded/SVG signature and departmental stamp
 * - Helper function to generate standalone HTML files for ZIP packaging
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHodSignoffData, type HodSignoffData } from '@/lib/hod-signature-store';
import {
  Printer,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  QrCode,
  FileText,
  User,
} from 'lucide-react';

export interface CourseAttendanceSummary {
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  totalClasses: number;
  classesAttended: number;
  attendanceRate: number;
  status: 'CLEARED' | 'DEFICIENT';
}

export interface DepartmentalStudentEligibility {
  id: string;
  studentId: string;
  fullName: string;
  matricNumber: string;
  departmentId: string;
  departmentName: string;
  facultyName: string;
  programme: string;
  level: number;
  totalRegisteredCourses: number;
  totalCreditUnits: number;
  overallAttendanceRate: number;
  overallStatus: 'Eligible' | 'Ineligible' | 'Pending Review';
  verificationCode: string;
  courses: CourseAttendanceSummary[];
}

interface ClearancePassModalProps {
  student: DepartmentalStudentEligibility | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClearancePassModal({
  student,
  open,
  onOpenChange,
}: ClearancePassModalProps) {
  const [signoffData, setSignoffData] = useState<HodSignoffData>(getHodSignoffData);

  useEffect(() => {
    // Refresh sign-off credentials whenever modal opens or settings change
    if (open) {
      setSignoffData(getHodSignoffData());
    }

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HodSignoffData>;
      if (customEvent.detail) {
        setSignoffData(customEvent.detail);
      }
    };
    window.addEventListener('bcams:hod-signoff-updated', handleUpdate);
    return () => window.removeEventListener('bcams:hod-signoff-updated', handleUpdate);
  }, [open]);

  if (!student) return null;

  const handlePrint = () => {
    window.print();
  };

  const isEligible = student.overallStatus === 'Eligible';
  const isPending = student.overallStatus === 'Pending Review';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-slate-900 border-border">
        {/* Modal Controls Header (Hidden on print) */}
        <div className="p-4 px-6 border-b border-border bg-slate-50 flex items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold text-slate-900">
                Official Examination Clearance Pass
              </DialogTitle>
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${isEligible
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : isPending
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}
              >
                {student.overallStatus} ({student.overallAttendanceRate}%)
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              A4 portrait layout formatted for statutory examination verification and Hall Warden admittance.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs font-semibold shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print Pass (A4)
            </Button>
          </div>
        </div>

        {/* A4 Document Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          <div className="w-full max-w-[210mm] bg-white border border-slate-300 shadow-lg p-8 sm:p-10 space-y-6 printable-clearance-pass text-slate-900">
            {/* 1. Official Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-serif font-black text-lg">
                  B
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-950 font-serif">
                    {signoffData.institutionName || 'FAMSAS COLLEGE OF HEALTH'}
                  </h1>
                </div>
              </div>

              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-700">
                {signoffData.facultyName || 'COLLEGE OF NATURAL & APPLIED SCIENCES'}
              </h2>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {signoffData.departmentName || 'DEPARTMENT OF COMPUTER SCIENCE'}
              </h3>

              <div className="mt-3 inline-block bg-slate-900 text-white text-xs font-bold px-4 py-1.5 uppercase tracking-widest rounded-sm shadow-sm">
                OFFICIAL EXAMINATION CLEARANCE PASS
              </div>

              <div className="text-[11px] font-mono font-medium text-slate-500 mt-1.5">
                {signoffData.academicSession || '2026/2027 Academic Session'} • {signoffData.semester || 'First Semester'}
              </div>
            </div>

            {/* 2. Student Metadata Grid */}
            <div className="border border-slate-300 rounded p-4 grid grid-cols-12 gap-4 bg-slate-50/50 items-center">
              {/* Photo Box */}
              <div className="col-span-12 sm:col-span-3 flex flex-col items-center justify-center">
                <div className="w-24 h-28 border-2 border-dashed border-slate-400 bg-white rounded flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <User className="h-10 w-10 text-slate-300 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-500 leading-tight">Student Photo Affixed</span>
                </div>
              </div>

              {/* Data Fields */}
              <div className="col-span-12 sm:col-span-9 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Full Name of Candidate</span>
                  <span className="text-sm font-bold text-slate-900 block">{student.fullName}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Matriculation Number</span>
                  <span className="font-mono text-sm font-bold text-slate-900 block">{student.matricNumber}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Academic Programme</span>
                  <span className="font-semibold text-slate-800 block">{student.programme}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Academic Level</span>
                  <span className="font-bold text-slate-800 font-mono block">{student.level} Level</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Total Registered Courses</span>
                  <span className="font-medium text-slate-800 block">{student.totalRegisteredCourses} Courses ({student.totalCreditUnits} Credit Units)</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Overall Biometric Attendance</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-sm font-bold text-slate-900">{student.overallAttendanceRate}%</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-2 py-0 uppercase ${isEligible
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                          : isPending
                            ? 'bg-amber-100 text-amber-800 border-amber-400'
                            : 'bg-rose-100 text-rose-800 border-rose-400'
                        }`}
                    >
                      {student.overallStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Boxed Attestation Statement */}
            <div className="border-2 border-slate-800 rounded p-3.5 bg-slate-50/80 text-xs leading-relaxed text-slate-900 font-serif">
              <p className="font-bold uppercase tracking-wide text-[11px] font-sans text-slate-950 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                Statutory Examination Attendance Attestation
              </p>
              <p className="text-justify text-[11px] text-slate-800">
                This is to certify that the candidate named above has undergone biometric attendance verification in accordance with University Academic Regulations. Having satisfied the statutory <strong>minimum 75% class attendance requirement</strong> in the certified courses tabulated below, this candidate is hereby officially cleared to sit for the semester examinations.
              </p>
            </div>

            {/* 4. Course Attendance Breakdown Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Certified Course Breakdown & Eligibility
              </h4>
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="py-2 px-3">Course Code</th>
                      <th className="py-2 px-3">Course Title</th>
                      <th className="py-2 px-3 text-center">CU</th>
                      <th className="py-2 px-3 text-center">Classes Held</th>
                      <th className="py-2 px-3 text-center">Attended</th>
                      <th className="py-2 px-3 text-center">Attendance %</th>
                      <th className="py-2 px-3 text-right">Clearance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {student.courses.map((c) => {
                      const isCourseCleared = c.status === 'CLEARED';
                      return (
                        <tr key={c.courseCode} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{c.courseCode}</td>
                          <td className="py-2 px-3 text-slate-800">{c.courseTitle}</td>
                          <td className="py-2 px-3 font-mono text-center text-slate-700">{c.creditUnits}</td>
                          <td className="py-2 px-3 font-mono text-center text-slate-700">{c.totalClasses}</td>
                          <td className="py-2 px-3 font-mono text-center font-semibold text-slate-900">{c.classesAttended}</td>
                          <td className="py-2 px-3 font-mono text-center font-bold">
                            <span className={c.attendanceRate >= 75 ? 'text-emerald-700' : 'text-rose-700'}>
                              {c.attendanceRate}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`font-mono text-[10px] font-black px-2 py-0.5 rounded border ${isCourseCleared
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                      <td colSpan={2} className="py-2 px-3 text-right text-[11px] uppercase tracking-wider">
                        Cumulative Total / Mean Rate:
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{student.totalCreditUnits}</td>
                      <td colSpan={2} className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-center font-mono text-sm font-black text-slate-950">
                        {student.overallAttendanceRate}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                        {student.overallStatus.toUpperCase()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 5. Validation & Sign-Off Section (Footer) */}
            <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-12 gap-4 items-end relative">
              {/* QR Code & Verification ID */}
              <div className="col-span-12 sm:col-span-5 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-14 h-14 bg-slate-100 border border-slate-300 p-1 rounded flex items-center justify-center">
                    {/* Visual QR Code Representation */}
                    <div className="w-12 h-12 bg-white flex flex-col justify-between p-0.5 border border-slate-400">
                      <div className="flex justify-between">
                        <div className="w-3 h-3 bg-black"></div>
                        <div className="w-3 h-3 bg-black"></div>
                      </div>
                      <div className="flex justify-center items-center font-mono text-[7px] font-black text-slate-600">
                        BCAMS
                      </div>
                      <div className="flex justify-between">
                        <div className="w-3 h-3 bg-black"></div>
                        <div className="w-2 h-2 bg-black"></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Security Verification Code</span>
                    <span className="font-mono text-xs font-bold text-slate-900 block">{student.verificationCode}</span>
                    <span className="text-[10px] text-slate-500 block">
                      Date Issued: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 font-sans leading-tight mt-1">
                  Tampering or presentation by an unauthorized individual invalidates this clearance pass and attracts disciplinary prosecution.
                </p>
              </div>

              {/* HOD Endorsement Signature & Official Stamp Watermark */}
              <div className="col-span-12 sm:col-span-7 flex flex-col items-end relative">
                {/* Departmental Stamp Overlay */}
                <div className="absolute right-12 -top-10 w-28 h-28 pointer-events-none opacity-80 select-none z-10">
                  <img
                    src={signoffData.stampImage}
                    alt="Official Departmental Stamp"
                    className="w-full h-full object-contain filter drop-shadow-sm"
                  />
                </div>

                {/* Active Signature Graphic */}
                <div className="relative z-0 h-16 w-52 flex items-center justify-end pr-2">
                  <img
                    src={signoffData.signatureImage}
                    alt="HOD Signature"
                    className="max-h-16 max-w-full object-contain filter contrast-125"
                  />
                </div>

                <div className="border-t border-slate-900 pt-1 text-right w-56">
                  <p className="text-xs font-bold text-slate-950 tracking-wide">{signoffData.hodName || 'Dr. A. B. Adeleke, Ph.D.'}</p>
                  <p className="text-[11px] font-semibold text-slate-700">{signoffData.hodTitle || 'Head of Department'}</p>
                  <p className="text-[10px] text-slate-500">{signoffData.departmentName || 'Department of Computer Science'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generates standalone, self-contained HTML document for a student clearance pass
 * Suitable for inclusion into the bulk ZIP package.
 */
export function generatePassHtml(student: DepartmentalStudentEligibility, signoff: HodSignoffData): string {
  const isEligible = student.overallStatus === 'Eligible';
  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const rows = student.courses.map((c) => {
    const isCourseCleared = c.status === 'CLEARED';
    return `
      <tr>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${c.courseCode}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${c.courseTitle}</td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${c.creditUnits}</td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${c.totalClasses}</td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${c.classesAttended}</td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold; color: ${c.attendanceRate >= 75 ? '#047857' : '#b91c1c'}; border-bottom: 1px solid #e2e8f0;">${c.attendanceRate}%</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">
          <span style="font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px; background: ${isCourseCleared ? '#ecfdf5' : '#fff1f2'}; color: ${isCourseCleared ? '#065f46' : '#9f1239'}; border: 1px solid ${isCourseCleared ? '#a7f3d0' : '#fecdd3'};">
            ${c.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Clearance Pass — ${student.matricNumber} — ${student.fullName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 10px;
    }
    .pass-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      padding: 24px;
      box-sizing: border-box;
      background: #ffffff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .inst-title {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0;
      font-family: Georgia, serif;
    }
    .faculty-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #334155;
      margin: 2px 0;
    }
    .pass-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 14px;
      letter-spacing: 1px;
      margin-top: 8px;
      border-radius: 2px;
    }
    .session-line {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      font-family: monospace;
    }
    .grid {
      display: flex;
      gap: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 12px;
      background: #f8fafc;
      margin-bottom: 16px;
    }
    .photo-box {
      width: 90px;
      height: 110px;
      border: 2px dashed #94a3b8;
      background: #ffffff;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8.5px;
      font-weight: bold;
      color: #64748b;
      box-sizing: border-box;
      padding: 4px;
    }
    .meta-fields {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 11px;
    }
    .meta-label {
      font-size: 9.5px;
      color: #64748b;
      font-weight: 600;
      display: block;
    }
    .meta-value {
      font-weight: 700;
      color: #0f172a;
    }
    .attestation {
      border: 2px solid #0f172a;
      padding: 10px 14px;
      border-radius: 4px;
      background: #fdfefe;
      font-size: 10.5px;
      line-height: 1.45;
      margin-bottom: 16px;
    }
    .attestation-heading {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      padding: 6px 8px;
      font-weight: 700;
      border-bottom: 2px solid #cbd5e1;
      text-align: left;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 2px solid #0f172a;
      padding-top: 12px;
      position: relative;
    }
    .security-box {
      font-size: 9.5px;
      color: #475569;
    }
    .signoff-box {
      text-align: right;
      width: 240px;
      position: relative;
    }
    .stamp-overlay {
      position: absolute;
      right: 20px;
      bottom: 10px;
      width: 110px;
      height: 110px;
      opacity: 0.85;
      pointer-events: none;
    }
    .sig-img {
      max-height: 60px;
      max-width: 200px;
      object-fit: contain;
    }
    @media print {
      body { padding: 0; background: transparent; }
      .pass-container { border: none; padding: 0; width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="pass-container">
    <div class="header">
      <h1 class="inst-title">${signoff.institutionName}</h1>
      <div class="faculty-title">${signoff.facultyName}</div>
      <div class="faculty-title" style="font-weight: 600;">${signoff.departmentName}</div>
      <div class="pass-badge">OFFICIAL EXAMINATION CLEARANCE PASS</div>
      <div class="session-line">${signoff.academicSession} • ${signoff.semester}</div>
    </div>

    <div class="grid">
      <div class="photo-box">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin-bottom:4px;">
          <circle cx="12" cy="7" r="4"></circle>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        </svg>
        STUDENT PHOTO AFFIXED
      </div>
      <div class="meta-fields">
        <div>
          <span class="meta-label">Full Name of Candidate</span>
          <span class="meta-value">${student.fullName}</span>
        </div>
        <div>
          <span class="meta-label">Matriculation Number</span>
          <span class="meta-value" style="font-family: monospace;">${student.matricNumber}</span>
        </div>
        <div>
          <span class="meta-label">Academic Programme</span>
          <span class="meta-value">${student.programme}</span>
        </div>
        <div>
          <span class="meta-label">Level</span>
          <span class="meta-value" style="font-family: monospace;">${student.level} Level</span>
        </div>
        <div>
          <span class="meta-label">Total Registered Courses</span>
          <span class="meta-value">${student.totalRegisteredCourses} Courses (${student.totalCreditUnits} CU)</span>
        </div>
        <div>
          <span class="meta-label">Overall Biometric Attendance</span>
          <span class="meta-value" style="font-family: monospace; font-size: 13px; color: ${isEligible ? '#047857' : '#b91c1c'};">
            ${student.overallAttendanceRate}% (${student.overallStatus.toUpperCase()})
          </span>
        </div>
      </div>
    </div>

    <div class="attestation">
      <div class="attestation-heading">Statutory Examination Attendance Attestation</div>
      This is to certify that the candidate named above has undergone biometric attendance verification in accordance with University Academic Regulations. Having satisfied the statutory <strong>minimum 75% class attendance requirement</strong> in the certified courses tabulated below, this candidate is hereby officially cleared to sit for the semester examinations.
    </div>

    <table>
      <thead>
        <tr>
          <th>Course Code</th>
          <th>Course Title</th>
          <th style="text-align: center;">CU</th>
          <th style="text-align: center;">Held</th>
          <th style="text-align: center;">Attended</th>
          <th style="text-align: center;">Attendance %</th>
          <th style="text-align: right;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
          <td colspan="2" style="padding: 6px 8px; text-align: right; text-transform: uppercase;">Cumulative Mean:</td>
          <td style="padding: 6px 8px; text-align: center; font-family: monospace;">${student.totalCreditUnits}</td>
          <td colspan="2"></td>
          <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-size: 12px; color: #0f172a;">${student.overallAttendanceRate}%</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #047857;">${student.overallStatus.toUpperCase()}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <div class="security-box">
        <div style="font-weight: bold; color: #0f172a;">Verification Code: ${student.verificationCode}</div>
        <div>Date of Issue: ${issueDate}</div>
        <div style="font-size: 8.5px; color: #94a3b8; margin-top: 3px;">BCAMS Biometric Clearance System • Tampering Invalidates Document</div>
      </div>

      <div class="signoff-box">
        <img class="stamp-overlay" src="${signoff.stampImage}" alt="Official Stamp" />
        <div style="position: relative; z-index: 1;">
          <img class="sig-img" src="${signoff.signatureImage}" alt="HOD Signature" />
        </div>
        <div style="border-top: 1px solid #0f172a; padding-top: 3px; margin-top: 2px;">
          <div style="font-weight: bold; font-size: 11px;">${signoff.hodName}</div>
          <div style="font-size: 10px; color: #475569;">${signoff.hodTitle}</div>
          <div style="font-size: 9px; color: #64748b;">${signoff.departmentName}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

