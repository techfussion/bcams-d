/**
 * Academia — Academic Sessions & Bulk Progression Tab
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import type {
  AcademicSession,
  BulkProgressionPreview,
  BulkProgressionResult,
  Student,
} from '@/types';
import {
  CheckCircle2, ArrowRight,
  Plus, Play, Loader2,
  Clock,
} from 'lucide-react';

interface SessionsProgressionTabProps {
  sessions: AcademicSession[];
  students: Student[];
  onRefresh: () => Promise<void>;
}

export function SessionsProgressionTab({
  sessions,
  students,
  onRefresh,
}: SessionsProgressionTabProps) {
  const { toast } = useToast();

  // Active current session & semester
  const currentSession = sessions.find((s) => s.isCurrent) || sessions[0];

  // Create Session dialog state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newSemester, setNewSemester] = useState<1 | 2>(1);
  const [newIsCurrent, setNewIsCurrent] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Bulk Progression State
  const [targetSession, setTargetSession] = useState(currentSession?.name || '2026/2027');
  const [targetSemester, setTargetSemester] = useState<1 | 2>(
    currentSession?.currentSemester === 1 ? 2 : 1
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<BulkProgressionPreview | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<BulkProgressionResult | null>(null);

  // Switch Semester state
  const [isSwitchingSemester, setIsSwitchingSemester] = useState(false);

  // Create Academic Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    if (!/^\d{4}\/\d{4}$/.test(newSessionName.trim())) {
      toast({
        title: 'Invalid Format',
        description: 'Session name must be in format YYYY/YYYY (e.g. 2027/2028).',
        variant: 'destructive',
      });
      return;
    }

    const [y1, y2] = newSessionName.trim().split('/').map(Number);
    if (y2 !== y1 + 1) {
      toast({
        title: 'Invalid Academic Year',
        description: 'Session must span consecutive years (e.g. 2027/2028).',
        variant: 'destructive',
      });
      return;
    }

    if (newStartDate && newEndDate && new Date(newStartDate) > new Date(newEndDate)) {
      toast({
        title: 'Invalid Date Range',
        description: 'Start date cannot be after end date.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingSession(true);
    try {
      await api.createAcademicSession({
        name: newSessionName.trim(),
        startDate: newStartDate || undefined,
        endDate: newEndDate || undefined,
        currentSemester: newSemester,
        isCurrent: newIsCurrent,
      });

      toast({
        title: 'Academic Session Established',
        description: `Session ${newSessionName.trim()} created successfully. Historical student data unchanged.`,
        variant: 'success',
      });

      setIsCreateModalOpen(false);
      setNewSessionName('');
      setNewStartDate('');
      setNewEndDate('');
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Creation Failed',
        description: err?.message || 'Failed to create academic session',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Toggle/Set Current Session
  const handleSetCurrentSession = async (session: AcademicSession) => {
    try {
      await api.setCurrentAcademicSession(session.id, session.currentSemester);
      toast({
        title: 'Active Session Updated',
        description: `${session.name} is now the active institutional session.`,
        variant: 'success',
      });
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to set current session',
        variant: 'destructive',
      });
    }
  };

  // Switch Current Semester (Semester 1 <-> Semester 2)
  const handleToggleSemester = async () => {
    if (!currentSession) return;
    setIsSwitchingSemester(true);
    const nextSem: 1 | 2 = currentSession.currentSemester === 1 ? 2 : 1;
    try {
      await api.setCurrentAcademicSession(currentSession.id, nextSem);
      toast({
        title: 'Institutional Semester Advanced',
        description: `${currentSession.name} is now in Semester ${nextSem}.`,
        variant: 'success',
      });
      setTargetSemester(nextSem);
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to switch semester',
        variant: 'destructive',
      });
    } finally {
      setIsSwitchingSemester(false);
    }
  };

  // Generate Progression Preview
  const handlePreviewProgression = async () => {
    setIsPreviewing(true);
    setExecutionResult(null);
    try {
      const preview = await api.previewBulkProgression(targetSession, targetSemester);
      setPreviewData(preview);
    } catch (err: any) {
      toast({
        title: 'Preview Failed',
        description: err?.message || 'Failed to calculate progression eligibility',
        variant: 'destructive',
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  // Execute Bulk Progression
  const handleExecuteProgression = async () => {
    if (!previewData) return;
    setIsExecuting(true);
    try {
      const result = await api.executeBulkProgression(targetSession, targetSemester);
      setExecutionResult(result);
      toast({
        title: 'Bulk Progression Complete',
        description: `Successfully progressed ${result.successfulCount} students into ${targetSession} Semester ${targetSemester}.`,
        variant: 'success',
      });
      setPreviewData(null);
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Progression Failed',
        description: err?.message || 'Bulk progression execution failed',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ─── SECTION 1: Academic Sessions Management ────────────────────── */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Academic Sessions & Institutional Calendar
                  {currentSession && (
                    <Badge className="bg-indigo-600 text-white text-[10px]">
                      Active: {currentSession.name} • Sem {currentSession.currentSemester}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure institutional academic calendars.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSemester}
                disabled={isSwitchingSemester || !currentSession}
                className="text-xs h-8 gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                Switch to Semester {currentSession?.currentSemester === 1 ? 2 : 1}
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs h-8 gap-1.5 bg-primary text-white"
              >
                <Plus className="h-4 w-4" />
                Add Session
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className={`p-3.5 rounded-lg border text-xs transition-colors ${sess.isCurrent
                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                  : 'bg-white border-border text-foreground hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm">{sess.name}</span>
                  {sess.isCurrent ? (
                    <Badge className="bg-indigo-600 text-white text-[9px] uppercase tracking-wider">
                      Current
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                      {sess.status || 'Archived'}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>Semester: <strong className="text-foreground">Semester {sess.currentSemester}</strong></p>
                  {sess.startDate && sess.endDate ? (
                    <p>{new Date(sess.startDate).toLocaleDateString()} — {new Date(sess.endDate).toLocaleDateString()}</p>
                  ) : (
                    <p>Standard Institutional Calendar</p>
                  )}
                </div>
                {!sess.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetCurrentSession(sess)}
                    className="w-full mt-2.5 h-7 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/50"
                  >
                    Set as Current Session
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 2: Controlled Bulk Semester Progression ────────────── */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div>
              <CardTitle className="text-sm font-semibold">
                Controlled Bulk Semester Progression
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Step 1: Target Selection */}
          <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-3">
            <span className="font-semibold text-xs text-foreground block">
              1. Select Target Academic Destination
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Target Academic Session *
                </label>
                <Select value={targetSession} onValueChange={setTargetSession}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name} {s.isCurrent ? '(Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Target Semester *
                </label>
                <Select
                  value={String(targetSemester)}
                  onValueChange={(v) => setTargetSemester(Number(v) as 1 | 2)}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="1">Semester 1 (Advances Level by 100)</SelectItem>
                    <SelectItem value="2">Semester 2 (Preserves Current Level)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={handlePreviewProgression}
                  disabled={isPreviewing || !targetSession}
                  className="w-full h-8 text-xs gap-1.5 bg-primary text-white"
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spinner" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Analyze Progression Impact
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-2.5 rounded bg-white border border-slate-200 text-muted-foreground text-[11px] space-y-0.5">
              <p className="font-medium text-foreground">Authoritative Institutional Progression Rule:</p>
              <p>• Prior enrollments are marked completed. Historical course enrollments and attendance records remain untouched.</p>
            </div>
          </div>

          {/* Step 2: Impact Analysis Preview */}
          {previewData && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground">
                  2. Progression Preview Analysis ({targetSession} • Semester {targetSemester})
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Duplicate Pre-Check Passed
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Eligible to Progress</span>
                  <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{previewData.eligibleCount}</span>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-950">
                  <span className="text-[10px] text-blue-800 uppercase font-semibold block">Already Progressed</span>
                  <span className="text-xl font-bold text-blue-700 mt-0.5 block">{previewData.alreadyProgressedCount}</span>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950">
                  <span className="text-[10px] text-amber-800 uppercase font-semibold block">Excluded Status</span>
                  <span className="text-xl font-bold text-amber-700 mt-0.5 block">{previewData.excludedCount}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-foreground">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Registry</span>
                  <span className="text-xl font-bold text-foreground mt-0.5 block">{previewData.totalStudents}</span>
                </div>
              </div>

              {/* Preview Table of Students */}
              <div className="rounded-lg border border-border overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-border text-[10px] text-muted-foreground uppercase">
                    <tr>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Matric No.</th>
                      <th className="py-2 px-3">Level Change</th>
                      <th className="py-2 px-3">Session Change</th>
                      <th className="py-2 px-3">Progression Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {previewData.students.map((item) => (
                      <tr key={item.studentId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-foreground">{item.studentName}</td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">{item.matricNumber}</td>
                        <td className="py-2 px-3">
                          <span className="text-muted-foreground">{item.currentLevel}</span>
                          <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                          <span className="font-semibold text-emerald-600">{item.targetLevel}</span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-muted-foreground">
                          {item.currentSession} → {item.targetSession}
                        </td>
                        <td className="py-2 px-3">
                          {item.status === 'eligible' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                              Eligible
                            </Badge>
                          ) : item.status === 'already_progressed' ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-[10px]">
                              Already Enrolled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                              {item.reason || 'Excluded'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Execution Action */}
              <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-emerald-950 block">Ready to Execute Bulk Progression</span>
                  <p className="text-[11px] text-emerald-800/90 mt-0.5">
                    Will generate {previewData.eligibleCount} new active academic enrollments for {targetSession} Semester {targetSemester}.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleExecuteProgression}
                  disabled={isExecuting || previewData.eligibleCount === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spinner" /> Executing Progression...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Execute Institution-Wide Progression
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Execution Result Summary Card */}
          {executionResult && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Bulk Semester Progression Successfully Executed
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Progressed</span>
                  <span className="text-lg font-bold text-emerald-700 mt-0.5 block">{executionResult.successfulCount}</span>
                </div>
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200">
                  <span className="text-[10px] text-blue-800 uppercase font-semibold block">Skipped</span>
                  <span className="text-lg font-bold text-blue-700 mt-0.5 block">{executionResult.skippedCount}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-100 border border-slate-200">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Failed</span>
                  <span className="text-lg font-bold text-foreground mt-0.5 block">{executionResult.failedCount}</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Destination: {executionResult.targetSession} • Semester {executionResult.targetSemester}. Student current levels and academic enrollments have been synchronized.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Session Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={handleCreateSession}>
            <DialogHeader>
              <DialogTitle>Add Academic Session</DialogTitle>
              <DialogDescription className="text-xs">
                Establish a new institutional calendar period (e.g. 2027/2028).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Session Name (YYYY/YYYY) *
                </label>
                <Input
                  placeholder="e.g. 2027/2028"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground block mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground block mb-1">End Date</label>
                  <Input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Initial Semester</label>
                <Select
                  value={String(newSemester)}
                  onValueChange={(v) => setNewSemester(Number(v) as 1 | 2)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="1">Semester 1</SelectItem>
                    <SelectItem value="2">Semester 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="set-as-current"
                  checked={newIsCurrent}
                  onChange={(e) => setNewIsCurrent(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="set-as-current" className="text-xs text-foreground cursor-pointer">
                  Set immediately as active institutional session
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isCreatingSession || !newSessionName} className="bg-primary text-white">
                {isCreatingSession ? 'Creating...' : 'Create Session'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
