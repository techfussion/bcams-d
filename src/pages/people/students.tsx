/**
 * Students Page — Remediated & Scope-Aware
 * 
 * Implements:
 * - Scoped queries (HOD sees own department, Super Admin sees all)
 * - Separation of Student Identity from Academic Progression
 * - Manual creation & Enterprise Bulk Import with validation & preview
 * - Differentiation of new student creation vs academic enrollment updates
 * - Rejection of raw biometric templates in import files
 * - Pagination across records
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { PersonFormDialog } from '@/components/people';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { canManageStudents } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { Student, Department } from '@/types';
import {
  Plus, GraduationCap, UserCheck, Upload, Download, FileSpreadsheet,
  AlertTriangle, CheckCircle2, Search, Filter, Building2, Shield,
} from 'lucide-react';

const statusVariants: Record<string, 'success' | 'warning' | 'muted' | 'destructive'> = {
  active: 'success',
  inactive: 'muted',
  withdrawn: 'destructive',
  graduated: 'muted',
  suspended: 'destructive',
};

interface ImportRowPreview {
  matricNumber: string;
  fullName: string;
  level: number;
  departmentId: string;
  departmentName: string;
  programme: string;
  type: 'new_student' | 'progression_update' | 'error';
  errorReason?: string;
}

export function StudentsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  // Bulk Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileContent, setImportFileContent] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importPreviewRows, setImportPreviewRows] = useState<ImportRowPreview[]>([]);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const [studs, depts] = await Promise.all([
        api.getStudents(scopeDeptId),
        api.getDepartments(),
      ]);
      setStudents(studs);
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load students:', err);
      toast.error('Failed to load student records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleStudentCreated = (newStudent: Student) => {
    setStudents(prev => [newStudent, ...prev]);
    toast.success(`${newStudent.fullName} (${newStudent.matricNumber}) was successfully registered.`);
  };

  // Filtered dataset
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (levelFilter !== 'all' && (s.currentLevel || s.level) !== Number(levelFilter)) return false;
      if (deptFilter !== 'all' && s.departmentId !== deptFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchMatric = s.matricNumber.toLowerCase().includes(q);
        const matchProg = (s.currentProgramme || s.programme || '').toLowerCase().includes(q);
        if (!matchName && !matchMatric && !matchProg) return false;
      }
      return true;
    });
  }, [students, levelFilter, deptFilter, searchQuery]);

  // CSV Template download
  const handleDownloadSampleCSV = () => {
    const sample = "matricNumber,fullName,level,departmentCode,programme,academicSession\n" +
      "CSC/2026/0101,Chinedu Joseph Okafor,200,CSC,B.Sc. Computer Science,2026/2027\n" +
      "CSC/2026/0102,Zainab Aliyu,300,CSC,B.Sc. Computer Science,2026/2027\n" +
      "CSC/2026/0045,Amina Ibrahim,200,CSC,B.Sc. Computer Science,2026/2027";
    downloadCSV(sample, "BCAMS_Student_Import_Template.csv");
    toast.success("Sample template downloaded");
  };

  // Handle file selection and parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setIsParsingImport(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportFileContent(text);
      parseAndValidateCSV(text);
      setIsParsingImport(false);
    };
    reader.readAsText(file);
  };

  const parseAndValidateCSV = (csvText: string) => {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      toast.error('The uploaded CSV file is empty or missing headers');
      setImportPreviewRows([]);
      return;
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/['"]/g, ''));
    
    // Critical Domain Check: reject raw biometric templates in bulk import (Section 7)
    if (headers.some(h => h.includes('biometric') || h.includes('template') || h.includes('fingerprint'))) {
      toast.error('Security Violation: Raw biometric templates are strictly prohibited in CSV imports.');
      setImportPreviewRows([]);
      return;
    }

    const matricIdx = headers.findIndex(h => h.includes('matric'));
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const levelIdx = headers.findIndex(h => h.includes('level'));
    const deptIdx = headers.findIndex(h => h.includes('dept'));
    const progIdx = headers.findIndex(h => h.includes('prog'));

    const rows: ImportRowPreview[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
      const matric = matricIdx >= 0 ? cols[matricIdx] : cols[0];
      const name = nameIdx >= 0 ? cols[nameIdx] : cols[1];
      const lvl = levelIdx >= 0 ? Number(cols[levelIdx]) : 100;
      const deptCode = deptIdx >= 0 ? cols[deptIdx] : 'CSC';
      const prog = progIdx >= 0 ? cols[progIdx] : 'Computer Science';

      if (!matric || !name) {
        rows.push({
          matricNumber: matric || 'MISSING',
          fullName: name || 'MISSING',
          level: lvl || 100,
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
          programme: prog,
          type: 'error',
          errorReason: 'Missing Matric Number or Name',
        });
        continue;
      }

      // Check if student already exists -> progression update
      const existing = students.find(s => s.matricNumber.trim().toUpperCase() === matric.trim().toUpperCase());
      if (existing) {
        rows.push({
          matricNumber: matric.toUpperCase(),
          fullName: name,
          level: lvl,
          departmentId: existing.departmentId,
          departmentName: existing.departmentName,
          programme: prog,
          type: 'progression_update',
        });
      } else {
        rows.push({
          matricNumber: matric.toUpperCase(),
          fullName: name,
          level: lvl,
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
          programme: prog,
          type: 'new_student',
        });
      }
    }

    setImportPreviewRows(rows);
  };

  const handleConfirmImport = async () => {
    setIsExecutingImport(true);
    try {
      const validRows = importPreviewRows.filter(r => r.type !== 'error');
      await api.bulkImportStudents(validRows);
      toast.success(`Successfully processed ${validRows.length} student records`);
      setIsImportModalOpen(false);
      setImportPreviewRows([]);
      setImportFileName('');
      loadData();
    } catch (err) {
      toast.error('Failed to execute bulk student import');
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleExportCurrentView = () => {
    const csv = generateCSV(filteredStudents, [
      { header: 'Matric Number', accessor: s => s.matricNumber },
      { header: 'Full Name', accessor: s => s.fullName },
      { header: 'Level', accessor: s => `${s.currentLevel || s.level}L` },
      { header: 'Department', accessor: s => s.departmentName },
      { header: 'Programme', accessor: s => s.currentProgramme || s.programme },
      { header: 'Biometric Status', accessor: s => s.biometricStatus },
      { header: 'Enrolled Fingers', accessor: s => `${s.enrolledFingers}/10` },
      { header: 'Capability', accessor: s => s.captureCapability || 'None' },
      { header: 'Lifecycle Status', accessor: s => s.lifecycleStatus || s.status || 'active' },
    ]);
    downloadCSV(csv, 'BCAMS_Students_Registry.csv');
    toast.success('Student records exported');
  };

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
            {s.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground text-xs">{s.fullName}</p>
              {s.captureCapability === 'session_capture' && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-medium">
                  Session Capturer
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{s.matricNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Faculty',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (s) => (
        <div>
          <p className="text-xs font-medium text-foreground">{s.departmentName}</p>
          <p className="text-[11px] text-muted-foreground">{s.currentProgramme || s.programme}</p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Standing',
      sortable: true,
      sortFn: (a, b) => (a.currentLevel || a.level) - (b.currentLevel || b.level),
      render: (s) => (
        <Badge variant="outline" className="font-mono text-xs">
          {s.currentLevel || s.level}L
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Academic Status',
      render: (s) => {
        const stat = s.status || s.lifecycleStatus || 'active';
        return (
          <Badge
            variant={statusVariants[stat] || 'default'}
            className="capitalize text-xs font-medium"
          >
            {stat}
          </Badge>
        );
      },
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={s.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {s.enrolledFingers}/10
          </span>
        </div>
      ),
    },
    {
      key: 'enrollments',
      header: 'Term Enrollments',
      render: (s) => (
        <span className="text-xs font-mono text-muted-foreground">
          {s.courseEnrollments?.length || 0} courses
        </span>
      ),
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  const newRecordsCount = importPreviewRows.filter(r => r.type === 'new_student').length;
  const updatesCount = importPreviewRows.filter(r => r.type === 'progression_update').length;
  const errorsCount = importPreviewRows.filter(r => r.type === 'error').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Student Registry"
        subtitle="Manage permanent student identities, academic levels, and biometric activation status."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCurrentView} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            {canManageStudents(user) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(true)}
                  className="gap-2 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Bulk Import
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Register Student
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Scope Indicator Banner */}
        <div className="bg-slate-50 border border-border rounded-lg p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-800">
            <Shield className="h-4 w-4 text-primary" />
            <span>
              {user?.role === 'hod'
                ? `Authorized Scope: Department of ${user.departmentName} records only.`
                : 'Institution-Wide Access: Managing student registry across all faculties.'}
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {students.length} Total Students
          </Badge>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or matric..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="w-[140px]">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Level" />
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

            {user?.role === 'super_admin' && (
              <div className="w-[180px]">
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredStudents.length}</strong> students
          </div>
        </div>

        {/* Table with Pagination */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredStudents}
            keyField="id"
            pageSize={25}
            emptyMessage="No student records match the active filter criteria."
          />
        </div>
      </div>

      {/* Manual Student Registration Dialog */}
      <PersonFormDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        personType="student"
        departments={departments}
        onSubmitStudent={handleStudentCreated}
      />

      {/* Enterprise Bulk Import Dialog with Validation & Preview */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Bulk Import Students & Academic Progression
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload a CSV file to register new students or update level progressions for existing students. Raw biometric templates are strictly excluded.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-3 text-xs">
            {/* Step 1: Upload or Template */}
            <div className="border border-dashed border-border rounded-lg p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground">Select CSV File to Upload</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Columns: matricNumber, fullName, level, departmentCode, programme, academicSession
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <label className="cursor-pointer">
                  <Button size="sm" type="button" className="bg-primary hover:bg-primary-600 text-white gap-2 pointer-events-none">
                    <FileSpreadsheet className="h-4 w-4" />
                    Browse Files
                  </Button>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <Button variant="outline" size="sm" type="button" onClick={handleDownloadSampleCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Sample CSV
                </Button>
              </div>
              {importFileName && (
                <p className="text-xs font-medium text-emerald-700 mt-3 font-mono">
                  Loaded: {importFileName}
                </p>
              )}
            </div>

            {/* Step 2: Breakdown & Preview */}
            {importPreviewRows.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-center">
                    <p className="text-[11px] text-emerald-800 font-medium uppercase">New Students</p>
                    <p className="text-lg font-bold text-emerald-900 mt-0.5">{newRecordsCount}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
                    <p className="text-[11px] text-blue-800 font-medium uppercase">Level Progressions</p>
                    <p className="text-lg font-bold text-blue-900 mt-0.5">{updatesCount}</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-center">
                    <p className="text-[11px] text-rose-800 font-medium uppercase">Invalid / Errors</p>
                    <p className="text-lg font-bold text-rose-900 mt-0.5">{errorsCount}</p>
                  </div>
                </div>

                <div className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border">
                  {importPreviewRows.slice(0, 10).map((row, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{row.matricNumber}</span>
                          <span className="font-medium text-foreground">{row.fullName}</span>
                          <Badge variant="outline" className="text-[10px]">{row.level}L</Badge>
                        </div>
                        {row.errorReason && (
                          <p className="text-rose-600 text-[11px] mt-0.5">{row.errorReason}</p>
                        )}
                      </div>
                      <Badge
                        variant={row.type === 'new_student' ? 'success' : row.type === 'progression_update' ? 'default' : 'destructive'}
                        className="text-[10px] capitalize"
                      >
                        {row.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                  {importPreviewRows.length > 10 && (
                    <div className="p-2 text-center text-muted-foreground text-[11px] bg-muted/20">
                      + {importPreviewRows.length - 10} more rows ready for processing
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isExecutingImport || importPreviewRows.length === 0 || (newRecordsCount === 0 && updatesCount === 0)}
              className="bg-primary hover:bg-primary-600 text-white gap-2"
            >
              {isExecutingImport ? 'Importing...' : `Confirm & Process (${newRecordsCount + updatesCount} Records)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
