/**
 * Staff Directory Page — Super Administrator Ownership
 * 
 * FR-12: Institutional Staff Registry.
 * Underlying identity for all personnel (both teaching/lecturers and non-academic staff).
 * Enforces:
 * - Super Admin ONLY ownership for registration (HOD cannot register staff)
 * - Identifies teaching lecturers with explicit staff-lecturer relationship badge
 * - Gate capture capability assignment indicator
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
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { canRegisterStaff } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { Staff, Department } from '@/types';
import {
  Plus, Users, Shield, UserCheck, Search, Filter,
  Building2, GraduationCap, DoorOpen, Download,
} from 'lucide-react';

export function StaffPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'lecturer' | 'non_academic'>('all');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stfs, depts] = await Promise.all([
        api.getStaff(),
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
  }, []);

  const handleStaffCreated = (newStaff: Staff) => {
    setStaff(prev => [newStaff, ...prev]);
    toast.success(`${newStaff.fullName} (${newStaff.staffId}) was registered successfully.`);
  };

  // Filtered dataset
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

  const handleExportCSV = () => {
    const csv = generateCSV(filteredStaff, [
      { header: 'Staff ID', accessor: s => s.staffId },
      { header: 'Full Name', accessor: s => s.fullName },
      { header: 'Designation', accessor: s => s.designation },
      { header: 'Department', accessor: s => s.departmentName },
      { header: 'Teaching Lecturer', accessor: s => s.isLecturer ? 'YES' : 'NO' },
      { header: 'Staff Type', accessor: s => s.staffType || 'non_academic' },
      { header: 'Gate Capability', accessor: s => s.captureCapability || 'None' },
      { header: 'Biometric Status', accessor: s => s.biometricStatus },
      { header: 'Enrolled Fingers', accessor: s => `${s.enrolledFingers}/10` },
      { header: 'Contact Email', accessor: s => s.contactEmail || '—' },
    ]);
    downloadCSV(csv, 'BCAMS_Staff_Registry.csv');
    toast.success('Staff registry exported');
  };

  const columns: DataTableColumn<Staff>[] = [
    {
      key: 'name',
      header: 'Staff Personnel',
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
              {s.isLecturer && (
                <Badge variant="outline" className="text-[10px] text-emerald-800 bg-emerald-50 border-emerald-300 font-medium">
                  Teaching Lecturer
                </Badge>
              )}
              {s.captureCapability === 'gate_capture' && (
                <Badge variant="outline" className="text-[10px] text-blue-800 bg-blue-50 border-blue-300 font-medium">
                  Gate Capturer
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{s.staffId}</p>
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
        <span className="text-xs font-medium text-foreground">{s.designation}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department / Unit',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (s) => (
        <span className="text-xs text-muted-foreground">{s.departmentName}</span>
      ),
    },
    {
      key: 'type',
      header: 'Classification',
      render: (s) => (
        <Badge variant={s.isLecturer ? 'default' : 'secondary'} className="text-[11px] capitalize">
          {s.isLecturer ? 'Academic Staff' : 'Non-Academic Staff'}
        </Badge>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (s) => (
        <span className="text-xs text-muted-foreground font-mono">
          {s.contactEmail || '—'}
        </span>
      ),
    },
    {
      key: 'biometric',
      header: 'Gate Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={s.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {s.enrolledFingers}/10
          </span>
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
        subtitle="Manage administrative and academic personnel identities. Super Administrator registry ownership."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            {canRegisterStaff(user) && (
              <Button
                size="sm"
                onClick={() => setIsRegisterModalOpen(true)}
                className="gap-1.5 bg-primary hover:bg-primary-600 text-white text-xs"
              >
                <Plus className="h-4 w-4" />
                Register Staff
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Domain Relationship Information Card */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <Users className="h-4 w-4 text-emerald-700 flex-shrink-0" />
            <span>
              <strong>Staff & Lecturer Relationship:</strong> All lecturers have an underlying Staff identity. Enrolled biometrics are shared seamlessly across class authorization and campus gate clocks.
            </span>
          </div>
          <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-white font-mono text-xs">
            Super Administrator Authority
          </Badge>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Staff
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{staff.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Teaching Lecturers
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {staff.filter(s => s.isLecturer).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Gate Authorized
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {staff.filter(s => s.biometricStatus === 'complete' || s.biometricStatus === 'activated').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <DoorOpen className="h-5 w-5" />
            </div>
          </div>
        </div>

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
            selectable={true}
            selectedIds={selectedStaffIds}
            onSelectionChange={setSelectedStaffIds}
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
    </div>
  );
}
