/**
 * Lecturers Page — Linked to Staff Identities
 * 
 * FR-8.2: Lecturer registry, course assignments,
 * and biometric enrollment tracking.
 * Enforces:
 * - Direct relationship: Lecturer -> Underlying Staff Identity
 * - "Link Existing Staff" flow to prevent duplicate person creation
 * - Departmental scoping for HOD
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
import { canRegisterLecturer } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { Lecturer, Staff, Department, Course, LecturerAssignment } from '@/types';
import {
  Plus, Users, BookOpen, Link2, Search, Building2,
  GraduationCap, Download, CheckCircle2, UserCheck,
} from 'lucide-react';

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
  const [isLinkStaffModalOpen, setIsLinkStaffModalOpen] = useState(false);
  const [selectedStaffToLink, setSelectedStaffToLink] = useState('');
  const [selectedDeptForLink, setSelectedDeptForLink] = useState('');
  const [assignedCourseCode, setAssignedCourseCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);

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

  const handleExportCSV = () => {
    const csv = generateCSV(filteredLecturers, [
      { header: 'Staff ID', accessor: l => l.staffId },
      { header: 'Full Name', accessor: l => l.fullName },
      { header: 'Designation', accessor: l => l.designation || 'Lecturer' },
      { header: 'Department', accessor: l => l.departmentName },
      { header: 'Linked Staff ID', accessor: l => l.staffPersonId || 'STF-DIRECT' },
      { header: 'Assigned Courses', accessor: l => l.assignedCourses.map(c => c.courseCode).join(', ') },
      { header: 'Biometric Status', accessor: l => l.biometricStatus },
      { header: 'Contact Email', accessor: l => l.contactEmail || '—' },
    ]);
    downloadCSV(csv, 'BCAMS_Lecturers_Registry.csv');
    toast.success('Lecturers roster exported');
  };

  const columns: DataTableColumn<Lecturer>[] = [
    {
      key: 'name',
      header: 'Lecturer',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
            {l.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground text-xs">{l.fullName}</p>
              {l.designation && (
                <span className="text-[11px] text-muted-foreground font-medium">
                  ({l.designation})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground font-mono">{l.staffId}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0 rounded font-mono border border-emerald-200">
                Staff Identity Linked
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
        <span className="text-xs font-medium text-foreground">{l.departmentName}</span>
      ),
    },
    {
      key: 'courses',
      header: 'Assigned Courses',
      render: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.assignedCourses.length > 0 ? (
            l.assignedCourses.map((c) => (
              <Badge key={c.id || c.courseCode} variant="outline" className="font-mono text-xs gap-1 bg-muted/30">
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                {c.courseCode}
                {c.isPrimary && <span className="text-[9px] text-primary font-bold ml-0.5">• Primary</span>}
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
        <span className="text-xs text-muted-foreground font-mono">
          {l.contactEmail || '—'}
        </span>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (l) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={l.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {l.enrolledFingers}/10
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
        title="Lecturers Registry"
        subtitle="Manage faculty teaching personnel and course assignments. Underlying identity derived from Staff."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            {canRegisterLecturer(user) && (
              <>
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
        {/* Domain Relationship Information Card */}
        <div className="bg-slate-50 border border-border rounded-lg p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-800">
            <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
            <span>
              <strong>Unified Biometric Identity:</strong> Lecturers use their underlying Staff biometric credentials to biometrically authorize class sessions and clock in at campus security gates.
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {user?.role === 'hod' ? `Scope: ${user.departmentName}` : 'All Departments'}
          </Badge>
        </div>

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
            Displaying <strong className="text-foreground">{filteredLecturers.length}</strong> academic faculty
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

      {/* Link Existing Staff Dialog */}
      <Dialog open={isLinkStaffModalOpen} onOpenChange={setIsLinkStaffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-5 w-5 text-primary" />
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
    </div>
  );
}
