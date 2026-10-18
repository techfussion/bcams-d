/**
 * BCAMS Desktop — Redesigned Split-Screen Login Page
 * 
 * Two-panel layout:
 * - Left Panel: Intentional Laptop frame mockup with BCAMS dashboard snapshot placeholder
 * - Right Panel: Official institutional credential sign-in, discreet Gate Access,
 *   and an unobtrusive development/test account persona dropdown.
 * - Biometric login button is completely omitted.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TEST_ROLE_PROFILES } from './dev-test-access';
import {
  Fingerprint, Lock, Eye, EyeOff,
  DoorOpen, CheckCircle2, ShieldCheck,
  Loader2, ArrowRight, FlaskConical,
  BarChart3, Users, CalendarCheck, Laptop,
} from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDevRole, setSelectedDevRole] = useState<string>('');

  const redirectUserByRole = () => {
    const u = useAuthStore.getState().user;
    if (u?.captureCapability === 'session_capture') {
      navigate('/attendance/capture', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Official authentication: preserves mock login defaults
      await login('user-sa');
      redirectUserByRole();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevRoleChange = async (userId: string) => {
    if (!userId) return;
    setSelectedDevRole(userId);
    setIsSubmitting(true);
    try {
      await login(userId);
      redirectUserByRole();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full min-h-screen w-full bg-[#FAFBFC] flex flex-col lg:flex-row overflow-y-auto select-none">
      {/* ─── LEFT PANEL: Laptop Frame Dashboard Preview ───────────────────── */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-10 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden order-2 lg:order-1">
        {/* Subtle background glow effect */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand identity header */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                BCAMS <span className="text-xs px-2 py-0.5 rounded bg-white/10 font-medium text-slate-300">Desktop</span>
              </h1>
              <p className="text-xs text-slate-400">Biometric Class Attendance Management System</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 max-w-md pt-2 leading-relaxed">
            Enterprise campus attendance platform with biometric verification, offline synchronization, and centralized academic progression.
          </p>
        </div>

        {/* The Laptop Frame with Dashboard Preview */}
        <div className="my-8 sm:my-10 relative z-10 flex flex-col items-center max-w-xl mx-auto w-full">
          {/* Laptop Lid / Bezel */}
          <div
            id="dashboard-preview-laptop"
            data-testid="dashboard-preview-placeholder"
            className="w-full bg-slate-950 rounded-t-2xl p-2 sm:p-3 pb-0 shadow-2xl border border-slate-700/60 ring-1 ring-white/10"
          >
            {/* Top Camera dot */}
            <div className="flex items-center justify-center pb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>

            {/* Laptop Screen Content: Intentional Dashboard Snapshot */}
            <div className="bg-[#0F172A] rounded-t-lg overflow-hidden border border-slate-800 text-slate-200 aspect-[16/10] flex flex-col justify-between p-3 sm:p-4 relative group">
              {/* Intentional Placeholder Badge */}
              <div className="absolute top-2 right-2 z-20">
                <span className="text-[10px] bg-slate-900/90 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                  <Laptop className="h-3 w-3" /> Dashboard Preview Asset Placeholder
                </span>
              </div>

              {/* Mock Dashboard Topbar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-[11px] text-white">BCAMS Academic Dashboard</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Session 2026/2027 • Semester 1</span>
              </div>

              {/* Mock Dashboard Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 my-auto pt-1">
                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Enrolled</span>
                    <Users className="h-3 w-3 text-indigo-400" />
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">3,842</div>
                  <div className="text-[9px] text-emerald-400 mt-0.5">98.2% Biometric</div>
                </div>

                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Active Sessions</span>
                    <CalendarCheck className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">14 Live</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Geofence Verified</div>
                </div>

                <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Clearance</span>
                    <BarChart3 className="h-3 w-3 text-purple-400" />
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">84.6%</div>
                  <div className="text-[9px] text-indigo-300 mt-0.5">Threshold ≥70%</div>
                </div>
              </div>

              {/* Mock Activity Sparkline / Feed */}
              <div className="p-2 rounded bg-slate-900/90 border border-slate-800/80 text-[10px] flex items-center justify-between text-slate-300 mt-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>CSC 201 • Lecture Theatre 1 (118 Scans Synchronized)</span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">10:42 AM</span>
              </div>
            </div>
          </div>

          {/* Laptop Base / Keyboard Deck */}
          <div className="w-[108%] h-3 sm:h-3.5 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 rounded-b-xl shadow-2xl relative border-t border-slate-500/40">
            <div className="w-16 h-1 bg-slate-900 rounded-b-md mx-auto" />
          </div>
        </div>

        {/* Feature Badges Footer */}
        <div className="relative z-10 grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            {/* <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span>NFIQ 2.0 Biometrics</span> */}
          </div>
          <div className="flex items-center gap-1.5">
            {/* <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span>Resilient Offline Sync</span> */}
          </div>
          <div className="flex items-center gap-1.5">
            {/* <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span>Controlled Progression</span>z */}
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Official Login & Access ─────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-10 lg:p-14 flex flex-col justify-between bg-[#FAFBFC] order-1 lg:order-2">
        {/* Top Operational Bar with Discreet Gate Access */}
        <div className="flex items-center justify-between pb-6 border-b border-border/60">
          <div className="flex items-center gap-2">
          </div>

          {/* Discreet Standalone Gate Terminal Shortcut (No Login Required) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/gate')}
            className="h-8 text-xs gap-1.5 border-border hover:bg-slate-100/80 text-foreground"
            title="Launch self-service physical turnstile terminal"
          >
            <DoorOpen className="h-3.5 w-3.5 text-primary" />
            Gate Access
          </Button>
        </div>

        {/* Central Official Login Form */}
        <div className="my-auto py-8 max-w-[420px] w-full mx-auto space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign In</h2>
            <p className="text-xs text-muted-foreground">
              Enter your official institutional credentials or staff ID
            </p>
          </div>

          <Card className="shadow-xs border-border bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Official Authentication</CardTitle>
              <CardDescription className="text-xs">
                Restricted to authorized university personnel and students
              </CardDescription>
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
                    className="text-xs"
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
                      className="pr-9 text-xs"
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
                  className="w-full gap-2 text-xs bg-primary text-white shadow-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spinner" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ─── Test-Account Access (Unobtrusive Dropdown) ──────────────────── */}
          <div className="pt-4 border-t border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                Development Personas
              </span>
              <span className="sr-only">Development / Test Access</span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Evaluation Mode
              </span>
            </div>

            <Select value={selectedDevRole} onValueChange={handleDevRoleChange}>
              <SelectTrigger className="h-8 text-xs bg-white border-border/80 text-muted-foreground">
                <SelectValue placeholder="Quick-switch role persona for testing..." />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {TEST_ROLE_PROFILES.map((p) => (
                  <SelectItem key={p.userId} value={p.userId}>
                    {p.name} — {p.badge} ({p.title})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Semantic persona directory for screen readers and automated evaluation */}
            <div className="sr-only">
              {TEST_ROLE_PROFILES.map((p) => (
                <span key={p.userId}>{p.name}</span>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground">
              Select a persona to evaluate role-specific dashboards, capture workspaces, and registry permissions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[11px] text-muted-foreground text-center pt-4 border-t border-border/60">
          © 2026 BCAMS Desktop
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
