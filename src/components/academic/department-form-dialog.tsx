/**
 * Department Creation Form Dialog
 * 
 * Zod-validated dialog for establishing new academic departments.
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
import type { Department } from '@/types';
import { Building2, AlertCircle } from 'lucide-react';

const departmentSchema = z.object({
  name: z.string().min(3, 'Department name must be at least 3 characters'),
  code: z
    .string()
    .min(2, 'Department code must be at least 2 characters')
    .max(8, 'Department code must not exceed 8 characters')
    .regex(/^[A-Z0-9]+$/i, 'Department code must be alphanumeric'),
  faculty: z.string().min(3, 'Faculty name is required'),
});

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (department: Department) => void;
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: DepartmentFormDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [faculty, setFaculty] = useState('Faculty of Computing & Informatics');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const validated = departmentSchema.parse({
        name,
        code: code.trim().toUpperCase(),
        faculty,
      });

      const newDept: Department = {
        id: `dept-${validated.code.toLowerCase()}`,
        name: validated.name,
        code: validated.code,
        faculty: validated.faculty,
        studentCount: 0,
        lecturerCount: 0,
        staffCount: 0,
        courseCount: 0,
      };

      onSubmit(newDept);
      setName('');
      setCode('');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>Add Academic Department</DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new university academic unit for students, lecturers, and courses.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Department Name *
              </label>
              <Input
                placeholder="e.g. Software Engineering"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Department Code *
                </label>
                <Input
                  placeholder="e.g. SEN"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={errors.code ? 'border-destructive' : ''}
                />
                {errors.code && (
                  <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.code}
                  </p>
                )}
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Faculty *
                </label>
                <Input
                  placeholder="Faculty Name"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className={errors.faculty ? 'border-destructive' : ''}
                />
                {errors.faculty && (
                  <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.faculty}
                  </p>
                )}
              </div>
            </div>
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
              {isSubmitting ? 'Creating...' : 'Create Department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
