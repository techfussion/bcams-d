/**
 * Course Creation Form Dialog
 * 
 * Zod-validated dialog for establishing new institutional courses.
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
import type { Course, Department } from '@/types';
import { BookOpen, AlertCircle } from 'lucide-react';

const courseSchema = z.object({
  code: z
    .string()
    .min(3, 'Course code is required')
    .regex(/^[A-Z]{3}\s?[0-9]{3}$/i, 'Course code format should be e.g. CSC 301'),
  title: z.string().min(3, 'Course title must be at least 3 characters'),
  creditUnits: z.number().int().min(1).max(6),
  departmentId: z.string().min(1, 'Please select a department'),
  level: z.number().int().min(100).max(600),
  semester: z.enum(['harmattan', 'rain']),
});

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  onSubmit: (course: Course) => void;
}

export function CourseFormDialog({
  open,
  onOpenChange,
  departments,
  onSubmit,
}: CourseFormDialogProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [creditUnits, setCreditUnits] = useState(3);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [level, setLevel] = useState(300);
  const [semester, setSemester] = useState<'harmattan' | 'rain'>('harmattan');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const validated = courseSchema.parse({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        creditUnits,
        departmentId,
        level,
        semester,
      });

      const dept = departments.find((d) => d.id === validated.departmentId);

      const newCourse: Course = {
        id: `crs-${validated.code.replace(/\s+/g, '').toLowerCase()}`,
        code: validated.code,
        title: validated.title,
        creditUnits: validated.creditUnits,
        departmentId: validated.departmentId,
        departmentName: dept?.name || 'Computer Science',
        level: validated.level,
        semester: validated.semester === 'harmattan' ? 1 : 2,
        isGeneral: false,
      };

      onSubmit(newCourse);
      setCode('');
      setTitle('');
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>Add New Course</DialogTitle>
                <DialogDescription className="text-xs">
                  Register a curriculum course with credit weighting and semester assignment.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="font-medium text-foreground block mb-1">
                  Course Code *
                </label>
                <Input
                  placeholder="CSC 305"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={errors.code ? 'border-destructive' : ''}
                />
                {errors.code && (
                  <p className="text-destructive text-[10px] mt-1">
                    {errors.code}
                  </p>
                )}
              </div>

              <div className="col-span-2">
                <label className="font-medium text-foreground block mb-1">
                  Course Title *
                </label>
                <Input
                  placeholder="e.g. Operating Systems Architecture"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && (
                  <p className="text-destructive text-[10px] mt-1">
                    {errors.title}
                  </p>
                )}
              </div>
            </div>

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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Credit Units
                </label>
                <Select
                  value={String(creditUnits)}
                  onValueChange={(v) => setCreditUnits(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Unit</SelectItem>
                    <SelectItem value="2">2 Units</SelectItem>
                    <SelectItem value="3">3 Units</SelectItem>
                    <SelectItem value="4">4 Units</SelectItem>
                    <SelectItem value="6">6 Units</SelectItem>
                  </SelectContent>
                </Select>
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

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Semester
                </label>
                <Select
                  value={semester}
                  onValueChange={(v) => setSemester(v as 'harmattan' | 'rain')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="harmattan">Harmattan (1st)</SelectItem>
                    <SelectItem value="rain">Rain (2nd)</SelectItem>
                  </SelectContent>
                </Select>
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
              {isSubmitting ? 'Creating...' : 'Create Course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
