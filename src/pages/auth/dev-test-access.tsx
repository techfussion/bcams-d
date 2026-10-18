/**
 * BCAMS Development & Test Access Component
 * 
 * Isolated test/developer role switcher component for quick evaluation.
 * Kept strictly isolated from the production authentication flow so it
 * can be safely decommissioned or removed without altering the login UX.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import {
  ShieldCheck, Users, Building2, GraduationCap,
  ArrowRight, Loader2, FlaskConical, AlertCircle,
} from 'lucide-react';

export interface TestRoleProfile {
  role: UserRole;
  capability?: 'session_capture' | null;
  userId: string;
  name: string;
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

export const TEST_ROLE_PROFILES: TestRoleProfile[] = [
  {
    role: 'super_admin',
    userId: 'user-sa',
    name: 'Dr. Adebayo Ogundimu',
    title: 'Director of Academic Affairs',
    badge: 'Super Admin',
    description: 'Institution-wide scope — all departments, all staff, all students, devices, policies, audit, and gate oversight',
    icon: <ShieldCheck className="h-4 w-4" />,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    role: 'hod',
    userId: 'user-hod',
    name: 'Prof. Chidinma Okafor',
    title: 'HOD — Computer Science & Senior Lecturer',
    badge: 'HOD CS',
    description: 'CS Department scope — CS students, CS staff & lecturers, courses, teaching assignments',
    icon: <Building2 className="h-4 w-4" />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    role: 'hod',
    userId: 'user-hod-it',
    name: 'Dr. Babatunde Raji',
    title: 'HOD — Information Technology',
    badge: 'HOD IT',
    description: 'IT Department scope — IT students, IT staff & lecturers, and curriculum',
    icon: <Building2 className="h-4 w-4" />,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
  },
  {
    role: 'hod',
    userId: 'user-hod-bus',
    name: 'Prof. Aliyu Mohammed',
    title: 'HOD — Business Administration',
    badge: 'HOD BUS',
    description: 'Business Admin scope — Business students, staff, lecturers, and courses',
    icon: <Building2 className="h-4 w-4" />,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    role: 'lecturer',
    userId: 'user-lec',
    name: 'Dr. Emeka Nwosu',
    title: 'Senior Lecturer — CSC 201 & CSC 301',
    badge: 'Lecturer',
    description: 'Course scope — biometric session authorization and assigned course teaching reports',
    icon: <Users className="h-4 w-4" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    role: 'student',
    capability: 'session_capture',
    userId: 'user-stu-capturer',
    name: 'Amina Ibrahim',
    title: 'Student + Session Capturer',
    badge: 'Session Capturer',
    description: 'Operational scope — lands directly in Session Capture, operates scanner, self-attendance, closes session',
    icon: <GraduationCap className="h-4 w-4" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
];

interface DevTestAccessProps {
  onSelectRole: (userId: string) => void;
  loadingRole: string | null;
  disabled?: boolean;
}

export function DevTestAccess({ onSelectRole, loadingRole, disabled }: DevTestAccessProps) {
  return (
    <div className="w-full rounded-xl border border-dashed border-amber-300/80 bg-amber-50/30 p-5 space-y-4">
      {/* Dev Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-amber-200/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-100 text-amber-800">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-amber-950 uppercase tracking-wider">
                Development / Test Access
              </h3>
              <Badge variant="outline" className="bg-amber-100/60 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                Evaluation Mode
              </Badge>
            </div>
            <p className="text-[11px] text-amber-800/80 mt-0.5">
              Quickly enter the application with pre-configured personas to test role-specific workflows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-amber-800/70">
          <AlertCircle className="h-3 w-3" />
          <span>Non-production convenience</span>
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {TEST_ROLE_PROFILES.map((p) => {
          const isLoading = loadingRole === p.userId;
          return (
            <button
              key={p.userId}
              type="button"
              onClick={() => onSelectRole(p.userId)}
              disabled={disabled}
              className={cn(
                'group flex flex-col text-left p-3 rounded-lg border bg-white transition-all duration-150',
                'hover:shadow-sm hover:border-primary-300 hover:bg-slate-50/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isLoading && 'border-primary bg-primary-50/30 shadow-sm',
                !isLoading && 'border-border/80',
                disabled && !isLoading && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={cn('p-1.5 rounded-md transition-colors', p.iconBg)}>
                  <span className={p.iconColor}>{p.icon}</span>
                </div>
                <Badge variant="muted" className="text-[9px] font-medium capitalize">
                  {p.badge}
                </Badge>
              </div>

              <p className="text-xs font-semibold text-foreground group-hover:text-primary-700 transition-colors truncate w-full">
                {p.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                {p.title}
              </p>

              <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between w-full">
                <p className="text-[10px] text-muted-foreground line-clamp-1 pr-2">
                  {p.description}
                </p>
                {isLoading ? (
                  <Loader2 className="h-3 w-3 text-primary animate-spinner flex-shrink-0" />
                ) : (
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
