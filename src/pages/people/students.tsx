/**
 * Students Page — Remediated & Scope-Aware
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { PersonFormDialog } from '@/components/people';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { canManageStudents } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import { BulkImportDialog } from '@/components/common/bulk-import-dialog';
import type { Student, Department, AcademicEnrollment, Course, CourseEnrollment } from '@/types';
import {
  Plus, Upload, Download, Search, Building2, Edit2, History
} from 'lucide-react';

const statusVariants: Record<string, 'success' | 'warning' | 'muted' | 'destructive'> = {
  active: 'success',
  inactive: 'muted',
  withdrawn: 'destructive',
  graduated: 'muted',
  suspended: 'destructive',
};

const SAMPLE_STUDENT_CSV = "matricNumber,fullName,level,departmentCode,programme,academicSession\n" +
  "CSC/2026/0101,Chinedu Joseph Okafor,200,CSC,B.Sc. Computer Science,2026/2027\n" +
  "CSC/2026/0102,Zainab Aliyu,300,CSC,B.Sc. Computer Science,2026/2027\n" +
  "CSC/2026/0045,Amina Ibrahim,200,CSC,B.Sc. Computer Science,2026/2027";

export function StudentsPage() {
  const navigate = useNavigate();
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

  // Edit Student State (Section 19)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProgramme, setEditProgramme] = useState('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  // Progression & Course Enrollment State
  const [isProgressionModalOpen, setIsProgressionModalOpen] = useState(false);
  const [studentForProgression, setStudentForProgression] = useState<Student | null>(null);
  const [studentEnrollments, setStudentEnrollments] = useState<AcademicEnrollment[]>([]);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);
  const [newProgSession, setNewProgSession] = useState('2026/2027');
  const [newProgLevel, setNewProgLevel] = useState('300');
  const [newProgSemester, setNewProgSemester] = useState('1');
  const [isAddingProgression, setIsAddingProgression] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourseToEnroll, setSelectedCourseToEnroll] = useState('');
  const [isEnrollingCourse, setIsEnrollingCourse] = useState(false);

  // Export Modal state
  const [allAcademicEnrollments, setAllAcademicEnrollments] = useState<AcademicEnrollment[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportAcademicSession, setExportAcademicSession] = useState('2026/2027');
  const [exportSemester, setExportSemester] = useState('all');
  const [exportDept, setExportDept] = useState('all');
  const [exportLevel, setExportLevel] = useState('all');
  const [exportStatus, setExportStatus] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const [studs, depts, crs, enrolls] = await Promise.all([
        api.getStudents(scopeDeptId),
        api.getDepartments(),
        api.getCourses(),
        api.getAcademicEnrollments(),
      ]);
      setStudents(studs);
      setDepartments(depts);
      setAvailableCourses(crs);
      setAllAcademicEnrollments(enrolls);
      if (crs.length > 0) setSelectedCourseToEnroll(crs[0].code);
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

  // Open Edit Modal
  const handleOpenEdit = (student: Student) => {
    setStudentToEdit(student);
    setEditFullName(student.fullName);
    setEditEmail(student.contactEmail || '');
    setEditPhone(student.contactPhone || '');
    setEditProgramme(student.currentProgramme || student.programme || '');
    setEditStatus(student.status || student.lifecycleStatus || 'active');
    setIsEditModalOpen(true);
  };

  // Save Edit Student
  const handleSaveEdit = async () => {
    if (!studentToEdit) return;
    setIsUpdatingStudent(true);
    try {
      const updated = await api.updateStudent(studentToEdit.id, {
        fullName: editFullName,
        contactEmail: editEmail,
        contactPhone: editPhone,
        currentProgramme: editProgramme,
        programme: editProgramme,
        status: editStatus as any,
        lifecycleStatus: editStatus as any,
      });

      setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success(`Updated record for ${updated.fullName} (${updated.matricNumber})`);
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error('Failed to update student details');
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  // Open Progression & Enrollment Modal
  const handleOpenProgression = async (student: Student) => {
    setStudentForProgression(student);
    setIsProgressionModalOpen(true);
    setIsLoadingEnrollments(true);
    try {
      const enrollments = await api.getAcademicEnrollments(student.id);
      setStudentEnrollments(enrollments);
      const nextLvl = (student.currentLevel || student.level || 100) + 100;
      setNewProgLevel(String(Math.min(nextLvl, 500)));
    } catch (err) {
      toast.error('Failed to load student academic enrollment history');
    } finally {
      setIsLoadingEnrollments(false);
    }
  };

  // Add Academic Progression (Section 20 & 21)
  const handleAddProgression = async () => {
    if (!studentForProgression) return;
    setIsAddingProgression(true);
    try {
      const created = await api.createAcademicEnrollment({
        studentId: studentForProgression.id,
        studentName: studentForProgression.fullName,
        matricNumber: studentForProgression.matricNumber,
        departmentId: studentForProgression.departmentId,
        departmentName: studentForProgression.departmentName,
        programme: studentForProgression.currentProgramme || studentForProgression.programme,
        academicSession: newProgSession,
        level: Number(newProgLevel),
        semester: Number(newProgSemester),
        status: 'active',
        enrolledCourses: studentForProgression.courseEnrollments || [],
      });

      setStudentEnrollments(prev => [created, ...prev]);
      setStudents(prev => prev.map(s => s.id === studentForProgression.id ? {
        ...s,
        currentLevel: created.level,
        currentSession: created.academicSession,
        level: created.level,
        academicSession: created.academicSession,
      } : s));

      toast.success(`Progressed ${studentForProgression.fullName} to Level ${created.level} for session ${created.academicSession}`);
    } catch (err) {
      toast.error('Failed to record academic progression');
    } finally {
      setIsAddingProgression(false);
    }
  };

  // Enroll Student in Course (supports carryover / general / cross-department courses)
  const handleEnrollCourse = async () => {
    if (!studentForProgression || !selectedCourseToEnroll) return;
    const crs = availableCourses.find(c => c.code === selectedCourseToEnroll);
    if (!crs) return;

    setIsEnrollingCourse(true);
    try {
      const currentList = studentForProgression.courseEnrollments || [];
      if (currentList.some(ce => ce.courseCode === crs.code)) {
        toast.error(`Student is already enrolled in ${crs.code}`);
        return;
      }

      const newCe: CourseEnrollment = {
        id: `ce-${Date.now().toString(36)}`,
        studentId: studentForProgression.id,
        courseOfferingId: `co-${crs.code.toLowerCase().replace(/\s+/g, '')}-2026`,
        courseCode: crs.code,
        courseTitle: crs.title,
        creditUnits: crs.creditUnits,
        type: crs.isGeneral ? 'general' : 'core',
        enrolledAt: new Date().toISOString(),
      };

      const updatedList = [...currentList, newCe];
      const updated = await api.updateStudent(studentForProgression.id, {
        courseEnrollments: updatedList,
      });

      setStudentForProgression(updated);
      setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success(`Enrolled in ${crs.code} (${crs.title})`);
    } catch (err) {
      toast.error('Failed to enroll student in course');
    } finally {
      setIsEnrollingCourse(false);
    }
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



  // Filtered dataset for Export Modal
  const exportMatchingStudents = useMemo(() => {
    return students.filter(s => {
      // 1. Department filter (Enforce scoping: HOD locked to user.departmentId; Super Admin uses exportDept)
      const effectiveDept = user?.role === 'hod' ? user?.departmentId : (user?.role === 'super_admin' ? exportDept : user?.departmentId);
      if (effectiveDept && effectiveDept !== 'all' && s.departmentId !== effectiveDept) {
        return false;
      }

      // 2. Academic Session filter
      if (exportAcademicSession !== 'all') {
        const studentSession = s.currentSession || s.academicSession;
        if (studentSession && studentSession !== exportAcademicSession) {
          return false;
        }
      }

      // 3. Level filter
      if (exportLevel !== 'all') {
        const studentLevel = s.currentLevel || s.level;
        if (studentLevel !== Number(exportLevel)) {
          return false;
        }
      }

      // 4. Status filter
      if (exportStatus !== 'all') {
        const studentStatus = s.lifecycleStatus || s.status || 'active';
        if (studentStatus !== exportStatus) {
          return false;
        }
      }

      // 5. Semester filter (Cross-referenced against academic enrollments)
      if (exportSemester !== 'all') {
        const hasMatchingEnrollment = allAcademicEnrollments.some(e =>
          e.studentId === s.id &&
          (exportAcademicSession === 'all' || e.academicSession === exportAcademicSession) &&
          String(e.semester) === exportSemester
        );
        if (!hasMatchingEnrollment) {
          return false;
        }
      }

      return true;
    });
  }, [students, exportDept, exportAcademicSession, exportLevel, exportStatus, exportSemester, allAcademicEnrollments, user]);

  const handleExecuteExport = async () => {
    if (exportMatchingStudents.length === 0) {
      toast.warning('No student records match the selected export criteria');
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCSV(exportMatchingStudents, [
        { header: 'Matric Number', accessor: s => s.matricNumber },
        { header: 'Full Name', accessor: s => s.fullName },
        { header: 'Level', accessor: s => `${s.currentLevel || s.level}L` },
        { header: 'Department', accessor: s => s.departmentName },
        { header: 'Programme', accessor: s => s.currentProgramme || s.programme },
        { header: 'Academic Session', accessor: s => s.currentSession || s.academicSession || '2026/2027' },
        { header: 'Biometric Status', accessor: s => s.biometricStatus },
        { header: 'Enrolled Fingers', accessor: s => `${s.enrolledFingers}/10` },
        { header: 'Capability', accessor: s => s.captureCapability || 'None' },
        { header: 'Lifecycle Status', accessor: s => s.lifecycleStatus || s.status || 'active' },
      ]);
      const sessionSuffix = exportAcademicSession !== 'all' ? exportAcademicSession.replace('/', '-') : 'All_Sessions';
      downloadCSV(csv, `BCAMS_Students_Registry_${sessionSuffix}_${Date.now()}.csv`);
      toast.success(`Exported ${exportMatchingStudents.length} student records`);
      setIsExportOpen(false);
    } catch {
      toast.error('Failed to export student records');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3 min-w-0 max-w-[260px]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground text-xs truncate" title={s.fullName}>
                {s.fullName}
              </p>
              {s.captureCapability === 'session_capture' && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span title="Session Capturer">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold px-1 py-0 cursor-help flex-shrink-0"
                        >
                          SC
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Session Capturer
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate" title={s.matricNumber}>
              {s.matricNumber}
            </p>
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
        <div className="min-w-0 max-w-[220px]">
          <p className="text-xs font-medium text-foreground truncate" title={s.departmentName}>
            {s.departmentName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate" title={s.currentProgramme || s.programme}>
            {s.currentProgramme || s.programme}
          </p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Standing',
      sortable: true,
      sortFn: (a, b) => (a.currentLevel || a.level) - (b.currentLevel || b.level),
      render: (s) => (
        <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
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
            className="capitalize text-xs font-medium flex-shrink-0"
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
          <span className="text-xs font-mono text-muted-foreground font-semibold flex-shrink-0">
            {s.enrolledFingers}/10
          </span>
        </div>
      ),
    },
    {
      key: 'enrollments',
      header: 'Term Enrollments',
      render: (s) => (
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
          {s.courseEnrollments?.length || 0} courses
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(s)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-100"
            title="Edit student details"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenProgression(s)}
            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="Academic Progression & Course Enrollments"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }



  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Student Registry"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export Students
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
      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        entityType="student"
        title="Bulk Import Students & Academic Progression"
        description="Upload a CSV spreadsheet to register new students or record level progressions."
        templateFilename="BCAMS_Student_Import_Template.csv"
        sampleCSV={SAMPLE_STUDENT_CSV}
        onImport={async (validRecords) => {
          return await api.bulkImportStudents(validRecords);
        }}
        onSuccess={() => {
          loadData();
        }}
        existingData={{
          students,
          departments,
        }}
        userRole={user?.role}
        userDepartmentId={user?.departmentId}
        userDepartmentName={user?.departmentName}
      />

      {/* Edit Student Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Edit Student Record
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update student personal identity and institutional standing for {studentToEdit?.matricNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Full Name</label>
              <Input
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Contact Email</label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="student@uni.edu.ng"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Contact Phone</label>
                <Input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="+234..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Academic Programme</label>
              <Input
                value={editProgramme}
                onChange={e => setEditProgramme(e.target.value)}
                placeholder="e.g. B.Sc. Computer Science"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Academic Lifecycle Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="text-xs">Active (In Good Standing)</SelectItem>
                  <SelectItem value="suspended" className="text-xs">Suspended</SelectItem>
                  <SelectItem value="graduated" className="text-xs">Graduated (Alumnus)</SelectItem>
                  <SelectItem value="withdrawn" className="text-xs">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isUpdatingStudent || !editFullName.trim()}
              onClick={handleSaveEdit}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {isUpdatingStudent ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progression & Course Enrollment Dialog */}
      <Dialog open={isProgressionModalOpen} onOpenChange={setIsProgressionModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Academic Progression & Course History
            </DialogTitle>
            <DialogDescription className="text-xs">
              Student: <strong>{studentForProgression?.fullName}</strong> ({studentForProgression?.matricNumber}) • {studentForProgression?.departmentName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 text-xs">
            {/* 1. Academic Progression History (Section 20 & 21) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                  Academic Progression Sequence
                </h4>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Current: {studentForProgression?.currentLevel || studentForProgression?.level}L
                </Badge>
              </div>

              {isLoadingEnrollments ? (
                <p className="text-xs text-muted-foreground py-2">Loading enrollment sequence...</p>
              ) : studentEnrollments.length > 0 ? (
                <div className="border border-border rounded-lg divide-y divide-border bg-slate-50/50">
                  {studentEnrollments.map((ae) => (
                    <div key={ae.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-foreground text-xs">{ae.academicSession}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{ae.level}L</Badge>
                          <span className="text-[11px] text-muted-foreground">Semester {ae.semester}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ae.programme} • {ae.departmentName}</p>
                      </div>
                      <Badge
                        variant={ae.status === 'active' ? 'success' : 'outline'}
                        className="text-[10px] uppercase font-mono"
                      >
                        {ae.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 border border-dashed rounded-lg text-center text-muted-foreground text-xs">
                  No historical academic enrollments found. Add a progression below.
                </div>
              )}
            </div>

            {/* 2. Add New Progression Form (Section 21) */}
            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-lg space-y-3">
              <h4 className="font-bold text-blue-950 text-xs">Record Academic Progression</h4>
              <p className="text-[11px] text-blue-800">
                Advances the student into a new academic session and level while strictly preserving historical academic records.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-blue-950 text-[11px]">Academic Session</label>
                  <Select value={newProgSession} onValueChange={setNewProgSession}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026/2027" className="text-xs">2026/2027 (Current)</SelectItem>
                      <SelectItem value="2027/2028" className="text-xs">2027/2028</SelectItem>
                      <SelectItem value="2025/2026" className="text-xs">2025/2026 (Historical)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-blue-950 text-[11px]">Level Standing</label>
                  <Select value={newProgLevel} onValueChange={setNewProgLevel}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100" className="text-xs">100 Level</SelectItem>
                      <SelectItem value="200" className="text-xs">200 Level</SelectItem>
                      <SelectItem value="300" className="text-xs">300 Level</SelectItem>
                      <SelectItem value="400" className="text-xs">400 Level</SelectItem>
                      <SelectItem value="500" className="text-xs">500 Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-blue-950 text-[11px]">Semester</label>
                  <Select value={newProgSemester} onValueChange={setNewProgSemester}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">First Semester</SelectItem>
                      <SelectItem value="2" className="text-xs">Second Semester</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={handleAddProgression}
                  disabled={isAddingProgression}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-7"
                >
                  {isAddingProgression ? 'Progressing...' : 'Add Progression Record'}
                </Button>
              </div>
            </div>

            {/* 3. Course Enrollments (Supports General & Cross-Department courses) */}
            <div className="space-y-2">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                Active Course Enrollments ({studentForProgression?.courseEnrollments?.length || 0})
              </h4>

              {studentForProgression?.courseEnrollments && studentForProgression.courseEnrollments.length > 0 ? (
                <div className="border border-border rounded-lg divide-y divide-border">
                  {studentForProgression.courseEnrollments.map((ce, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold font-mono text-foreground">{ce.courseCode}</span>
                        <span className="text-muted-foreground ml-2">{ce.courseTitle}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {ce.creditUnits} CU
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No courses currently enrolled.</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Select value={selectedCourseToEnroll} onValueChange={setSelectedCourseToEnroll}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select course to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourses.map(c => (
                      <SelectItem key={c.id || c.code} value={c.code} className="text-xs">
                        {c.code} — {c.title} ({c.departmentName}, {c.creditUnits} CU)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isEnrollingCourse || !selectedCourseToEnroll}
                  onClick={handleEnrollCourse}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Enroll
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button size="sm" onClick={() => setIsProgressionModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configurable Export Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Export Student Registry
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure parameters to generate a CSV export of student records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Academic Session & Semester */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Academic Session</label>
                <Select value={exportAcademicSession} onValueChange={setExportAcademicSession}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Academic Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026/2027">2026/2027 (Current)</SelectItem>
                    <SelectItem value="2025/2026">2025/2026 (Historical)</SelectItem>
                    <SelectItem value="all">All Sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Semester</label>
                <Select value={exportSemester} onValueChange={setExportSemester}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    <SelectItem value="1">First Semester</SelectItem>
                    <SelectItem value="2">Second Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Department: Super Admin Selectable; HOD Locked */}
            {user?.role === 'super_admin' && (
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Department</label>
                <Select value={exportDept} onValueChange={setExportDept}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Departments" />
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

            {user?.role === 'hod' && (
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Department</label>
                <div className="flex items-center gap-2 h-9 px-3 border border-border rounded-md bg-muted/40 text-xs text-foreground font-medium">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{user?.departmentName || 'Authorized Department'}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1 border-muted-foreground/30">
                    Department Locked
                  </Badge>
                </div>
              </div>
            )}

            {/* Level & Student Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Standing Level</label>
                <Select value={exportLevel} onValueChange={setExportLevel}>
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
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Student Status</label>
                <Select value={exportStatus} onValueChange={setExportStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="graduated">Graduated</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
              <p className="font-semibold text-foreground">Export Summary</p>
              <p className="text-muted-foreground">
                Matches {exportMatchingStudents.length} student record{exportMatchingStudents.length === 1 ? '' : 's'} ready for download.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExecuteExport} disabled={isExporting} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Generating...' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
