/**
 * Person Registration Form Dialog
 * 
 * Zod-validated registration modal for Students, Lecturers, and Non-Academic Staff.
 * Complies with BCAMS identity schema and department assignments.
 */
import React, { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Department, Student, Lecturer, Staff } from '@/types';
import { UserPlus, AlertCircle } from 'lucide-react';

const studentSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  matricNumber: z
    .string()
    .min(5, 'Matric number is required')
    .regex(/^[A-Z0-9\/\-]+$/i, 'Invalid matric number format (e.g. FCP/CSC/21/1001)'),
  email: z.string().email('Please enter a valid institutional email address'),
  phone: z.string().optional(),
  departmentId: z.string().min(1, 'Please select a department'),
  programme: z.string().min(2, 'Degree programme is required'),
  level: z.number().int().min(100).max(600),
});

const staffSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  staffNumber: z
    .string()
    .min(3, 'Staff identification number is required')
    .regex(/^[A-Z0-9\/\-]+$/i, 'Invalid staff number format (e.g. STF-CS-001)'),
  email: z.string().email('Please enter a valid institutional email address'),
  phone: z.string().optional(),
  departmentId: z.string().min(1, 'Please select a department'),
  designation: z.string().min(2, 'Designation / Rank is required'),
});

type PersonType = 'student' | 'lecturer' | 'staff';

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personType: PersonType;
  departments: Department[];
  onSubmitStudent?: (student: Student) => void;
  onSubmitLecturer?: (lecturer: Lecturer) => void;
  onSubmitStaff?: (staff: Staff) => void;
}

export function PersonFormDialog({
  open,
  onOpenChange,
  personType,
  departments,
  onSubmitStudent,
  onSubmitLecturer,
  onSubmitStaff,
}: PersonFormDialogProps) {
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState(''); // matricNumber or staffNumber
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [programme, setProgramme] = useState('');
  const [level, setLevel] = useState<number>(300);
  const [designation, setDesignation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFullName('');
    setIdentifier('');
    setEmail('');
    setPhone('');
    setProgramme('');
    setDesignation('');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const dept = departments.find((d) => d.id === departmentId);
      const departmentName = dept ? dept.name : 'Computer Science';

      if (personType === 'student') {
        const validated = studentSchema.parse({
          fullName,
          matricNumber: identifier,
          email,
          phone: phone || undefined,
          departmentId,
          programme: programme || `${departmentName}`,
          level,
        });

        const now = new Date().toISOString();
        const newStudent: Student = {
          id: `stu-${Date.now().toString().slice(-4)}`,
          fullName: validated.fullName,
          specializations: ['student'],
          matricNumber: validated.matricNumber.toUpperCase(),
          departmentId: validated.departmentId,
          departmentName,
          programme: validated.programme,
          level: validated.level,
          biometricStatus: 'not_enrolled',
          enrolledFingers: 0,
          status: 'active',
          academicSession: '2025/2026',
          courseEnrollments: [],
          createdAt: now,
          updatedAt: now,
        };

        onSubmitStudent?.(newStudent);
      } else if (personType === 'lecturer') {
        const validated = staffSchema.parse({
          fullName,
          staffNumber: identifier,
          email,
          phone: phone || undefined,
          departmentId,
          designation: designation || 'Senior Lecturer',
        });

        const now = new Date().toISOString();
        const newLecturer: Lecturer = {
          id: `lec-${Date.now().toString().slice(-4)}`,
          fullName: validated.fullName,
          specializations: ['lecturer'],
          staffId: validated.staffNumber.toUpperCase(),
          contactEmail: validated.email,
          contactPhone: validated.phone,
          departmentId: validated.departmentId,
          departmentName,
          biometricStatus: 'not_enrolled',
          enrolledFingers: 0,
          assignedCourses: [],
          createdAt: now,
          updatedAt: now,
        };

        onSubmitLecturer?.(newLecturer);
      } else {
        const validated = staffSchema.parse({
          fullName,
          staffNumber: identifier,
          email,
          phone: phone || undefined,
          departmentId,
          designation: designation || 'Administrative Officer',
        });

        const now = new Date().toISOString();
        const newStaff: Staff = {
          id: `stf-${Date.now().toString().slice(-4)}`,
          fullName: validated.fullName,
          specializations: ['staff'],
          staffId: validated.staffNumber.toUpperCase(),
          designation: validated.designation,
          contactEmail: validated.email,
          contactPhone: validated.phone,
          departmentId: validated.departmentId,
          departmentName,
          biometricStatus: 'not_enrolled',
          enrolledFingers: 0,
          createdAt: now,
          updatedAt: now,
        };

        onSubmitStaff?.(newStaff);
      }

      resetForm();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[String(e.path[0])] = e.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles = {
    student: 'Register New Student',
    lecturer: 'Register New Lecturer',
    staff: 'Register Non-Academic Staff',
  };

  const descriptions = {
    student: 'Enroll an undergraduate or postgraduate student into academic registries.',
    lecturer: 'Onboard academic personnel for course assignments and session authorizations.',
    staff: 'Register administrative or support staff for attendance tracking.',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>{titles[personType]}</DialogTitle>
                <DialogDescription className="text-xs">
                  {descriptions[personType]}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            {/* Full Name */}
            <div>
              <label className="font-medium text-foreground block mb-1">
                Full Name *
              </label>
              <Input
                placeholder="e.g. Adebayo Babatunde"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && (
                <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Identifier & Email Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  {personType === 'student' ? 'Matric Number *' : 'Staff ID Number *'}
                </label>
                <Input
                  placeholder={
                    personType === 'student'
                      ? 'FCP/CSC/21/1089'
                      : 'STF-CS-042'
                  }
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={
                    (personType === 'student' ? errors.matricNumber : errors.staffNumber)
                      ? 'border-destructive'
                      : ''
                  }
                />
                {(personType === 'student' ? errors.matricNumber : errors.staffNumber) && (
                  <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {personType === 'student' ? errors.matricNumber : errors.staffNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Institutional Email *
                </label>
                <Input
                  type="email"
                  placeholder="name@university.edu.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="font-medium text-foreground block mb-1">
                Department *
              </label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student-specific: Programme & Level */}
            {personType === 'student' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground block mb-1">
                    Degree Programme
                  </label>
                  <Input
                    placeholder="B.Sc. Computer Science"
                    value={programme}
                    onChange={(e) => setProgramme(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground block mb-1">
                    Academic Level
                  </label>
                  <Select
                    value={String(level)}
                    onValueChange={(v) => setLevel(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 Level</SelectItem>
                      <SelectItem value="200">200 Level</SelectItem>
                      <SelectItem value="300">300 Level</SelectItem>
                      <SelectItem value="400">400 Level</SelectItem>
                      <SelectItem value="500">500 Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Staff/Lecturer-specific: Designation */}
            {personType !== 'student' && (
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Designation / Academic Rank *
                </label>
                <Input
                  placeholder={
                    personType === 'lecturer'
                      ? 'e.g. Senior Lecturer / Associate Professor'
                      : 'e.g. Higher Executive Officer'
                  }
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className={errors.designation ? 'border-destructive' : ''}
                />
                {errors.designation && (
                  <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.designation}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
