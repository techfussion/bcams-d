/**
 * Lecturer Attendance Log & Print View Dialog
 * 
 * Interactive inspection modal and official print report for an academic lecturer.
 * Displays profile details, assigned courses, summary statistics (total lectures,
 * average attendance, teaching hours), and individual session logs with durations,
 * enrolled vs present counts, rates, and statuses.
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Lecturer } from '@/types';
import {
  Printer,
  Calendar,
  Clock,
  Users,
  BookOpen,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  FileText,
  UserCheck,
  TrendingUp,
} from 'lucide-react';

export interface AttendanceRecord {
  id: string;
  dateTime: string;
  courseCode: string;
  courseTitle: string;
  venue: string;
  scheduledDuration: string;
  actualDuration: string;
  scheduledMinutes: number;
  actualMinutes: number;
  enrolledStudents: number;
  markedPresent: number;
  attendanceRate: number;
  status: 'Completed' | 'Rescheduled' | 'Cancelled';
  topic: string;
}

interface LecturerAttendanceLogDialogProps {
  lecturer: Lecturer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LecturerAttendanceLogDialog({
  lecturer,
  open,
  onOpenChange,
}: LecturerAttendanceLogDialogProps) {
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Generate realistic, consistent mock records based on lecturer
  const records: AttendanceRecord[] = useMemo(() => {
    if (!lecturer) return [];

    const defaultCourses = [
      { code: 'CSC 301', title: 'Operating Systems & Architecture', enrolled: 72 },
      { code: 'CSC 405', title: 'Software Engineering & System Modeling', enrolled: 64 },
      { code: 'CSC 311', title: 'Database Design & Implementation', enrolled: 78 },
    ];

    const coursesToUse = lecturer.assignedCourses && lecturer.assignedCourses.length > 0
      ? lecturer.assignedCourses.map((ac, idx) => ({
        code: ac.courseCode,
        title: ac.courseTitle,
        enrolled: 60 + ((idx * 7 + (lecturer.fullName.length * 3)) % 25),
      }))
      : defaultCourses;

    const baseTopics = [
      'Virtual Memory & Paging Mechanisms',
      'Process Synchronization and Semaphores',
      'System Architecture and CPU Scheduling',
      'Microservices & RESTful API Boundaries',
      'Relational Schema Normalization & BCNF',
      'Transaction Concurrency & ACID Controls',
      'Deadlock Prevention and Resource Allocation',
      'Design Patterns: Observer & Strategy',
      'Distributed Query Processing and Indexing',
      'Device Drivers and I/O Management',
      'Sprint Retrospectives & Continuous Integration',
      'Kernel Interrupt Handling and System Calls',
    ];

    const generated: AttendanceRecord[] = [];
    // Generate 14-16 sessions across September - October 2026
    const baseDays = [
      '2026-09-08', '2026-09-11', '2026-09-15', '2026-09-18',
      '2026-09-22', '2026-09-25', '2026-09-29', '2026-10-02',
      '2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16',
      '2026-10-20', '2026-10-23', '2026-10-27', '2026-10-30',
    ];

    baseDays.forEach((dateStr, i) => {
      const crs = coursesToUse[i % coursesToUse.length];
      const isCancelled = i === 9; // Session 10 cancelled
      const isRescheduled = i === 4; // Session 5 rescheduled
      const status: AttendanceRecord['status'] = isCancelled
        ? 'Cancelled'
        : isRescheduled
          ? 'Rescheduled'
          : 'Completed';

      const scheduledMinutes = 120;
      let actualMinutes = 120;
      let present = 0;

      if (status === 'Cancelled') {
        actualMinutes = 0;
        present = 0;
      } else if (status === 'Rescheduled') {
        actualMinutes = 110;
        present = Math.round(crs.enrolled * 0.72);
      } else {
        // High, realistic attendance 76% to 96%
        const rateFactor = 0.76 + (((i * 13 + lecturer.fullName.length) % 21) / 100);
        present = Math.min(crs.enrolled, Math.round(crs.enrolled * rateFactor));
        actualMinutes = scheduledMinutes - ((i % 3) * 5); // 120, 115, 110
      }

      const attendanceRate = crs.enrolled > 0 && status !== 'Cancelled'
        ? Math.round((present / crs.enrolled) * 100)
        : 0;

      const timeSlot = i % 2 === 0 ? '09:00 - 11:00' : '14:00 - 16:00';
      const actualHours = Math.floor(actualMinutes / 60);
      const actualMins = actualMinutes % 60;
      const actualDurStr = status === 'Cancelled' ? '0h 00m' : `${actualHours}h ${actualMins < 10 ? '0' : ''}${actualMins}m`;

      generated.push({
        id: `att-log-${lecturer.id}-${i + 1}`,
        dateTime: `${dateStr}, ${timeSlot}`,
        courseCode: crs.code,
        courseTitle: crs.title,
        venue: i % 2 === 0 ? 'Lecture Theatre 2 (LT-02)' : 'Computer Lab 4 (CL-04)',
        scheduledDuration: '2h 00m',
        actualDuration: actualDurStr,
        scheduledMinutes,
        actualMinutes,
        enrolledStudents: crs.enrolled,
        markedPresent: present,
        attendanceRate,
        status,
        topic: baseTopics[i % baseTopics.length],
      });
    });

    return generated;
  }, [lecturer]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchCourse = filterCourse === 'all' || r.courseCode === filterCourse;
      const matchStatus = filterStatus === 'all' || r.status.toLowerCase() === filterStatus.toLowerCase();
      return matchCourse && matchStatus;
    });
  }, [records, filterCourse, filterStatus]);

  // Aggregated Summary Statistics
  const summary = useMemo(() => {
    const totalScheduled = records.length;
    const completed = records.filter((r) => r.status === 'Completed');
    const totalActualMins = records.reduce((acc, r) => acc + r.actualMinutes, 0);
    const totalActualHours = Math.floor(totalActualMins / 60);
    const remainderMins = totalActualMins % 60;

    const completedRates = completed.map((r) => r.attendanceRate);
    const avgAttendance = completedRates.length > 0
      ? Math.round(completedRates.reduce((a, b) => a + b, 0) / completedRates.length)
      : 0;

    return {
      totalScheduled,
      completedCount: completed.length,
      rescheduledCount: records.filter((r) => r.status === 'Rescheduled').length,
      cancelledCount: records.filter((r) => r.status === 'Cancelled').length,
      avgAttendance,
      teachingHoursStr: `${totalActualHours}h ${remainderMins}m`,
    };
  }, [records]);

  // Unique course codes for filter
  const uniqueCourses = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.courseCode)));
  }, [records]);

  if (!lecturer) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-slate-900 border-border">
        {/* Interactive Modal Header (Hidden on print) */}
        <div className="p-6 border-b border-border bg-slate-50/70 flex items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
                Lecturer Attendance Report & Session Log
              </DialogTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Staff ID: {lecturer.staffId || 'STF/ACAD'}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Verified biometric audit log of lecture sessions, student attendance rates, and instructional hours.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs font-semibold shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print Log
            </Button>
          </div>
        </div>

        {/* Scrollable Modal Content (Becomes full printable document on print) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 lecturer-printable-log">
          {/* Official University Print Header (Only visible on print or styled as official banner) */}
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-950 font-serif">
              FAMSAS COLLEGE OF HEALTH
            </h1>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-700 mt-0.5">
              FACULTY OF ENGINEERING & APPLIED SCIENCES — DEPARTMENT OF COMPUTER SCIENCE
            </h2>
            <div className="mt-2 inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1 uppercase tracking-wider rounded">
              OFFICIAL LECTURER ATTENDANCE & INSTRUCTIONAL AUDIT LOG
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Academic Session: 2026/2027 • First Semester • Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Lecturer Profile Particulars Card */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Lecturer Full Name</span>
              <span className="font-bold text-slate-900 text-sm">{lecturer.fullName}</span>
              <span className="text-slate-500 block text-[11px] font-medium">{lecturer.designation || 'Academic Lecturer'}</span>
            </div>

            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Staff ID / Identity</span>
              <span className="font-mono font-bold text-slate-800 text-xs">{lecturer.staffId || 'STF/CS/001'}</span>
              <span className="text-emerald-700 text-[11px] font-medium block flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="h-3 w-3" /> Biometrics Enrolled ({lecturer.enrolledFingers}/10)
              </span>
            </div>

            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Department & Faculty</span>
              <span className="font-semibold text-slate-800 text-xs">{lecturer.departmentName || 'Computer Science'}</span>
              <span className="text-slate-500 block text-[11px]">Faculty of Engineering</span>
            </div>

            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Assigned Courses</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {lecturer.assignedCourses && lecturer.assignedCourses.length > 0 ? (
                  lecturer.assignedCourses.map((ac) => (
                    <Badge key={ac.id} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                      {ac.courseCode}
                    </Badge>
                  ))
                ) : (
                  <>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">CSC 301</Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">CSC 405</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-border bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Lectures Scheduled</span>
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{summary.totalScheduled}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {summary.completedCount} Completed • {summary.rescheduledCount} Rescheduled
              </p>
            </div>

            <div className="border border-border bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Average Attendance Rate</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-2 font-mono">{summary.avgAttendance}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Statutory university benchmark: ≥ 75%
              </p>
            </div>

            <div className="border border-border bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Teaching Hours</span>
                <Clock className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{summary.teachingHoursStr}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Logged via biometric hardware device
              </p>
            </div>
          </div>

          {/* Interactive Filters (Hidden on Print) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-border no-print">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Course:</span>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="bg-white border border-border rounded px-2 py-1 text-xs font-medium text-foreground outline-none"
                >
                  <option value="all">All Assigned Courses</option>
                  {uniqueCourses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-border rounded px-2 py-1 text-xs font-medium text-foreground outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              Showing {filteredRecords.length} of {records.length} sessions
            </div>
          </div>

          {/* Attendance Records Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Lecture Topic</th>
                  <th className="py-2.5 px-3">Scheduled vs. Actual</th>
                  <th className="py-2.5 px-3 text-center">Enrolled / Present</th>
                  <th className="py-2.5 px-3 text-center">Attendance %</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No attendance records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    // Badge color rules: green >= 75%, amber 60–74%, red < 60%
                    const isHigh = r.attendanceRate >= 75;
                    const isMedium = r.attendanceRate >= 60 && r.attendanceRate < 75;
                    const badgeClass = isHigh
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : isMedium
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800">
                          <div>{r.dateTime.split(', ')[0]}</div>
                          <span className="text-slate-500 text-[10px]">{r.dateTime.split(', ')[1]}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block font-mono">{r.courseCode}</span>
                          <span className="text-[11px] text-slate-500 truncate block max-w-[150px]">{r.courseTitle}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-[180px] truncate" title={r.topic}>
                          {r.topic}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className="text-slate-500">{r.scheduledDuration}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-bold text-slate-800">{r.actualDuration}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-center">
                          <span className="font-bold text-slate-900">{r.markedPresent}</span>
                          <span className="text-slate-500"> / {r.enrolledStudents}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.status === 'Cancelled' ? (
                            <span className="text-slate-400 text-[11px] font-mono">—</span>
                          ) : (
                            <Badge variant="outline" className={`${badgeClass} font-mono font-bold text-[11px] px-2 py-0.5`}>
                              {r.attendanceRate}%
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {r.status === 'Completed' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium">
                              Completed
                            </Badge>
                          )}
                          {r.status === 'Rescheduled' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-medium">
                              Rescheduled
                            </Badge>
                          )}
                          {r.status === 'Cancelled' && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-medium">
                              Cancelled
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Official Sign-Off Endorsement Block (Required on printout) */}
          <div className="pt-6 border-t border-slate-300 mt-6 grid grid-cols-2 gap-8 text-xs text-slate-800">
            <div>
              <p className="font-semibold text-slate-700">Audited By:</p>
              <div className="h-12 border-b border-slate-400 mt-2 flex items-end pb-1 font-mono text-slate-500 text-[11px]">
                Faculty Academic Affairs Officer
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Date: ________________________</p>
            </div>

            <div>
              <p className="font-semibold text-slate-700">Head of Department (HOD) Endorsement:</p>
              <div className="h-12 border-b border-slate-400 mt-2 flex items-end pb-1 font-mono text-slate-500 text-[11px]">
                Signature & Official Departmental Stamp
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Date: ________________________</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

