/**
 * Academia — Student Session Capturers Tab
 * 
 * Capability assignment and revocation for Student Session Capturers.
 * Reflects assignment consistently across linked Student and User records
 * while strictly preserving undergraduate identity, courses, and academic history.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/api';
import { useToast } from '@/hooks';
import type { Student, Department } from '@/types';
import {
  Fingerprint, UserCheck, UserX, Search,
  Plus, CheckCircle2, AlertCircle, GraduationCap,
  Building2, ShieldCheck,
} from 'lucide-react';

interface CapturersTabProps {
  students: Student[];
  departments: Department[];
  onRefresh: () => Promise<void>;
}

export function CapturersTab({ students, departments, onRefresh }: CapturersTabProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Assign modal state
  const [assignSearch, setAssignSearch] = useState('');
  const [assignDeptFilter, setAssignDeptFilter] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Revoke modal state
  const [studentToRevoke, setStudentToRevoke] = useState<Student | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Current session capturers
  const designatedCapturers = students.filter(
    (s) => s.captureCapability === 'session_capture'
  );

  const filteredCapturers = designatedCapturers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.matricNumber.toLowerCase().includes(q) ||
      s.departmentName.toLowerCase().includes(q)
    );
  });

  // Eligible students for assignment (not graduated, withdrawn, or suspended, and not already a capturer)
  const eligibleStudents = students.filter((s) => {
    const status = s.lifecycleStatus || s.status || 'active';
    const isInactive = status === 'graduated' || status === 'withdrawn' || status === 'suspended';
    const alreadyCapturer = s.captureCapability === 'session_capture';
    if (isInactive || alreadyCapturer) return false;

    if (assignDeptFilter !== 'all' && s.departmentId !== assignDeptFilter) return false;

    if (assignSearch) {
      const q = assignSearch.toLowerCase();
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.matricNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const handleAssignCapturer = async () => {
    if (!selectedStudentId) return;
    setIsAssigning(true);
    try {
      const res = await api.assignSessionCapturer(selectedStudentId, true);
      toast({
        title: 'Capability Assigned',
        description: `${res.student.fullName} (${res.student.matricNumber}) is now designated as Session Capturer.`,
        variant: 'success',
      });
      setIsAssignModalOpen(false);
      setSelectedStudentId('');
      setAssignSearch('');
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Assignment Error',
        description: err?.message || 'Failed to assign session capturer capability',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRevokeCapturer = async () => {
    if (!studentToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await api.assignSessionCapturer(studentToRevoke.id, false);
      toast({
        title: 'Capability Revoked',
        description: `Session Capturer capability removed from ${res.student.fullName}. Student identity and academic records preserved.`,
        variant: 'success',
      });
      setStudentToRevoke(null);
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Revocation Error',
        description: err?.message || 'Failed to revoke session capturer capability',
        variant: 'destructive',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search designated session capturers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setIsAssignModalOpen(true);
            setSelectedStudentId('');
            setAssignSearch('');
          }}
          className="gap-1.5 shadow-sm text-xs bg-primary text-white"
        >
          <Plus className="h-4 w-4" />
          Designate Session Capturer
        </Button>
      </div>

      {/* Capturers Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground">
              Active Student Session Capturers ({filteredCapturers.length})
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Authorizes classroom scanner operation & session self-attendance
          </span>
        </div>

        {filteredCapturers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Fingerprint className="h-8 w-8 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium text-foreground">No Session Capturers Found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? 'No designated capturers match your search query.'
                : 'No students currently hold the Session Capturer capability. Click "Designate Session Capturer" to assign an eligible student.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Matriculation No.</th>
                  <th className="py-3 px-4">Department & Level</th>
                  <th className="py-3 px-4">Biometric Status</th>
                  <th className="py-3 px-4">Capability</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCapturers.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground flex items-center gap-2.5">
                      <span>{student.fullName}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {student.matricNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-foreground">{student.departmentName}</span>
                      <span className="text-muted-foreground block text-[11px]">
                        Level {student.currentLevel || student.level || 100}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {student.biometricStatus === 'complete' ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          Complete ({student.enrolledFingers}/10)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Activated ({student.enrolledFingers}/10)
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold gap-1">
                        <Fingerprint className="h-3 w-3" /> Session Capturer
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStudentToRevoke(student)}
                        className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
                      >
                        <UserX className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Designate Session Capturer Dialog */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Designate Student Session Capturer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an active undergraduate student to grant classroom attendance capture capability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Search & Department Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Search Registry
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Name or matric number..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Filter Department
                </label>
                <Select value={assignDeptFilter} onValueChange={setAssignDeptFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 text-xs">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Student Picker List */}
            <div>
              <label className="text-[11px] font-medium text-foreground block mb-1.5">
                Eligible Students ({eligibleStudents.length})
              </label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                {eligibleStudents.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-xs">
                    No eligible students match filter criteria.
                  </div>
                ) : (
                  eligibleStudents.slice(0, 30).map((s) => {
                    const isSelected = selectedStudentId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStudentId(s.id)}
                        className={`w-full text-left p-2.5 flex items-center justify-between text-xs transition-colors ${isSelected ? 'bg-primary-50 text-primary-900 font-medium' : 'hover:bg-slate-50 text-foreground'
                          }`}
                      >
                        <div>
                          <div className="font-semibold">{s.fullName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {s.matricNumber} • {s.departmentName} (Lvl {s.currentLevel || s.level || 100})
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Student Preview */}
            {selectedStudent && (
              <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Selected Candidate: {selectedStudent.fullName}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800">
                  <div>Matric No: <span className="font-mono font-medium">{selectedStudent.matricNumber}</span></div>
                  <div>Department: <span className="font-medium">{selectedStudent.departmentName}</span></div>
                  <div>Level: <span className="font-medium">{selectedStudent.currentLevel || selectedStudent.level || 100}</span></div>
                  <div>Biometrics: <span className="font-medium">{selectedStudent.biometricStatus}</span></div>
                </div>
              </div>
            )}

            {/* Policy Notice */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-muted-foreground text-[11px] space-y-1">
              <p className="font-semibold text-foreground">Operational Rule:</p>
              <p>• Assigned students are directed to the session capture workspace upon login.</p>
              <p>• The student retains their normal academic status, enrollment, and course examinations.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAssignCapturer}
              disabled={isAssigning || !selectedStudentId}
              className="bg-primary text-white"
            >
              {isAssigning ? 'Designating...' : 'Confirm Designation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Capability Confirmation Modal */}
      <Dialog open={Boolean(studentToRevoke)} onOpenChange={(open) => !open && setStudentToRevoke(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Revoke Session Capturer Capability</DialogTitle>
            <DialogDescription className="text-xs">
              Revoke attendance capture permissions from {studentToRevoke?.fullName}?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground space-y-2">
            <p>
              Student: <strong className="text-foreground">{studentToRevoke?.fullName}</strong> ({studentToRevoke?.matricNumber})
            </p>
            <p className="text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
              The student will immediately return to standard student privileges. All undergraduate academic history, enrollments, and prior captured sessions are preserved.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setStudentToRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevokeCapturer}
              disabled={isRevoking}
            >
              {isRevoking ? 'Revoking...' : 'Revoke Capability'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
