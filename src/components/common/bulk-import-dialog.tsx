import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Search,
  Loader2,
  Info,
  FileText,
  Check,
  XCircle,
} from 'lucide-react';
import { downloadCSV } from '@/domain';
import { useToast } from '@/hooks';
import type { Student, Staff, Lecturer, Department, Course } from '@/types';

export type ImportEntityType = 'student' | 'staff' | 'lecturer' | 'course';

export type RowStatus =
  | 'valid_new'
  | 'valid_update'
  | 'valid_link'
  | 'duplicate_file'
  | 'duplicate_db'
  | 'error';

export interface ParsedImportRow {
  rowNumber: number;
  identifier: string;
  name: string;
  detail: string;
  status: RowStatus;
  statusLabel: string;
  reason?: string;
  payload: any;
}

export interface ImportSummaryData {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  updatedEnrollments?: number;
  errors: Array<{ row?: number; identifier?: string; reason: string }>;
  skippedRows: Array<{ rowNumber: number; identifier: string; reason?: string }>;
}

export const COLUMN_GUIDANCE: Record<ImportEntityType, { required: string[]; optional: string[]; description: string }> = {
  course: {
    required: ['code', 'title'],
    optional: ['creditUnits (1-12)', 'level (100-900)', 'semester (1 or 2)', 'department', 'isGeneral (true/false)'],
    description: 'Course codes must be unique across the curriculum. Department must exist in the institutional registry or course must be marked General.',
  },
  student: {
    required: ['matricNumber', 'fullName'],
    optional: ['level (100-900)', 'department', 'programme', 'academicSession', 'semester (1 or 2)'],
    description: 'Matriculation numbers must be unique. Re-importing existing students with progression sessions records academic level advancement.',
  },
  staff: {
    required: ['staffId', 'fullName'],
    optional: ['designation', 'department', 'staffType (academic/non_academic)', 'email', 'phone'],
    description: 'Staff IDs must be unique across institutional records. Biometric enrollment must be conducted at physical capture stations.',
  },
  lecturer: {
    required: ['staffId', 'fullName'],
    optional: ['designation', 'department', 'email', 'phone'],
    description: 'Staff IDs must be unique. If the Staff ID matches an existing staff member, their institutional profile is linked to lecturer duties.',
  },
};

export interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ImportEntityType;
  title: string;
  description: string;
  templateFilename: string;
  sampleCSV: string;
  onImport: (validRecords: any[]) => Promise<{ importedCount: number; updatedEnrollments?: number; errors: any[] }>;
  onSuccess: () => void;
  existingData: {
    students?: Student[];
    staff?: Staff[];
    lecturers?: Lecturer[];
    departments?: Department[];
    courses?: Course[];
  };
  userRole?: string;
  userDepartmentId?: string;
  userDepartmentName?: string;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  entityType,
  title,
  description,
  templateFilename,
  sampleCSV,
  onImport,
  onSuccess,
  existingData,
  userRole,
  userDepartmentId,
  userDepartmentName,
}: BulkImportDialogProps) {
  const toast = useToast();
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedImportRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [securityViolation, setSecurityViolation] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'duplicates' | 'errors'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleReset = () => {
    setFileName('');
    setPreviewRows([]);
    setIsParsing(false);
    setIsExecuting(false);
    setSecurityViolation(null);
    setFileError(null);
    setImportSummary(null);
    setFilterTab('all');
    setSearchQuery('');
  };

  const handleDownloadTemplate = () => {
    downloadCSV(sampleCSV, templateFilename);
    toast.success(`Downloaded template: ${templateFilename}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);
    setSecurityViolation(null);
    setFileError(null);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseAndValidate(text);
      setIsParsing(false);
    };
    reader.onerror = () => {
      setFileError('Failed to read the selected file. Please ensure it is a valid CSV spreadsheet.');
      toast.error('Failed to read selected file');
      setIsParsing(false);
    };
    reader.readAsText(file);
    // Reset file input value so re-selecting same file triggers change
    e.target.value = '';
  };

  const parseAndValidate = (csvText: string) => {
    setFileError(null);
    setSecurityViolation(null);

    const rawLines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length < 2) {
      setFileError('The uploaded CSV file is empty or missing data rows.');
      toast.error('The uploaded CSV file is empty or missing data rows');
      setPreviewRows([]);
      return;
    }

    const headerLine = rawLines[0];
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().replace(/['"]/g, ''));

    // Critical Security Rule: Reject any attempt to upload raw biometric templates in CSV (Section 15)
    const biometricHeaderPatterns = ['biometric', 'template', 'fingerprint', 'minutiae', 'fmd', 'iso_template'];
    const forbiddenHeader = headers.find(h => biometricHeaderPatterns.some(p => h.includes(p)));
    if (forbiddenHeader) {
      const violationMsg = `Security Violation: Column "${forbiddenHeader}" contains biometric template references. Raw biometric templates are strictly prohibited in spreadsheet imports. Biometric enrollment must be conducted at trusted biometric capture stations.`;
      setSecurityViolation(violationMsg);
      setPreviewRows([]);
      toast.error('Security Violation: Raw biometric templates prohibited in imports');
      return;
    }

    // Header index lookups
    const matricIdx = headers.findIndex(h => h.includes('matric') || h.includes('student_id') || h.includes('studentid'));
    const staffIdIdx = headers.findIndex(h => h === 'staffid' || h === 'staff_id' || h.includes('staff'));
    const nameIdx = headers.findIndex(h => h.includes('name') || h === 'fullname');
    const levelIdx = headers.findIndex(h => h.includes('level') || h === 'lvl');
    const deptIdx = headers.findIndex(h => h.includes('dept') || h.includes('department'));
    const progIdx = headers.findIndex(h => h.includes('prog') || h.includes('programme'));
    const sessionIdx = headers.findIndex(h => h.includes('session'));
    const semesterIdx = headers.findIndex(h => h.includes('semester'));
    const designationIdx = headers.findIndex(h => h.includes('designation') || h.includes('title') || h.includes('rank'));
    const staffTypeIdx = headers.findIndex(h => h.includes('type') || h.includes('classification'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel') || h.includes('mobile'));
    const codeIdx = headers.findIndex(h => h === 'code' || h === 'coursecode' || h === 'course_code');
    const titleIdx = headers.findIndex(h => h === 'title' || h === 'coursetitle' || h === 'course_title' || h.includes('title'));
    const unitsIdx = headers.findIndex(h => h === 'units' || h === 'creditunits' || h === 'credit_units' || h === 'cu');
    const isGeneralIdx = headers.findIndex(h => h === 'isgeneral' || h === 'is_general' || h === 'general' || h === 'gst');

    const rows: ParsedImportRow[] = [];
    const seenIdentifiersInFile = new Map<string, number>();

    const existingStudents = existingData.students || [];
    const existingStaff = existingData.staff || [];
    const existingLecturers = existingData.lecturers || [];
    const existingCourses = existingData.courses || [];
    const departments = existingData.departments || [];

    const isHOD = userRole === 'hod';
    const hodDeptId = userDepartmentId;

    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;
      const cols = parseCSVLine(line);
      const rowNumber = i + 1; // 1-based line number (header is row 1)

      if (entityType === 'student') {
        const matric = matricIdx >= 0 ? cols[matricIdx] : cols[0] || '';
        const name = nameIdx >= 0 ? cols[nameIdx] : cols[1] || '';
        const lvl = levelIdx >= 0 ? Number(cols[levelIdx]) : 100;
        const deptVal = deptIdx >= 0 ? cols[deptIdx] : '';
        const prog = progIdx >= 0 ? cols[progIdx] : 'B.Sc. Computer Science';
        const session = sessionIdx >= 0 ? cols[sessionIdx] : '2026/2027';
        const semester = semesterIdx >= 0 ? Number(cols[semesterIdx]) : 1;

        const cleanMatric = matric.trim();
        const cleanName = name.trim();
        const normMatric = cleanMatric.toUpperCase();

        // 1. Missing required fields check
        if (!cleanMatric || !cleanName) {
          rows.push({
            rowNumber,
            identifier: cleanMatric || 'MISSING',
            name: cleanName || 'MISSING',
            detail: `Level ${lvl} • ${prog}`,
            status: 'error',
            statusLabel: 'Invalid Row',
            reason: 'Missing Matriculation Number or Full Name',
            payload: null,
          });
          continue;
        }

        // 2. Department scoping check (HOD scope enforcement)
        let resolvedDeptId = 'dept-cs';
        let resolvedDeptName = 'Computer Science';
        if (deptVal) {
          const matchDept = departments.find(d =>
            d.id.toLowerCase() === deptVal.toLowerCase() ||
            d.code.toLowerCase() === deptVal.toLowerCase() ||
            d.name.toLowerCase() === deptVal.toLowerCase()
          );
          if (matchDept) {
            resolvedDeptId = matchDept.id;
            resolvedDeptName = matchDept.name;
          }
        }
        if (isHOD && hodDeptId) {
          resolvedDeptId = hodDeptId;
          resolvedDeptName = userDepartmentName || 'Department';
          if (deptVal) {
            const matchDept = departments.find(d =>
              d.id.toLowerCase() === deptVal.toLowerCase() ||
              d.code.toLowerCase() === deptVal.toLowerCase()
            );
            if (matchDept && matchDept.id !== hodDeptId) {
              rows.push({
                rowNumber,
                identifier: cleanMatric,
                name: cleanName,
                detail: `Level ${lvl} • ${deptVal}`,
                status: 'error',
                statusLabel: 'Scope Mismatch',
                reason: `Department (${deptVal}) is outside authorized HOD scope (${userDepartmentName})`,
                payload: null,
              });
              continue;
            }
          }
        }

        // 3. Duplicate within uploaded file check
        if (seenIdentifiersInFile.has(normMatric)) {
          const firstRow = seenIdentifiersInFile.get(normMatric);
          rows.push({
            rowNumber,
            identifier: cleanMatric,
            name: cleanName,
            detail: `Level ${lvl} • ${resolvedDeptName}`,
            status: 'duplicate_file',
            statusLabel: 'File Duplicate',
            reason: `Matriculation Number appears more than once in uploaded file (first seen on Row ${firstRow})`,
            payload: null,
          });
          continue;
        }
        seenIdentifiersInFile.set(normMatric, rowNumber);

        // 4. Existing record in BCAMS database check
        const existingStudent = existingStudents.find(
          s => s.matricNumber.trim().toUpperCase() === normMatric
        );

        if (existingStudent) {
          rows.push({
            rowNumber,
            identifier: cleanMatric,
            name: cleanName,
            detail: `Level ${lvl} (Progression Update) • ${existingStudent.departmentName}`,
            status: 'valid_update',
            statusLabel: 'Level Progression',
            reason: `Existing Student: Updates academic progression to Level ${lvl} without corrupting historical records`,
            payload: {
              matricNumber: cleanMatric,
              fullName: cleanName,
              level: lvl,
              departmentId: existingStudent.departmentId,
              departmentName: existingStudent.departmentName,
              programme: prog,
              academicSession: session,
              semester,
            },
          });
        } else {
          rows.push({
            rowNumber,
            identifier: cleanMatric,
            name: cleanName,
            detail: `Level ${lvl} • ${resolvedDeptName}`,
            status: 'valid_new',
            statusLabel: 'New Student',
            reason: 'Valid new student registration (biometric enrollment pending)',
            payload: {
              matricNumber: cleanMatric,
              fullName: cleanName,
              level: lvl,
              departmentId: resolvedDeptId,
              departmentName: resolvedDeptName,
              programme: prog,
              academicSession: session,
              semester,
            },
          });
        }
      } else if (entityType === 'staff') {
        const staffId = staffIdIdx >= 0 ? cols[staffIdIdx] : cols[0] || '';
        const name = nameIdx >= 0 ? cols[nameIdx] : cols[1] || '';
        const designation = designationIdx >= 0 ? cols[designationIdx] : 'Staff Member';
        const staffTypeVal = staffTypeIdx >= 0 ? cols[staffTypeIdx].toLowerCase() : 'non_academic';
        const deptVal = deptIdx >= 0 ? cols[deptIdx] : '';
        const email = emailIdx >= 0 ? cols[emailIdx].trim() : '';
        const phone = phoneIdx >= 0 ? cols[phoneIdx].trim() : '';

        const cleanStaffId = staffId.trim();
        const cleanName = name.trim();
        const normStaffId = cleanStaffId.toLowerCase();
        const isAcademic = staffTypeVal.includes('acad');

        // 1. Missing required fields check
        if (!cleanStaffId || !cleanName) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId || 'MISSING',
            name: cleanName || 'MISSING',
            detail: designation,
            status: 'error',
            statusLabel: 'Invalid Row',
            reason: 'Missing Staff ID or Full Name',
            payload: null,
          });
          continue;
        }

        // 2. Email format validation (if provided)
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${email}`,
            status: 'error',
            statusLabel: 'Invalid Email',
            reason: `Invalid email address format: "${email}"`,
            payload: null,
          });
          continue;
        }

        // 3. Department scoping check
        let resolvedDeptId = 'dept-cs';
        let resolvedDeptName = 'Computer Science';
        if (deptVal) {
          const matchDept = departments.find(d =>
            d.id.toLowerCase() === deptVal.toLowerCase() ||
            d.code.toLowerCase() === deptVal.toLowerCase() ||
            d.name.toLowerCase() === deptVal.toLowerCase()
          );
          if (matchDept) {
            resolvedDeptId = matchDept.id;
            resolvedDeptName = matchDept.name;
          }
        }
        if (isHOD && hodDeptId) {
          resolvedDeptId = hodDeptId;
          resolvedDeptName = userDepartmentName || 'Department';
          if (deptVal) {
            const matchDept = departments.find(d =>
              d.id.toLowerCase() === deptVal.toLowerCase() ||
              d.code.toLowerCase() === deptVal.toLowerCase()
            );
            if (matchDept && matchDept.id !== hodDeptId) {
              rows.push({
                rowNumber,
                identifier: cleanStaffId,
                name: cleanName,
                detail: `${designation} • ${deptVal}`,
                status: 'error',
                statusLabel: 'Scope Mismatch',
                reason: `Department (${deptVal}) is outside authorized HOD scope (${userDepartmentName})`,
                payload: null,
              });
              continue;
            }
          }
        }

        // 4. Duplicate within uploaded file check
        if (seenIdentifiersInFile.has(normStaffId)) {
          const firstRow = seenIdentifiersInFile.get(normStaffId);
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${resolvedDeptName}`,
            status: 'duplicate_file',
            statusLabel: 'File Duplicate',
            reason: `Staff ID appears more than once in uploaded file (first seen on Row ${firstRow})`,
            payload: null,
          });
          continue;
        }
        seenIdentifiersInFile.set(normStaffId, rowNumber);

        // 5. Existing record in BCAMS database check
        const existingStaffMember = existingStaff.find(
          s => s.staffId.trim().toLowerCase() === normStaffId
        );

        if (existingStaffMember) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${existingStaffMember.departmentName}`,
            status: 'duplicate_db',
            statusLabel: 'Already Registered',
            reason: `Staff ID ${cleanStaffId} already exists in institutional registry (${existingStaffMember.fullName})`,
            payload: null,
          });
        } else {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${isAcademic ? 'Academic' : 'Non-Academic'} • ${resolvedDeptName}`,
            status: 'valid_new',
            statusLabel: 'New Staff',
            reason: 'Valid new staff member (biometric enrollment pending)',
            payload: {
              staffId: cleanStaffId,
              fullName: cleanName,
              designation,
              staffType: isAcademic ? 'academic' : 'non_academic',
              isLecturer: isAcademic,
              departmentId: resolvedDeptId,
              departmentName: resolvedDeptName,
              contactEmail: email || undefined,
              contactPhone: phone || undefined,
            },
          });
        }
      } else if (entityType === 'lecturer') {
        const staffId = staffIdIdx >= 0 ? cols[staffIdIdx] : cols[0] || '';
        const name = nameIdx >= 0 ? cols[nameIdx] : cols[1] || '';
        const designation = designationIdx >= 0 ? cols[designationIdx] : 'Lecturer';
        const deptVal = deptIdx >= 0 ? cols[deptIdx] : '';
        const email = emailIdx >= 0 ? cols[emailIdx].trim() : '';
        const phone = phoneIdx >= 0 ? cols[phoneIdx].trim() : '';

        const cleanStaffId = staffId.trim();
        const cleanName = name.trim();
        const normStaffId = cleanStaffId.toLowerCase();

        // 1. Missing required fields check
        if (!cleanStaffId || !cleanName) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId || 'MISSING',
            name: cleanName || 'MISSING',
            detail: designation,
            status: 'error',
            statusLabel: 'Invalid Row',
            reason: 'Missing Staff ID or Full Name',
            payload: null,
          });
          continue;
        }

        // 2. Email format validation
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${email}`,
            status: 'error',
            statusLabel: 'Invalid Email',
            reason: `Invalid email address format: "${email}"`,
            payload: null,
          });
          continue;
        }

        // 3. Department scoping check
        let resolvedDeptId = 'dept-cs';
        let resolvedDeptName = 'Computer Science';
        if (deptVal) {
          const matchDept = departments.find(d =>
            d.id.toLowerCase() === deptVal.toLowerCase() ||
            d.code.toLowerCase() === deptVal.toLowerCase() ||
            d.name.toLowerCase() === deptVal.toLowerCase()
          );
          if (matchDept) {
            resolvedDeptId = matchDept.id;
            resolvedDeptName = matchDept.name;
          }
        }
        if (isHOD && hodDeptId) {
          resolvedDeptId = hodDeptId;
          resolvedDeptName = userDepartmentName || 'Department';
          if (deptVal) {
            const matchDept = departments.find(d =>
              d.id.toLowerCase() === deptVal.toLowerCase() ||
              d.code.toLowerCase() === deptVal.toLowerCase()
            );
            if (matchDept && matchDept.id !== hodDeptId) {
              rows.push({
                rowNumber,
                identifier: cleanStaffId,
                name: cleanName,
                detail: `${designation} • ${deptVal}`,
                status: 'error',
                statusLabel: 'Scope Mismatch',
                reason: `Department (${deptVal}) is outside authorized HOD scope (${userDepartmentName})`,
                payload: null,
              });
              continue;
            }
          }
        }

        // 4. Duplicate within uploaded file check
        if (seenIdentifiersInFile.has(normStaffId)) {
          const firstRow = seenIdentifiersInFile.get(normStaffId);
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${resolvedDeptName}`,
            status: 'duplicate_file',
            statusLabel: 'File Duplicate',
            reason: `Staff ID appears more than once in uploaded file (first seen on Row ${firstRow})`,
            payload: null,
          });
          continue;
        }
        seenIdentifiersInFile.set(normStaffId, rowNumber);

        // 5. Existing Lecturer check
        const existingLecturer = existingLecturers.find(
          l => l.staffId.trim().toLowerCase() === normStaffId
        );

        if (existingLecturer) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${existingLecturer.departmentName}`,
            status: 'duplicate_db',
            statusLabel: 'Already Lecturer',
            reason: `Lecturer with Staff ID ${cleanStaffId} already registered in lecturer directory`,
            payload: null,
          });
          continue;
        }

        // 6. Existing Staff member check -> Preserves Person -> Staff -> Lecturer identity
        const existingStaffMember = existingStaff.find(
          s => s.staffId.trim().toLowerCase() === normStaffId
        );

        if (existingStaffMember) {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • Links to ${existingStaffMember.departmentName} Staff`,
            status: 'valid_link',
            statusLabel: 'Link Staff Identity',
            reason: `Reuses existing Staff identity (${existingStaffMember.fullName}) without creating duplicate Person`,
            payload: {
              staffId: cleanStaffId,
              fullName: cleanName || existingStaffMember.fullName,
              designation: designation || existingStaffMember.designation,
              departmentId: existingStaffMember.departmentId,
              departmentName: existingStaffMember.departmentName,
              contactEmail: email || existingStaffMember.contactEmail,
              contactPhone: phone || existingStaffMember.contactPhone,
            },
          });
        } else {
          rows.push({
            rowNumber,
            identifier: cleanStaffId,
            name: cleanName,
            detail: `${designation} • ${resolvedDeptName}`,
            status: 'valid_new',
            statusLabel: 'New Staff + Lecturer',
            reason: 'Creates underlying Staff identity and links Lecturer role (biometric enrollment pending)',
            payload: {
              staffId: cleanStaffId,
              fullName: cleanName,
              designation,
              departmentId: resolvedDeptId,
              departmentName: resolvedDeptName,
              contactEmail: email || undefined,
              contactPhone: phone || undefined,
            },
          });
        }
      } else if (entityType === 'course') {
        const rawCode = codeIdx >= 0 ? cols[codeIdx] : cols[0] || '';
        const rawTitle = titleIdx >= 0 ? cols[titleIdx] : (nameIdx >= 0 ? cols[nameIdx] : cols[1] || '');
        const rawUnits = unitsIdx >= 0 ? cols[unitsIdx] : '3';
        const rawLevel = levelIdx >= 0 ? cols[levelIdx] : '100';
        const rawSemester = semesterIdx >= 0 ? cols[semesterIdx] : '1';
        const deptVal = deptIdx >= 0 ? cols[deptIdx] : '';
        const rawGeneral = isGeneralIdx >= 0 ? cols[isGeneralIdx] : 'false';

        const cleanCode = rawCode.trim().toUpperCase();
        const cleanTitle = rawTitle.trim();
        const creditUnits = Number(rawUnits) || 3;
        const levelNum = Number(rawLevel) || 100;
        const semesterNum = Number(rawSemester) || 1;
        const isGeneral = rawGeneral.toLowerCase() === 'true' || rawGeneral.toLowerCase() === 'yes' || rawGeneral === '1';

        // 1. Missing required fields check
        if (!cleanCode || !cleanTitle) {
          rows.push({
            rowNumber,
            identifier: cleanCode || 'MISSING',
            name: cleanTitle || 'MISSING',
            detail: `${rawUnits} CU • Level ${rawLevel}`,
            status: 'error',
            statusLabel: 'Invalid Row',
            reason: 'Missing Course Code or Course Title',
            payload: null,
          });
          continue;
        }

        // 2. Validate numeric creditUnits
        const parsedUnits = Number(rawUnits);
        if (rawUnits && (isNaN(parsedUnits) || parsedUnits <= 0 || parsedUnits > 12)) {
          rows.push({
            rowNumber,
            identifier: cleanCode,
            name: cleanTitle,
            detail: `${rawUnits} CU • Level ${rawLevel}`,
            status: 'error',
            statusLabel: 'Invalid Units',
            reason: `Credit units must be a valid number between 1 and 12 (received: "${rawUnits}")`,
            payload: null,
          });
          continue;
        }

        // 3. Validate level
        const parsedLevel = Number(rawLevel);
        if (rawLevel && (isNaN(parsedLevel) || parsedLevel < 100 || parsedLevel > 900)) {
          rows.push({
            rowNumber,
            identifier: cleanCode,
            name: cleanTitle,
            detail: `${creditUnits} CU • Level ${rawLevel}`,
            status: 'error',
            statusLabel: 'Invalid Level',
            reason: `Academic level must be between 100 and 900 (received: "${rawLevel}")`,
            payload: null,
          });
          continue;
        }

        // 4. Validate semester
        if (rawSemester && !['1', '2', 'first', 'second', 'semester 1', 'semester 2'].includes(rawSemester.toLowerCase().trim())) {
          rows.push({
            rowNumber,
            identifier: cleanCode,
            name: cleanTitle,
            detail: `${creditUnits} CU • Semester ${rawSemester}`,
            status: 'error',
            statusLabel: 'Invalid Semester',
            reason: `Semester must be 1 or 2 (received: "${rawSemester}")`,
            payload: null,
          });
          continue;
        }

        // 5. Department scoping check (HOD scope enforcement)
        let resolvedDeptId = 'dept-cs';
        let resolvedDeptName = 'Computer Science';
        if (deptVal) {
          const matchDept = departments.find(d =>
            d.id.toLowerCase() === deptVal.toLowerCase() ||
            d.code.toLowerCase() === deptVal.toLowerCase() ||
            d.name.toLowerCase() === deptVal.toLowerCase()
          );
          if (matchDept) {
            resolvedDeptId = matchDept.id;
            resolvedDeptName = matchDept.name;
          } else if (!isGeneral) {
            rows.push({
              rowNumber,
              identifier: cleanCode,
              name: cleanTitle,
              detail: `${creditUnits} CU • Unknown Dept: ${deptVal}`,
              status: 'error',
              statusLabel: 'Invalid Dept',
              reason: `Unrecognized Department "${deptVal}"`,
              payload: null,
            });
            continue;
          }
        }

        if (isHOD && hodDeptId && !isGeneral) {
          resolvedDeptId = hodDeptId;
          resolvedDeptName = userDepartmentName || 'Department';
          if (deptVal) {
            const matchDept = departments.find(d =>
              d.id.toLowerCase() === deptVal.toLowerCase() ||
              d.code.toLowerCase() === deptVal.toLowerCase()
            );
            if (matchDept && matchDept.id !== hodDeptId) {
              rows.push({
                rowNumber,
                identifier: cleanCode,
                name: cleanTitle,
                detail: `${creditUnits} CU • ${deptVal}`,
                status: 'error',
                statusLabel: 'Scope Mismatch',
                reason: `Department (${deptVal}) is outside authorized HOD scope (${userDepartmentName})`,
                payload: null,
              });
              continue;
            }
          }
        }

        // 6. Duplicate within uploaded file check
        if (seenIdentifiersInFile.has(cleanCode)) {
          const firstRow = seenIdentifiersInFile.get(cleanCode);
          rows.push({
            rowNumber,
            identifier: cleanCode,
            name: cleanTitle,
            detail: `${creditUnits} CU • ${resolvedDeptName}`,
            status: 'duplicate_file',
            statusLabel: 'File Duplicate',
            reason: `Course Code appears more than once in uploaded file (first seen on Row ${firstRow})`,
            payload: null,
          });
          continue;
        }
        seenIdentifiersInFile.set(cleanCode, rowNumber);

        // 7. Existing record in database check
        const existingCourse = existingCourses.find(
          c => c.code.trim().toUpperCase() === cleanCode
        );

        if (existingCourse) {
          rows.push({
            rowNumber,
            identifier: cleanCode,
            name: cleanTitle,
            detail: `${existingCourse.creditUnits} CU • ${existingCourse.departmentName}`,
            status: 'duplicate_db',
            statusLabel: 'Already Registered',
            reason: `Course Code "${cleanCode}" already exists in curriculum database`,
            payload: null,
          });
          continue;
        }

        // 8. Valid Course
        rows.push({
          rowNumber,
          identifier: cleanCode,
          name: cleanTitle,
          detail: `${creditUnits} CU • Level ${levelNum} • ${resolvedDeptName}`,
          status: 'valid_new',
          statusLabel: 'Valid Course',
          reason: 'Valid curriculum course definition ready for registration',
          payload: {
            rowNumber,
            code: cleanCode,
            title: cleanTitle,
            creditUnits,
            level: levelNum,
            semester: semesterNum === 2 ? 2 : 1,
            departmentId: resolvedDeptId,
            departmentName: resolvedDeptName,
            isGeneral,
          },
        });
      }
    }

    setPreviewRows(rows);
  };

  const validRows = useMemo(() => {
    return previewRows.filter(r => r.status === 'valid_new' || r.status === 'valid_update' || r.status === 'valid_link');
  }, [previewRows]);

  const duplicatesInFileCount = useMemo(() => {
    return previewRows.filter(r => r.status === 'duplicate_file').length;
  }, [previewRows]);

  const existingDuplicatesCount = useMemo(() => {
    return previewRows.filter(r => r.status === 'duplicate_db').length;
  }, [previewRows]);

  const errorsCount = useMemo(() => {
    return previewRows.filter(r => r.status === 'error').length;
  }, [previewRows]);

  const filteredPreviewRows = useMemo(() => {
    let rows = previewRows;
    if (filterTab === 'valid') {
      rows = rows.filter(r => r.status === 'valid_new' || r.status === 'valid_update' || r.status === 'valid_link');
    } else if (filterTab === 'duplicates') {
      rows = rows.filter(r => r.status === 'duplicate_file' || r.status === 'duplicate_db');
    } else if (filterTab === 'errors') {
      rows = rows.filter(r => r.status === 'error');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.identifier.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [previewRows, filterTab, searchQuery]);

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsExecuting(true);
    try {
      const payloads = validRows.map(r => ({ ...r.payload, rowNumber: r.rowNumber })).filter(Boolean);
      const result = await onImport(payloads);

      const successCount = result?.importedCount ?? payloads.length;
      const skippedFile = previewRows.filter(r => r.status === 'duplicate_file');
      const skippedDb = previewRows.filter(r => r.status === 'duplicate_db');
      const skippedRows = [...skippedFile, ...skippedDb].map(r => ({
        rowNumber: r.rowNumber,
        identifier: r.identifier,
        reason: r.reason,
      }));

      const parseErrors = previewRows.filter(r => r.status === 'error').map(r => ({
        row: r.rowNumber,
        identifier: r.identifier,
        reason: r.reason || 'Validation error',
      }));
      const backendErrors = result?.errors || [];
      const allErrors = [...parseErrors, ...backendErrors];

      setImportSummary({
        importedCount: successCount,
        skippedCount: skippedRows.length,
        failedCount: allErrors.length,
        updatedEnrollments: result?.updatedEnrollments,
        errors: allErrors,
        skippedRows,
      });

      toast.success(
        `Import completed successfully: ${successCount} record(s) processed.${
          result?.updatedEnrollments ? ` ${result.updatedEnrollments} progression update(s).` : ''
        }`
      );

      onSuccess();
    } catch (err: any) {
      console.error('Import execution error:', err);
      toast.error(err?.message || 'Failed to complete bulk import');
      setImportSummary({
        importedCount: 0,
        skippedCount: 0,
        failedCount: validRows.length,
        errors: [{ reason: err?.message || 'Failed to complete bulk import' }],
        skippedRows: [],
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleReset();
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <DialogTitle className="text-base text-foreground font-bold">
                  {importSummary ? 'Bulk Import Results & Summary' : title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {importSummary
                    ? 'Review the detailed outcome of the imported spreadsheet.'
                    : description}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3 text-xs">
          {/* Security alert if violation was triggered */}
          {securityViolation && (
            <div className="bg-rose-50 border border-rose-300 rounded-lg p-3.5 flex items-start gap-3 text-rose-900">
              <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs">Security Violation Detected</p>
                <p className="text-[11px] leading-relaxed text-rose-800">{securityViolation}</p>
              </div>
            </div>
          )}

          {/* File error alert if file reading or structure failed */}
          {fileError && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 flex items-start gap-3 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs">File Upload Issue</p>
                <p className="text-[11px] leading-relaxed text-amber-800">{fileError}</p>
              </div>
            </div>
          )}

          {/* Import Summary View */}
          {importSummary ? (
            <div className="space-y-4 py-1">
              <div
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  importSummary.failedCount === 0
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : importSummary.importedCount > 0
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                {importSummary.failedCount === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold text-xs">
                    {importSummary.failedCount === 0
                      ? 'Import Completed Successfully'
                      : importSummary.importedCount > 0
                      ? 'Import Completed with Warnings / Partial Failures'
                      : 'Import Failed'}
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {importSummary.importedCount} record(s) were persisted to the institutional database.
                    {importSummary.skippedCount > 0 && ` ${importSummary.skippedCount} duplicate record(s) were safely skipped.`}
                    {importSummary.failedCount > 0 && ` ${importSummary.failedCount} record(s) could not be imported.`}
                    {importSummary.updatedEnrollments ? ` ${importSummary.updatedEnrollments} academic progressions updated.` : ''}
                  </p>
                </div>
              </div>

              {/* Metric Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Successfully Imported</p>
                  <p className="text-xl font-bold text-emerald-900 mt-1">{importSummary.importedCount}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Skipped Duplicates</p>
                  <p className="text-xl font-bold text-amber-900 mt-1">{importSummary.skippedCount}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-rose-800 font-bold uppercase tracking-wider">Failed / Rejected</p>
                  <p className="text-xl font-bold text-rose-900 mt-1">{importSummary.failedCount}</p>
                </div>
              </div>

              {/* Errors breakdown */}
              {importSummary.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-900 text-xs">
                      Failed Records ({importSummary.errors.length})
                    </span>
                    <Badge variant="destructive" className="text-[9px]">
                      Requires Correction
                    </Badge>
                  </div>
                  <div className="border border-rose-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-rose-100 bg-rose-50/40 text-xs">
                    {importSummary.errors.map((err, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {err.row && <span className="font-mono text-[10px] text-rose-700">Row #{err.row}</span>}
                          {err.identifier && <span className="font-mono font-bold text-rose-900">{err.identifier}</span>}
                        </div>
                        <span className="text-[11px] text-rose-700">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped duplicate records breakdown */}
              {importSummary.skippedRows.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900 text-xs">
                      Skipped Records ({importSummary.skippedRows.length})
                    </span>
                    <Badge variant="secondary" className="text-[9px]">
                      Preserved
                    </Badge>
                  </div>
                  <div className="border border-amber-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-amber-100 bg-amber-50/40 text-xs">
                    {importSummary.skippedRows.map((skip, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-amber-700">Row #{skip.rowNumber}</span>
                          <span className="font-mono font-bold text-amber-900">{skip.identifier}</span>
                        </div>
                        <span className="text-[11px] text-amber-800">{skip.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Upload & Template Card */}
              <div className="border border-dashed border-border rounded-lg p-5 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
                <Upload className="h-8 w-8 text-primary mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-foreground text-xs">Select CSV Spreadsheet to Upload</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Strict duplicate detection, HOD scope enforcement, and identity integrity rules are automatically applied.
                </p>
                <div className="mt-3.5 flex items-center justify-center gap-3">
                  <label className="cursor-pointer">
                    <Button size="sm" type="button" className="bg-primary hover:bg-primary-600 text-white gap-2 pointer-events-none text-xs">
                      <Upload className="h-3.5 w-3.5" />
                      Browse CSV File
                    </Button>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="gap-2 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Template CSV
                  </Button>
                </div>

                {fileName && (
                  <p className="text-xs font-semibold text-emerald-700 mt-3 font-mono">
                    Loaded File: {fileName}
                  </p>
                )}

                {/* Column Guidance Panel */}
                <div className="mt-4 pt-3 border-t border-border/60 text-left bg-white/70 rounded-md p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    <span>Expected Column Structure & Template Guidance</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="font-semibold text-rose-700">Required: </span>
                      <span className="font-mono text-foreground font-medium">
                        {COLUMN_GUIDANCE[entityType].required.join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Optional: </span>
                      <span className="font-mono text-muted-foreground">
                        {COLUMN_GUIDANCE[entityType].optional.join(', ')}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    {COLUMN_GUIDANCE[entityType].description}
                  </p>
                </div>
              </div>

              {/* Breakdown & Preview Section */}
              {previewRows.length > 0 && (
                <div className="space-y-3">
                  {/* Metric Counters */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Ready to Import</p>
                      <p className="text-lg font-bold text-emerald-900 mt-0.5">{validRows.length}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">Existing in Registry</p>
                      <p className="text-lg font-bold text-blue-900 mt-0.5">{existingDuplicatesCount}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Duplicates in File</p>
                      <p className="text-lg font-bold text-amber-900 mt-0.5">{duplicatesInFileCount}</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-rose-800 font-bold uppercase tracking-wider">Invalid Rows</p>
                      <p className="text-lg font-bold text-rose-900 mt-0.5">{errorsCount}</p>
                    </div>
                  </div>

                  {/* Filter Tabs & Search */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setFilterTab('all')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          filterTab === 'all' ? 'bg-white text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        All ({previewRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('valid')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          filterTab === 'valid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Valid ({validRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('duplicates')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          filterTab === 'duplicates' ? 'bg-white text-amber-700 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Duplicates ({duplicatesInFileCount + existingDuplicatesCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('errors')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          filterTab === 'errors' ? 'bg-white text-rose-700 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Errors ({errorsCount})
                      </button>
                    </div>

                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filter preview rows..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 text-xs h-7"
                      />
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border bg-white">
                    {filteredPreviewRows.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-xs">
                        No rows match current filter.
                      </div>
                    ) : (
                      filteredPreviewRows.map((row) => {
                        const isValid = row.status === 'valid_new' || row.status === 'valid_update' || row.status === 'valid_link';
                        const isDup = row.status === 'duplicate_file' || row.status === 'duplicate_db';

                        return (
                          <div key={row.rowNumber} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/70">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                #{row.rowNumber}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-foreground text-xs">{row.identifier}</span>
                                  <span className="font-semibold text-foreground text-xs truncate">{row.name}</span>
                                  <span className="text-[11px] text-muted-foreground truncate">• {row.detail}</span>
                                </div>
                                {row.reason && (
                                  <p
                                    className={`text-[11px] mt-0.5 ${
                                      isValid ? 'text-emerald-700' : isDup ? 'text-amber-700' : 'text-rose-600'
                                    }`}
                                  >
                                    {row.reason}
                                  </p>
                                )}
                              </div>
                            </div>

                            <Badge
                              variant={isValid ? 'success' : isDup ? 'secondary' : 'destructive'}
                              className="text-[10px] font-mono flex-shrink-0 capitalize ml-2"
                            >
                              {row.statusLabel}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between">
          {importSummary ? (
            <>
              <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
                Upload Another File
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  handleReset();
                  onOpenChange(false);
                }}
                className="bg-primary hover:bg-primary-600 text-white text-xs"
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">
                {validRows.length > 0
                  ? `${validRows.length} valid record(s) ready to commit. Skipped records will not be modified.`
                  : 'No valid records ready to commit.'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={validRows.length === 0 || isExecuting}
                  onClick={handleConfirmImport}
                  className="bg-primary hover:bg-primary-600 text-white gap-1.5"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Import {validRows.length} Valid Record{validRows.length === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
