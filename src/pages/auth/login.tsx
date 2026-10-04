/**
 * BCAMS Login Page
 * 
 * Institutional authentication portal with:
 * - Quick role selection cards for development evaluation
 * - Credential-based sign-in form
 * - Biometric hardware authentication option
 * 
 * Design: Uses the same light, professional design language as
 * the operational dashboard — white surfaces, green primary accents,
 * card-based layout.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import {
  Fingerprint, ShieldCheck, KeyRound, Lock, Eye, EyeOff,
  GraduationCap, Users, Building2, ArrowRight, Wifi,
  CheckCircle2, Monitor, Loader2,
} from 'lucide-react';

interface RoleProfile {
  role: UserRole;
  capability?: 'session_capture' | 'gate_capture' | null;
  userId: string;
  name: string;
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const roleProfiles: RoleProfile[] = [
  {
    role: 'super_admin',
    userId: 'user-sa',
    name: 'Dr. Adebayo Ogundimu',
    title: 'Director of Academic Affairs',
    badge: 'Super Admin',
    description: 'Institution-wide scope — devices, policies, audit, all departments, and gate ledger oversight',
    icon: <ShieldCheck className="h-5 w-5" />,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    role: 'hod',
    userId: 'user-hod',
    name: 'Prof. Chidinma Okafor',
    title: 'Head of Department — Computer Science',
    badge: 'HOD',
    description: 'Department scope — students, lecturers, academic enrollment, and courses (no staff or gate access)',
    icon: <Building2 className="h-5 w-5" />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    role: 'lecturer',
    userId: 'user-lec',
    name: 'Dr. Emeka Nwosu',
    title: 'Senior Lecturer — CSC 201 & CSC 301',
    badge: 'Lecturer',
    description: 'Course scope — biometric session authorization and assigned course reports',
    icon: <Users className="h-5 w-5" />,
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
    description: 'Operational scope — creates sessions for eligible courses, operates scanner, self-attendance',
    icon: <GraduationCap className="h-5 w-5" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    role: 'staff',
    capability: 'gate_capture',
    userId: 'user-staff-capturer',
    name: 'Mr. Tunde Afolabi',
    title: 'Staff + Gate Capturer',
    badge: 'Gate Capturer',
    description: 'Operational scope — operates gate scanner for staff clock-in/out (9am-5pm + 60m grace)',
    icon: <Monitor className="h-5 w-5" />,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleRoleSelect = async (userId: string) => {
    setLoadingRole(userId);
    setIsSubmitting(true);
    await login(userId);
    setIsSubmitting(false);
    setLoadingRole(null);
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Default to super admin on form submit
    await login('user-sa');
    setIsSubmitting(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFBFC] flex flex-col select-none">
      {/* Header bar — matching app shell style */}
      <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Fingerprint className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              BCAMS Desktop
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Server Online</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Monitor className="h-3 w-3" />
            <span>Station DESK-CS-01</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-[960px] space-y-8">
          {/* Welcome section */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-medium mb-2">
              <CheckCircle2 className="h-3 w-3" />
              Desktop Terminal Ready
            </div>
            <h2 className="text-page-title text-foreground">
              Welcome to BCAMS
            </h2>
            <p className="text-body text-muted-foreground max-w-lg mx-auto">
              Select a role to explore the operational interface, or sign in with your institutional credentials.
            </p>
          </div>

          {/* Two-column layout: roles + login form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Role selection */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-label text-foreground">Quick Access — Select a Role</h3>
                <span className="text-helper text-muted-foreground">4 test accounts available</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleProfiles.map((p) => {
                  const isLoading = loadingRole === p.userId;
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => handleRoleSelect(p.userId)}
                      disabled={isSubmitting}
                      className={cn(
                        'group flex flex-col text-left p-4 rounded-lg border bg-white transition-all duration-150',
                        'hover:shadow-card-hover hover:border-primary-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        isLoading && 'border-primary bg-primary-50/30 shadow-card-hover',
                        !isLoading && 'border-border',
                        isSubmitting && !isLoading && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className={cn('p-2 rounded-lg transition-colors', p.iconBg)}>
                          <span className={p.iconColor}>{p.icon}</span>
                        </div>
                        <Badge variant="muted" className="text-[10px] font-medium capitalize">
                          {p.badge}
                        </Badge>
                      </div>

                      <p className="text-body-medium text-foreground group-hover:text-primary-700 transition-colors">
                        {p.name}
                      </p>
                      <p className="text-helper text-muted-foreground mt-0.5">
                        {p.title}
                      </p>

                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground leading-snug max-w-[200px]">
                          {p.description}
                        </p>
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 text-primary animate-spinner flex-shrink-0" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Sign-in form */}
            <div className="lg:col-span-5">
              <Card className="shadow-card">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-lg bg-primary-50">
                      <KeyRound className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Sign In</CardTitle>
                      <CardDescription className="text-xs">
                        Institutional credentials or cached offline access
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className="text-xs font-medium text-foreground block mb-1.5">
                        Email Address or Staff ID
                      </label>
                      <Input
                        id="login-email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@institution.edu.ng"
                        autoComplete="email"
                      />
                    </div>

                    <div>
                      <label htmlFor="login-password" className="text-xs font-medium text-foreground block mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-9"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spinner" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Sign In
                        </>
                      )}
                    </Button>

                    {/* Divider */}
                    <div className="relative my-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                          or use hardware
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRoleSelect('user-sa')}
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      <Fingerprint className="h-4 w-4 text-primary" />
                      Biometric Scanner Login
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Security info */}
              <div className="mt-4 space-y-2 px-1">
                <div className="flex items-center gap-2 text-helper text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                  <span>End-to-end encrypted authentication</span>
                </div>
                <div className="flex items-center gap-2 text-helper text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                  <span>Offline credential caching enabled</span>
                </div>
                <div className="flex items-center gap-2 text-helper text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                  <span>Biometric templates never stored locally</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between h-10 px-6 border-t border-border bg-white text-helper text-muted-foreground flex-shrink-0">
        <span>© 2026 BCAMS — Biometric Class Attendance Management System</span>
        <span className="font-mono text-[11px]">Desktop Frontend Client</span>
      </footer>
    </div>
  );
}
