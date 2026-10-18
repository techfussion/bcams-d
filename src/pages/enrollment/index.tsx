/**
 * Biometric Enrollment Hub
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { cn } from '@/lib/utils';
import { HandDiagram } from '@/components/enrollment';
import { useToast } from '@/hooks';
import { useAuthStore } from '@/stores/auth-store';
import type { Student, Staff, FingerEnrollment, FingerPosition, ScannerState, BiometricEnrollmentStatus } from '@/types';
import { FINGER_LABELS, FINGER_POSITIONS, ENROLLMENT_TARGET, ENROLLMENT_ACTIVATION_MIN } from '@/types';
import {
  Fingerprint,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  CloudUpload,
} from 'lucide-react';

type PersonType = 'students' | 'staff';

export function EnrollmentPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore(s => s.user);

  const isSuperAdmin = user?.role === 'super_admin';
  const isHOD = user?.role === 'hod';
  const userDeptId = user?.departmentId;

  // Domain guard: only Super Admin and HOD can administer biometrics
  useEffect(() => {
    if (user && !isSuperAdmin && !isHOD) {
      if (user.captureCapability === 'session_capture') {
        navigate('/attendance/capture', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, isSuperAdmin, isHOD, navigate]);

  const [personType, setPersonType] = useState<PersonType>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scannerState, setScannerState] = useState<ScannerState>('disconnected');

  // Selected person for enrollment
  const [selectedPerson, setSelectedPerson] = useState<Student | Staff | null>(null);
  const [selectedPersonType, setSelectedPersonType] = useState<PersonType>('students');
  const [fingerEnrollments, setFingerEnrollments] = useState<FingerEnrollment[]>([]);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [scanningFinger, setScanningFinger] = useState<FingerPosition | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(0);

  useEffect(() => {
    const unsub = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => unsub();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const deptFilter = isSuperAdmin ? undefined : userDeptId;
      const [stuData, stfData] = await Promise.all([
        api.getStudents(deptFilter),
        api.getStaff(deptFilter),
      ]);
      setStudents(stuData);
      setStaffList(stfData);
    } catch {
      toast({
        title: 'Error Loading Data',
        description: 'Failed to retrieve scoped enrollment records.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userDeptId, isSuperAdmin]);

  const handleSelectPerson = async (person: Student | Staff, type: PersonType) => {
    setSelectedPerson(person);
    setSelectedPersonType(type);
    const enrollments = await api.getFingerEnrollments(person.id);
    setFingerEnrollments(enrollments);
    setEnrollDialogOpen(true);
    setScanFeedback(null);
  };

  const handleEnrollFinger = async (pos: FingerPosition) => {
    if (scanningFinger) return;
    setScanningFinger(pos);
    setScanFeedback(`Scanning ${FINGER_LABELS[pos]}... Place finger firmly on sensor.`);

    try {
      await scannerService.startCapture();
      const qualityScore = 88 + Math.floor(Math.random() * 10); // 88%–98% quality

      const updated = fingerEnrollments.map(f => {
        if (f.position === pos) {
          return {
            ...f,
            enrolled: true,
            enrolledAt: new Date().toISOString(),
            quality: qualityScore,
          };
        }
        return f;
      });

      setFingerEnrollments(updated);
      setScanFeedback(`${FINGER_LABELS[pos]} captured successfully!`);
    } catch {
      setScanFeedback(`Scanner communication error on ${FINGER_LABELS[pos]}.`);
    } finally {
      setScanningFinger(null);
    }
  };

  const handleResetFingers = () => {
    const reset = FINGER_POSITIONS.map(pos => ({
      position: pos,
      label: FINGER_LABELS[pos],
      enrolled: false,
    }));
    setFingerEnrollments(reset);
    setScanFeedback('Biometric fingers reset. Please capture at least 4 fingers for activation.');
  };

  const handleSaveEnrollment = async () => {
    if (!selectedPerson) return;
    const enrolledCount = fingerEnrollments.filter(f => f.enrolled).length;
    let newStatus: BiometricEnrollmentStatus = 'not_enrolled';
    if (enrolledCount >= ENROLLMENT_TARGET) {
      newStatus = 'complete';
    } else if (enrolledCount >= ENROLLMENT_ACTIVATION_MIN) {
      newStatus = 'activated';
    } else if (enrolledCount > 0) {
      newStatus = 'partial';
    }

    try {
      if (selectedPersonType === 'students') {
        await api.updateStudent(selectedPerson.id, {
          enrolledFingers: enrolledCount,
          biometricStatus: newStatus,
        });
        setStudents(prev => prev.map(s => s.id === selectedPerson.id ? { ...s, enrolledFingers: enrolledCount, biometricStatus: newStatus } : s));
      } else {
        await api.updateStaff(selectedPerson.id, {
          enrolledFingers: enrolledCount,
          biometricStatus: newStatus,
        });
        setStaffList(prev => prev.map(st => st.id === selectedPerson.id ? { ...st, enrolledFingers: enrolledCount, biometricStatus: newStatus } : st));
      }

      setOfflinePendingCount(prev => prev + 1);

      toast({
        title: 'Biometric Enrollment Saved',
        description: `${selectedPerson.fullName}: ${enrolledCount}/10 fingers enrolled (${newStatus.replace('_', ' ')}). Shared identity synchronized.`,
        variant: 'success',
      });
      setEnrollDialogOpen(false);
    } catch {
      toast({
        title: 'Save Failed',
        description: 'Could not persist biometric enrollment profile.',
        variant: 'destructive',
      });
    }
  };

  const enrolledCount = fingerEnrollments.filter(f => f.enrolled).length;
  const isActivated = enrolledCount >= ENROLLMENT_ACTIVATION_MIN;
  const isComplete = enrolledCount >= ENROLLMENT_TARGET;
  const progressPercent = (enrolledCount / ENROLLMENT_TARGET) * 100;

  // Active dataset derived strictly by active tab (Students vs Staff)
  const activeScopedList = useMemo(() => {
    return personType === 'students' ? students : staffList;
  }, [personType, students, staffList]);

  // Status counts strictly scoped to the active tab's entity type
  const filterCounts = useMemo(() => {
    return {
      all: activeScopedList.length,
      not_enrolled: activeScopedList.filter(p => p.biometricStatus === 'not_enrolled').length,
      partial: activeScopedList.filter(p => p.biometricStatus === 'partial').length,
      activated: activeScopedList.filter(p => p.biometricStatus === 'activated').length,
      complete: activeScopedList.filter(p => p.biometricStatus === 'complete').length,
    };
  }, [activeScopedList]);

  // Filtered dataset for the active tab (guarantees student and staff records never mix)
  const currentFilteredData = useMemo(() => {
    if (activeFilter === 'all') return activeScopedList;
    return activeScopedList.filter(p => p.biometricStatus === activeFilter);
  }, [activeScopedList, activeFilter]);

  // Student Columns
  const studentColumns: DataTableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student Personnel',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3">
          <div>
            <p className="font-semibold text-foreground text-xs">{s.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.matricNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'programme',
      header: 'Programme & Department',
      render: (s) => (
        <div>
          <span className="text-xs font-medium text-foreground">{s.programme}</span>
          <p className="text-[11px] text-muted-foreground">{s.departmentName} • {s.level}L</p>
        </div>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={s.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {s.enrolledFingers}/{ENROLLMENT_TARGET}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (s) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleSelectPerson(s, 'students'); }}
          className="gap-1.5 shadow-sm text-xs"
        >
          <Fingerprint className="h-3.5 w-3.5 text-primary" />
          {s.enrolledFingers > 0 ? 'Manage Fingers' : 'Enroll Fingers'}
        </Button>
      ),
    },
  ];

  // Staff Columns
  const staffColumns: DataTableColumn<Staff>[] = [
    {
      key: 'name',
      header: 'Staff Personnel',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (st) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
            {st.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-foreground text-xs">{st.fullName}</p>
              {st.isHOD && (
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                  HOD
                </Badge>
              )}
              {st.isLecturer && (
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Lecturer
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{st.staffId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Role & Scope',
      render: (st) => (
        <div>
          <span className="text-xs font-medium text-foreground">{st.designation}</span>
          <p className="text-[11px] text-muted-foreground">{st.departmentName}</p>
        </div>
      ),
    },
    {
      key: 'biometric',
      header: 'Biometric Status (Shared Identity)',
      render: (st) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={st.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {st.enrolledFingers}/{ENROLLMENT_TARGET}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (st) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleSelectPerson(st, 'staff'); }}
          className="gap-1.5 shadow-sm text-xs"
        >
          <Fingerprint className="h-3.5 w-3.5 text-primary" />
          {st.enrolledFingers > 0 ? 'Manage Fingers' : 'Enroll Fingers'}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Biometric Enrollment Station"
        actions={
          <div className="flex items-center gap-3">
            {offlinePendingCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CloudUpload className="h-3.5 w-3.5 text-blue-600" />
                {offlinePendingCount} Local Changes
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 animate-fadeIn">
          {/* Person Type Selector Tabs */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Button
                variant={personType === 'students' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setPersonType('students'); setActiveFilter('all'); }}
                className="gap-2 text-xs"
              >
                <GraduationCap className="h-4 w-4" />
                Students ({students.length})
              </Button>
              <Button
                variant={personType === 'staff' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setPersonType('staff'); setActiveFilter('all'); }}
                className="gap-2 text-xs"
              >
                <Briefcase className="h-4 w-4" />
                Staff Personnel ({staffList.length})
              </Button>
            </div>

            {/* Filter Pills with Active Tab Scoped Counts */}
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All', count: filterCounts.all },
                { id: 'not_enrolled', label: 'Not Enrolled', count: filterCounts.not_enrolled },
                { id: 'partial', label: 'Partial (<4)', count: filterCounts.partial },
                { id: 'activated', label: 'Activated (≥4)', count: filterCounts.activated },
                { id: 'complete', label: 'Complete (10/10)', count: filterCounts.complete },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    activeFilter === tab.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeFilter === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-background/80 text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tables */}
          {personType === 'students' ? (
            <DataTable
              columns={studentColumns}
              data={currentFilteredData as Student[]}
              isLoading={isLoading}
              searchPlaceholder="Search student by name, matric number, or programme..."
              searchFn={(s, q) =>
                s.fullName.toLowerCase().includes(q) ||
                s.matricNumber.toLowerCase().includes(q) ||
                s.programme.toLowerCase().includes(q)
              }
              getRowId={(s) => s.id}
              emptyTitle="No students found"
              emptyDescription="No students match the current enrollment criteria or department scope."
            />
          ) : (
            <DataTable
              columns={staffColumns}
              data={currentFilteredData as Staff[]}
              isLoading={isLoading}
              searchPlaceholder="Search staff by name, staff ID, or designation..."
              searchFn={(st, q) =>
                st.fullName.toLowerCase().includes(q) ||
                st.staffId.toLowerCase().includes(q) ||
                st.designation.toLowerCase().includes(q)
              }
              getRowId={(st) => st.id}
              emptyTitle="No staff members found"
              emptyDescription="No staff members match the current enrollment criteria or department scope."
            />
          )}
        </div>
      </div>

      {/* Interactive 10-Finger Biometric Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-2xl bg-card rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              Biometric Fingerprint Enrollment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedPerson && selectedPersonType === 'students' ? (
                <span>
                  Candidate: <strong>{selectedPerson.fullName}</strong> ({'matricNumber' in selectedPerson ? selectedPerson.matricNumber : ''}) — {'programme' in selectedPerson ? selectedPerson.programme : ''}
                </span>
              ) : selectedPerson && (
                <span>
                  Staff Candidate: <strong>{selectedPerson.fullName}</strong> ({'staffId' in selectedPerson ? selectedPerson.staffId : ''}) — {'designation' in selectedPerson ? selectedPerson.designation : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Feedback Banner */}
            {scanFeedback && (
              <div className="p-3 rounded-lg border border-primary-200 bg-primary-50 text-xs font-semibold text-primary-900 flex items-center gap-2 animate-fadeIn">
                {scanFeedback}
              </div>
            )}

            {/* Shared Identity Context Banner for Staff */}
            {selectedPersonType === 'staff' && (
              <div className="p-3 rounded-xl border border-purple-200 bg-purple-50 text-xs text-purple-900 flex items-start gap-2.5">
                <div>
                  <p className="font-semibold">Shared Institutional Biometric Identity</p>
                  <p className="text-[11px] text-purple-800">
                    Enrolled biometric templates automatically authorize staff gate clock-in/out, lecturer class authorization, and administrative departmental verifications.
                  </p>
                </div>
              </div>
            )}

            {/* Progress Bar & Badges */}
            <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">
                  {enrolledCount} / {ENROLLMENT_TARGET} Fingers Enrolled
                </span>
                {isComplete ? (
                  <Badge variant="success" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> 10/10 Complete Profile
                  </Badge>
                ) : isActivated ? (
                  <Badge variant="success" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> Activated (≥4 Min Threshold)
                  </Badge>
                ) : (
                  <span className="text-[11px] text-amber-700 font-medium">
                    Need at least {ENROLLMENT_ACTIVATION_MIN - enrolledCount} more finger(s) for activation
                  </span>
                )}
              </div>
              <Progress
                value={progressPercent}
                indicatorClassName={cn(
                  isComplete
                    ? 'bg-emerald-600'
                    : isActivated
                      ? 'bg-primary'
                      : 'bg-amber-500'
                )}
              />
            </div>

            {/* Hands Visual Layout */}
            <HandDiagram
              enrollments={fingerEnrollments}
              scanningFinger={scanningFinger}
              onSelectFinger={handleEnrollFinger}
            />

            {/* Quick Actions */}
            <div className="flex items-center justify-start p-3 rounded-lg border border-border bg-muted/20 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFingers}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Enrollment
              </Button>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveEnrollment}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Save Biometric Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
