/**
 * Staff Directory Page — Super Administrator Ownership
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
import { canRegisterStaff } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import { BulkImportDialog } from '@/components/common/bulk-import-dialog';
import type { Staff, Department } from '@/types';
import {
  Plus, Search,
  Building2, Download, Edit2, Upload,
} from 'lucide-react';

const SAMPLE_STAFF_CSV = "staffId,fullName,designation,staffType,departmentCode,contactEmail,contactPhone\n" +
  "STF/ENG/010,Engr. Babatunde Lawal,Senior Engineer,non_academic,CSC,babatunde.lawal@institution.edu.ng,08031234567\n" +
  "STF/CS/088,Dr. Adaobi Nnamdi,Associate Professor,academic,CSC,adaobi.nnamdi@institution.edu.ng,08029876543\n" +
  "STF/ADM/042,Kelechi Okoye,Administrative Officer,non_academic,CSC,kelechi.okoye@institution.edu.ng,08051239876";

export function StaffPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Export Modal State
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportDept, setExportDept] = useState('all');
  const [exportType, setExportType] = useState<'all' | 'lecturer' | 'non_academic'>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'lecturer' | 'non_academic'>('all');

  // Edit Staff State (Section 25)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<Staff | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStaffType, setEditStaffType] = useState<'academic' | 'non_academic'>('non_academic');
  const [editIsLecturer, setEditIsLecturer] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Scoping: HOD views own department, Super Admin views institution-wide (Section 25)
      const scopeDeptId = user?.role === 'hod' ? user.departmentId : undefined;
      const [stfs, depts] = await Promise.all([
        api.getStaff(scopeDeptId),
        api.getDepartments(),
      ]);
      setStaff(stfs);
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load staff:', err);
      toast.error('Failed to load staff directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleStaffCreated = (newStaff: Staff) => {
    setStaff(prev => [newStaff, ...prev]);
    toast.success(`${newStaff.fullName} (${newStaff.staffId}) was registered successfully.`);
  };

  // Open Edit Modal
  const handleOpenEdit = (s: Staff) => {
    setStaffToEdit(s);
    setEditFullName(s.fullName);
    setEditDesignation(s.designation);
    setEditEmail(s.contactEmail || '');
    setEditPhone(s.contactPhone || '');
    setEditStaffType(s.staffType || 'non_academic');
    setEditIsLecturer(Boolean(s.isLecturer));
    setIsEditModalOpen(true);
  };

  // Save Edit Staff
  const handleSaveEdit = async () => {
    if (!staffToEdit) return;
    setIsSavingEdit(true);
    try {
      const updated = await api.updateStaff(staffToEdit.id, {
        fullName: editFullName,
        designation: editDesignation,
        contactEmail: editEmail,
        contactPhone: editPhone,
        staffType: editStaffType,
        isLecturer: editIsLecturer,
      });

      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success(`Updated ${updated.fullName} (${updated.staffId})`);
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error('Failed to update staff member details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtered dataset for Table View
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      if (deptFilter !== 'all' && s.departmentId !== deptFilter) return false;
      if (typeFilter === 'lecturer' && !s.isLecturer) return false;
      if (typeFilter === 'non_academic' && s.isLecturer) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchId = s.staffId.toLowerCase().includes(q);
        const matchDesig = s.designation.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesig) return false;
      }
      return true;
    });
  }, [staff, deptFilter, typeFilter, searchQuery]);

  // Filtered dataset for Export Modal
  const effectiveExportDept = user?.role === 'hod' ? user?.departmentId : (user?.role === 'super_admin' ? exportDept : user?.departmentId);

  const exportMatchingStaff = useMemo(() => {
    return staff.filter(s => {
      // 1. Department filter (Enforce scoping: HOD locked to user.departmentId; Super Admin uses exportDept)
      if (effectiveExportDept && effectiveExportDept !== 'all' && s.departmentId !== effectiveExportDept) {
        return false;
      }

      // 2. Staff Classification filter
      if (exportType === 'lecturer' && !s.isLecturer) return false;
      if (exportType === 'non_academic' && s.isLecturer) return false;

      return true;
    });
  }, [staff, effectiveExportDept, exportType]);

  const handleExecuteExport = async () => {
    if (exportMatchingStaff.length === 0) {
      toast.warning('No staff records match the selected export criteria');
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCSV(exportMatchingStaff, [
        { header: 'Staff ID', accessor: s => s.staffId },
        { header: 'Full Name', accessor: s => s.fullName },
        { header: 'Designation', accessor: s => s.designation },
        { header: 'Department', accessor: s => s.departmentName },
        { header: 'Teaching Lecturer', accessor: s => s.isLecturer ? 'YES' : 'NO' },
        { header: 'Staff Type', accessor: s => s.staffType || 'non_academic' },
        { header: 'Biometric Status', accessor: s => s.biometricStatus },
        { header: 'Enrolled Fingers', accessor: s => `${s.enrolledFingers}/10` },
        { header: 'Contact Email', accessor: s => s.contactEmail || '—' },
      ]);
      const deptSuffix = effectiveExportDept && effectiveExportDept !== 'all' ? effectiveExportDept : 'All_Departments';
      downloadCSV(csv, `BCAMS_Staff_Registry_${deptSuffix}_${Date.now()}.csv`);
      toast.success(`Exported ${exportMatchingStaff.length} staff records`);
      setIsExportOpen(false);
    } catch {
      toast.error('Failed to export staff records');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<Staff>[] = [
    {
      key: 'name',
      header: 'Staff Personnel',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3 min-w-0 max-w-[280px]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-foreground text-xs truncate" title={s.fullName}>
                {s.fullName}
              </p>
              {s.isHOD && (
                <Badge variant="outline" className="text-[10px] text-purple-800 bg-purple-50 border-purple-300 font-medium flex-shrink-0">
                  HOD
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate" title={s.staffId}>
              {s.staffId}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation / Rank',
      sortable: true,
      sortFn: (a, b) => a.designation.localeCompare(b.designation),
      render: (s) => (
        <span className="text-xs font-medium text-foreground truncate block max-w-[180px]" title={s.designation}>
          {s.designation}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department / Unit',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (s) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[180px]" title={s.departmentName}>
          {s.departmentName}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      render: (s) => (
        <Badge variant={s.isLecturer ? 'default' : 'secondary'} className="text-[11px] capitalize flex-shrink-0">
          {s.isLecturer ? 'Academic Staff' : 'Non-Academic Staff'}
        </Badge>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (s) => (
        <span className="text-xs text-muted-foreground font-mono truncate block max-w-[180px]" title={s.contactEmail || '—'}>
          {s.contactEmail || '—'}
        </span>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {s.enrolledFingers}/10
          </span>
        </div>
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
            title="Edit Staff Member"
          >
            <Edit2 className="h-3.5 w-3.5" />
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
        title="Staff Directory"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export Staff
            </Button>
            {canRegisterStaff(user) && (
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
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="gap-1.5 bg-primary hover:bg-primary-600 text-white text-xs"
                >
                  <Plus className="h-4 w-4" />
                  Register Staff
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
                placeholder="Search staff by name, staff ID, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {user?.role === 'super_admin' && (
              <div className="w-[170px]">
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

            <div className="w-[160px]">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Personnel</SelectItem>
                  <SelectItem value="lecturer">Teaching Lecturers</SelectItem>
                  <SelectItem value="non_academic">Non-Academic Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredStaff.length}</strong> personnel
          </div>
        </div>

        {/* Data Table with Pagination */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredStaff}
            keyField="id"
            pageSize={25}
            emptyMessage="No staff records match the specified filters."
          />
        </div>
      </div>

      {/* Registration Dialog */}
      <PersonFormDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        personType="staff"
        departments={departments}
        onSubmitStaff={handleStaffCreated}
      />

      {/* Bulk Import Staff Dialog */}
      <BulkImportDialog
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        entityType="staff"
        title="Bulk Import Staff Directory"
        description="Upload a CSV spreadsheet to register academic and non-academic staff personnel. Raw biometric enrollment is performed at physical registration terminals."
        templateFilename="BCAMS_Staff_Import_Template.csv"
        sampleCSV={SAMPLE_STAFF_CSV}
        onImport={async (validRecords) => {
          return await api.bulkImportStaff(validRecords);
        }}
        onSuccess={() => {
          loadData();
        }}
        existingData={{
          staff,
          departments,
        }}
        userRole={user?.role}
        userDepartmentId={user?.departmentId}
        userDepartmentName={user?.departmentName}
      />

      {/* Edit Staff Dialog (Section 25) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              Edit Staff Personnel
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update institutional staff identity for {staffToEdit?.staffId} ({staffToEdit?.fullName}).
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
              <label className="font-semibold text-foreground">Designation / Rank</label>
              <Input
                value={editDesignation}
                onChange={e => setEditDesignation(e.target.value)}
                placeholder="e.g. Senior Lecturer, Technologist..."
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
                  placeholder="staff@uni.edu.ng"
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
              <label className="font-semibold text-foreground">Staff Classification</label>
              <Select value={editStaffType} onValueChange={(v) => setEditStaffType(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic" className="text-xs">Academic Staff</SelectItem>
                  <SelectItem value="non_academic" className="text-xs">Non-Academic Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-slate-50 border border-border rounded-lg space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsLecturer}
                  onChange={e => setEditIsLecturer(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-ring h-4 w-4"
                />
                <span className="font-semibold text-foreground text-xs">
                  Teaching Lecturer Assignment
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground ml-6">
                Enables this staff member to be assigned courses and biometrically authorize class sessions.
              </p>
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
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configurable Export Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Export Staff Directory
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure parameters to generate a CSV export of staff records.
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

            {/* Staff Classification Filter */}
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Classification</label>
              <Select value={exportType} onValueChange={(v) => setExportType(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Personnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Personnel</SelectItem>
                  <SelectItem value="lecturer">Teaching Lecturers</SelectItem>
                  <SelectItem value="non_academic">Non-Academic Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary Box */}
            <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
              <p className="font-semibold text-foreground">Export Summary</p>
              <p className="text-muted-foreground">
                Matches {exportMatchingStaff.length} staff record{exportMatchingStaff.length === 1 ? '' : 's'} ready for download.
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
