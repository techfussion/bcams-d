/**
 * Lecturers Page — Linked to Staff Identities
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
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
import { canRegisterLecturer } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import { BulkImportDialog } from '@/components/common/bulk-import-dialog';
import type { Lecturer, Staff, Department, Course, LecturerAssignment } from '@/types';
import {
  Plus, BookOpen, Link2, Search, Building2,
  Download, Edit2, Upload,
} from 'lucide-react';

const SAMPLE_LECTURER_CSV = "staffId,fullName,designation,departmentCode,contactEmail,contactPhone\n" +
  "STF/CS/003,Dr. Funke Adeyemi,Senior Lecturer,CSC,funke.adeyemi@institution.edu.ng,08012345678\n" +
  "STF/CS/044,Prof. Emeka Nwosu,Professor,CSC,emeka.nwosu@institution.edu.ng,08098765432\n" +
  "STF/CS/059,Dr. Aisha Bello,Senior Lecturer,CSC,aisha.bello@institution.edu.ng,08087654321";

export function LecturersPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [availableStaff, setAvailableStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLinkStaffModalOpen, setIsLinkStaffModalOpen] = useState(false);
  const [selectedStaffToLink, setSelectedStaffToLink] = useState('');
  const [selectedDeptForLink, setSelectedDeptForLink] = useState('');
  const [assignedCourseCode, setAssignedCourseCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Export Modal State
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportDept, setExportDept] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  // Edit Lecturer State (Section 24)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [lecturerToEdit, setLecturerToEdit] = useState<Lecturer | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Assign Course State (Section 23 & 24)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [lecturerForAssign, setLecturerForAssign] = useState<Lecturer | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isPrimaryRole, setIsPrimaryRole] = useState(true);
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const [lecs, stfs, depts, crs] = await Promise.all([
        api.getLecturers(scopeDeptId),
        api.getStaff(scopeDeptId),
        api.getDepartments(),
        api.getCourses(),
      ]);
      setLecturers(lecs);
      setAvailableStaff(stfs);
      setDepartments(depts);
      setCourses(crs);
      if (depts.length > 0) {
        setSelectedDeptForLink(scopeDeptId || depts[0].id);
      }
      if (crs.length > 0) {
        setAssignedCourseCode(crs[0].code);
      }
    } catch (err) {
      console.error('Failed to load lecturers:', err);
      toast.error('Failed to load lecturers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleLecturerCreated = (newLecturer: Lecturer) => {
    setLecturers(prev => [newLecturer, ...prev]);
    toast.success(`${newLecturer.fullName} was successfully registered.`);
  };

  const handleLinkStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const staff = availableStaff.find(s => s.id === selectedStaffToLink);
    const dept = departments.find(d => d.id === selectedDeptForLink);
    if (!staff || !dept) {
      toast.error('Please select an existing staff member and department');
      return;
    }

    setIsLinking(true);
    try {
      const courseAssignments: LecturerAssignment[] = assignedCourseCode ? [{
        id: `asgn-${Date.now()}`,
        lecturerId: staff.id,
        courseId: `course-${assignedCourseCode.toLowerCase()}`,
        courseCode: assignedCourseCode,
        courseTitle: `${assignedCourseCode} Lecture Offering`,
        assignedFrom: new Date().toISOString(),
        isPrimary: true,
        isActive: true,
      }] : [];

      const linked = await api.linkStaffToLecturer(staff.id, {
        departmentId: dept.id,
        departmentName: dept.name,
        assignedCourses: courseAssignments,
      });
      setLecturers(prev => [linked, ...prev]);
      toast.success(`Successfully linked ${staff.fullName} as an active lecturer in ${dept.name}`);
      setIsLinkStaffModalOpen(false);
      setSelectedStaffToLink('');
    } catch (err) {
      toast.error('Failed to link staff member to lecturer profile');
    } finally {
      setIsLinking(false);
    }
  };

  // Filtered dataset
  const filteredLecturers = useMemo(() => {
    return lecturers.filter(l => {
      if (deptFilter !== 'all' && l.departmentId !== deptFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = l.fullName.toLowerCase().includes(q);
        const matchId = l.staffId.toLowerCase().includes(q);
        const matchDept = l.departmentName.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDept) return false;
      }
      return true;
    });
  }, [lecturers, deptFilter, searchQuery]);

  // Filtered dataset for Export Modal
  const effectiveExportDept = user?.role === 'hod' ? user?.departmentId : (user?.role === 'super_admin' ? exportDept : user?.departmentId);

  const exportMatchingLecturers = useMemo(() => {
    return lecturers.filter(l => {
      // Department filter: Super Admin can select; HOD locked to own department
      if (effectiveExportDept && effectiveExportDept !== 'all' && l.departmentId !== effectiveExportDept) {
        return false;
      }
      return true;
    });
  }, [lecturers, effectiveExportDept]);

  const handleExecuteExport = async () => {
    if (exportMatchingLecturers.length === 0) {
      toast.warning('No lecturer records match the selected export criteria');
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCSV(exportMatchingLecturers, [
        { header: 'Staff ID', accessor: l => l.staffId },
        { header: 'Full Name', accessor: l => l.fullName },
        { header: 'Designation', accessor: l => l.designation || 'Lecturer' },
        { header: 'Department', accessor: l => l.departmentName },
        { header: 'Linked Staff ID', accessor: l => l.staffPersonId || 'STF-DIRECT' },
        { header: 'Assigned Courses', accessor: l => l.assignedCourses.map(c => c.courseCode).join(', ') },
        { header: 'Biometric Status', accessor: l => l.biometricStatus },
        { header: 'Contact Email', accessor: l => l.contactEmail || '—' },
      ]);
      const deptSuffix = effectiveExportDept && effectiveExportDept !== 'all' ? effectiveExportDept : 'All_Departments';
      downloadCSV(csv, `BCAMS_Lecturers_Registry_${deptSuffix}_${Date.now()}.csv`);
      toast.success(`Exported ${exportMatchingLecturers.length} lecturer records`);
      setIsExportOpen(false);
    } catch {
      toast.error('Failed to export lecturer records');
    } finally {
      setIsExporting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (l: Lecturer) => {
    setLecturerToEdit(l);
    setEditFullName(l.fullName);
    setEditDesignation(l.designation || 'Lecturer');
    setEditEmail(l.contactEmail || '');
    setEditPhone(l.contactPhone || '');
    setIsEditModalOpen(true);
  };

  // Save Edit Lecturer
  const handleSaveEdit = async () => {
    if (!lecturerToEdit) return;
    setIsSavingEdit(true);
    try {
      const updated = await api.updateLecturer(lecturerToEdit.id, {
        fullName: editFullName,
        designation: editDesignation,
        contactEmail: editEmail,
        contactPhone: editPhone,
      });

      setLecturers(prev => prev.map(l => l.id === updated.id ? updated : l));
      toast.success(`Updated lecturer profile for ${updated.fullName}`);
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error('Failed to update lecturer profile');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Assign Course Modal (Section 23 & 24)
  const handleOpenAssign = (l: Lecturer) => {
    setLecturerForAssign(l);
    if (courses.length > 0) setSelectedCourseId(courses[0].id);
    setIsPrimaryRole(true);
    setIsAssignModalOpen(true);
  };

  // Save Assign Course
  const handleSaveAssign = async () => {
    if (!lecturerForAssign || !selectedCourseId) return;
    setIsSavingAssign(true);
    try {
      await api.assignLecturerToCourse(
        selectedCourseId,
        lecturerForAssign.id,
        isPrimaryRole,
        !isPrimaryRole
      );

      const crs = courses.find(c => c.id === selectedCourseId);
      const newAssignment: LecturerAssignment = {
        id: `asgn-${Date.now()}`,
        lecturerId: lecturerForAssign.id,
        courseId: selectedCourseId,
        courseCode: crs?.code || 'CRS',
        courseTitle: crs?.title || 'Course',
        assignedFrom: new Date().toISOString(),
        isPrimary: isPrimaryRole,
        isActive: true,
      };

      setLecturers(prev => prev.map(l => l.id === lecturerForAssign.id ? {
        ...l,
        assignedCourses: [...l.assignedCourses.filter(ac => ac.courseId !== selectedCourseId), newAssignment],
      } : l));

      toast.success(`Assigned ${crs?.code} to ${lecturerForAssign.fullName} as ${isPrimaryRole ? 'Primary Lecturer' : 'Approved Substitute'}`);
      setIsAssignModalOpen(false);
    } catch (err) {
      toast.error('Failed to assign course to lecturer');
    } finally {
      setIsSavingAssign(false);
    }
  };

  const columns: DataTableColumn<Lecturer>[] = [
    {
      key: 'name',
      header: 'Lecturer',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (l) => (
        <div className="flex items-center gap-3 min-w-0 max-w-[260px]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-foreground text-xs truncate" title={l.fullName}>
                {l.fullName}
              </p>
              {l.designation && (
                <span className="text-[11px] text-muted-foreground font-medium truncate flex-shrink-0" title={l.designation}>
                  ({l.designation})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground font-mono truncate" title={l.staffId}>
                {l.staffId}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (l) => (
        <span className="text-xs font-medium text-foreground truncate block max-w-[180px]" title={l.departmentName}>
          {l.departmentName}
        </span>
      ),
    },
    {
      key: 'courses',
      header: 'Assigned Courses',
      render: (l) => (
        <div className="flex flex-wrap gap-1 max-w-[260px]">
          {l.assignedCourses.length > 0 ? (
            l.assignedCourses.map((c) => (
              <Badge
                key={c.id || c.courseCode}
                variant="outline"
                className="font-mono text-xs gap-1 bg-muted/30 max-w-[160px] truncate"
                title={`${c.courseCode} — ${c.courseTitle}${c.isPrimary ? ' (Primary)' : ''}`}
              >
                <BookOpen className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{c.courseCode}</span>
                {c.isPrimary && <span className="text-[9px] text-primary font-bold ml-0.5 flex-shrink-0">• Primary</span>}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">No assigned courses</span>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (l) => (
        <span className="text-xs text-muted-foreground font-mono truncate block max-w-[180px]" title={l.contactEmail || '—'}>
          {l.contactEmail || '—'}
        </span>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (l) => (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {l.enrolledFingers}/10
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (l) => (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(l)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-slate-100"
            title="Edit Lecturer Profile"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenAssign(l)}
            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            title="Assign Course (Primary or Substitute)"
          >
            <BookOpen className="h-3.5 w-3.5" />
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
        title="Lecturers Registry"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export Lecturers
            </Button>
            {canRegisterLecturer(user) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Bulk Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLinkStaffModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Link Existing Staff
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="gap-1.5 bg-primary hover:bg-primary-600 text-white text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Register Lecturer
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
                placeholder="Search lecturer by name, staff ID, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
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
            Displaying <strong className="text-foreground">{filteredLecturers.length}</strong> record(s)
          </div>
        </div>

        {/* Data Table with Pagination */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredLecturers}
            keyField="id"
            pageSize={25}
            emptyMessage="No lecturers match the current filter selection."
          />
        </div>
      </div>

      {/* Registration Dialog */}
      <PersonFormDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        personType="lecturer"
        departments={departments}
        onSubmitLecturer={handleLecturerCreated}
      />

      {/* Bulk Import Lecturers Dialog */}
      <BulkImportDialog
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        entityType="lecturer"
        title="Bulk Import Lecturers Registry"
        description="Upload a CSV spreadsheet to register academic lecturers. Existing Staff identities are automatically linked without creating duplicate Person records."
        templateFilename="BCAMS_Lecturer_Import_Template.csv"
        sampleCSV={SAMPLE_LECTURER_CSV}
        onImport={async (validRecords) => {
          return await api.bulkImportLecturers(validRecords);
        }}
        onSuccess={() => {
          loadData();
        }}
        existingData={{
          lecturers,
          staff: availableStaff,
          departments,
        }}
        userRole={user?.role}
        userDepartmentId={user?.departmentId}
        userDepartmentName={user?.departmentName}
      />

      {/* Link Existing Staff Dialog */}
      <Dialog open={isLinkStaffModalOpen} onOpenChange={setIsLinkStaffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Link Existing Staff as Lecturer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Avoid duplicate entries by activating a teaching role on an existing institutional staff member.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLinkStaff} className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Select Staff Member *
              </label>
              <Select value={selectedStaffToLink} onValueChange={setSelectedStaffToLink}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select staff from directory" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availableStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.staffId} — {s.fullName} ({s.designation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Academic Department *
              </label>
              <Select
                value={selectedDeptForLink}
                onValueChange={setSelectedDeptForLink}
                disabled={user?.role === 'hod'}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Initial Course Assignment (Optional)
              </label>
              <Select value={assignedCourseCode} onValueChange={setAssignedCourseCode}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose course code" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.code}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsLinkStaffModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isLinking || !selectedStaffToLink} className="bg-primary hover:bg-primary-600 text-white">
                {isLinking ? 'Linking...' : 'Activate Lecturer Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lecturer Dialog (Section 24) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Edit Lecturer Profile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update teaching personnel details for {lecturerToEdit?.staffId} ({lecturerToEdit?.fullName}).
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

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Academic Designation / Rank</label>
              <Input
                value={editDesignation}
                onChange={e => setEditDesignation(e.target.value)}
                placeholder="e.g. Senior Lecturer, Associate Professor..."
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
                  placeholder="lecturer@uni.edu.ng"
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
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingEdit || !editFullName.trim()}
              onClick={handleSaveEdit}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {isSavingEdit ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Course Dialog (Section 23 & 24) */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Assign Course Offering
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign teaching responsibility to <strong>{lecturerForAssign?.fullName}</strong> ({lecturerForAssign?.staffId}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Select Course to Assign</label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose course..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.code} — {c.title} ({c.departmentName}, {c.creditUnits} CU)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="font-semibold text-foreground">Teaching Capacity Role</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isPrimaryRole ? "default" : "outline"}
                  onClick={() => setIsPrimaryRole(true)}
                  className="text-xs h-8"
                >
                  Primary Lecturer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!isPrimaryRole ? "default" : "outline"}
                  onClick={() => setIsPrimaryRole(false)}
                  className="text-xs h-8"
                >
                  Approved Substitute
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isPrimaryRole
                  ? 'Authorizes the lecturer as the main instructor responsible for this course offering.'
                  : 'Designates this lecturer as an approved backup substitute authorized to open class sessions.'}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingAssign || !selectedCourseId}
              onClick={handleSaveAssign}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              {isSavingAssign ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configurable Export Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Export Lecturer Registry
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure parameters to generate a CSV export of lecturer records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
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

            {/* Summary Box */}
            <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
              <p className="font-semibold text-foreground">Export Summary</p>
              <p className="text-muted-foreground">
                Matches {exportMatchingLecturers.length} lecturer record{exportMatchingLecturers.length === 1 ? '' : 's'} ready for download.
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
